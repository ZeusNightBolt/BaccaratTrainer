import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadEngine } from './bigroad.js';
import {
  detectLengthCycle,
  detectChopPattern,
  readDerivedRoads,
  readRoad,
  composeReading,
  getRoadGenieReading,
} from './roadGenie.js';

function playSequence(outcomes) {
  const road = new RoadEngine();
  for (const outcome of outcomes) road.addResult(outcome);
  return road;
}

test('readRoad on an empty road returns a cold-start stage', () => {
  const reading = readRoad(new RoadEngine());
  assert.equal(reading.stage, 'cold-start');
  assert.equal(reading.suggestion, null);
  assert.ok(composeReading(reading)[0].length > 0);
});

test('a single result suggests following at normal size', () => {
  const reading = readRoad(playSequence(['B']));
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'banker');
  assert.equal(reading.suggestion.reason, 'early-streak');
});

test('a three-plus streak with no rhythm is a strong-streak follow', () => {
  const reading = readRoad(playSequence(['P', 'P', 'P']));
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'player');
  assert.equal(reading.suggestion.reason, 'strong-streak');
});

test('detectLengthCycle finds the shortest tail period', () => {
  assert.deepEqual(detectLengthCycle([3, 3, 3, 3]), { period: 1, cycle: [3], repeats: 4 });
  assert.deepEqual(detectLengthCycle([3, 4, 3, 4]), { period: 2, cycle: [3, 4], repeats: 2 });
  assert.deepEqual(detectLengthCycle([2, 2, 3, 3, 2, 2, 3, 3]), { period: 4, cycle: [2, 2, 3, 3], repeats: 2 });
  assert.equal(detectLengthCycle([1, 2, 3]), null);
});

test('a ping-pong road (1-1-1-1) is read as an alternating rhythm and fades the turn', () => {
  // P,B,P,B,P,B -> six columns of length 1. Current column (B, len 1) is at its
  // target length, so the rhythm says it turns -> fade to Player.
  const reading = readRoad(playSequence(['P', 'B', 'P', 'B', 'P', 'B']));
  assert.equal(reading.pattern.type, 'pingpong');
  assert.equal(reading.suggestion.action, 'fade');
  assert.equal(reading.suggestion.spot, 'player');
  assert.ok(composeReading(reading).some((l) => l.toLowerCase().includes('ping-pong')));
});

test('an alternating 3-4-3-4 rhythm is recognised and read against the current column', () => {
  // Columns P3, B4, P3, B4, then a new P column. Completed lengths [3,4,3,4] -> period 2,
  // current P column target = 3. At length < 3 it should follow; at length 3 it fades.
  const base = ['P', 'P', 'P', 'B', 'B', 'B', 'B', 'P', 'P', 'P', 'B', 'B', 'B', 'B'];
  const followRoad = playSequence([...base, 'P']); // current P length 1 < target 3
  const followReading = readRoad(followRoad);
  assert.equal(followReading.pattern.type, 'alternating');
  assert.equal(followReading.suggestion.action, 'follow');
  assert.equal(followReading.suggestion.spot, 'player');

  const fadeRoad = playSequence([...base, 'P', 'P', 'P']); // current P length 3 === target
  const fadeReading = readRoad(fadeRoad);
  assert.equal(fadeReading.suggestion.action, 'fade');
  assert.equal(fadeReading.suggestion.spot, 'banker');
  assert.equal(fadeReading.suggestion.sizeHint, 'reduced');
});

test('a 2-2-3-3 rhythm is detected as a repeating cycle', () => {
  // Completed columns P2,B2,P3,B3,P2,B2,P3,B3 -> lengths [2,2,3,3,2,2,3,3], then a
  // fresh P column in progress.
  const reading = readRoad(
    playSequence([
      'P', 'P', 'B', 'B', 'P', 'P', 'P', 'B', 'B', 'B',
      'P', 'P', 'B', 'B', 'P', 'P', 'P', 'B', 'B', 'B',
      'P',
    ])
  );
  assert.equal(reading.pattern.type, 'cycle');
  assert.deepEqual(reading.pattern.cycle, [2, 2, 3, 3]);
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'player');
  assert.ok(reading.suggestion.confidence >= 1 && reading.suggestion.confidence <= 3);
});

test('a column that outruns the rhythm is read as a breakout follow', () => {
  // Even chop of 2s, then the current column runs to 4 (beyond target 2).
  const reading = readRoad(playSequence(['P', 'P', 'B', 'B', 'P', 'P', 'B', 'B', 'B', 'B']));
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.reason, 'pattern-broke-streak');
});

test('detectChopPattern still flags equal-length alternating columns', () => {
  const pattern = detectChopPattern([
    { outcome: 'P', length: 3 },
    { outcome: 'B', length: 3 },
    { outcome: 'P', length: 3 },
    { outcome: 'B', length: 3 },
  ]);
  assert.deepEqual(pattern, { length: 3, columnsMatched: 4 });
});

test('readDerivedRoads aggregates the latest mark from each derived road', () => {
  const following = {
    derivedRoad: (name) =>
      ({ bigEyeBoy: [{ outcome: 'R' }], smallRoad: [{ outcome: 'R' }], cockroachRoad: [{ outcome: 'B' }] }[name]),
  };
  assert.equal(readDerivedRoads(following).consensus, 'following');
  assert.equal(readDerivedRoads({ derivedRoad: () => [] }).consensus, 'insufficient-data');
  const split = {
    derivedRoad: (name) => ({ bigEyeBoy: [{ outcome: 'R' }], smallRoad: [{ outcome: 'B' }], cockroachRoad: [] }[name]),
  };
  assert.equal(readDerivedRoads(split).consensus, 'split');
});

test('getRoadGenieReading bundles the reading with composed lines and a confidence', () => {
  const { lines, suggestion } = getRoadGenieReading(playSequence(['B', 'B']));
  assert.ok(Array.isArray(lines) && lines.length > 0);
  assert.equal(suggestion.action, 'follow');
  assert.ok(suggestion.confidence >= 1 && suggestion.confidence <= 3);
});
