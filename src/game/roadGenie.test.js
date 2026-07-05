import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadEngine } from './bigroad.js';
import { detectChopPattern, readDerivedRoads, readRoad, composeReading, getRoadGenieReading } from './roadGenie.js';

function playSequence(outcomes) {
  const road = new RoadEngine();
  for (const outcome of outcomes) road.addResult(outcome);
  return road;
}

test('readRoad on an empty road returns a cold-start stage', () => {
  const road = new RoadEngine();
  const reading = readRoad(road);
  assert.equal(reading.stage, 'cold-start');
  assert.equal(reading.suggestion, null);
  assert.ok(composeReading(reading)[0].length > 0);
});

test('a single result suggests following at normal size with an early-streak reason', () => {
  const road = playSequence(['B']);
  const reading = readRoad(road);
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'banker');
  assert.equal(reading.suggestion.sizeHint, 'normal');
  assert.equal(reading.suggestion.reason, 'early-streak');
});

test('a three-plus streak is a strong-streak follow', () => {
  const road = playSequence(['P', 'P', 'P']);
  const reading = readRoad(road);
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'player');
  assert.equal(reading.suggestion.reason, 'strong-streak');
});

test('detectChopPattern requires equal-length alternating columns and enough history', () => {
  assert.equal(detectChopPattern([{ outcome: 'P', length: 3 }]), null);
  assert.equal(
    detectChopPattern([
      { outcome: 'P', length: 3 },
      { outcome: 'B', length: 2 },
      { outcome: 'P', length: 3 },
      { outcome: 'B', length: 3 },
    ]),
    null
  );
  const pattern = detectChopPattern([
    { outcome: 'P', length: 3 },
    { outcome: 'B', length: 3 },
    { outcome: 'P', length: 3 },
    { outcome: 'B', length: 3 },
  ]);
  assert.deepEqual(pattern, { length: 3, columnsMatched: 4 });
});

test('a mature chop-of-3 pattern suggests fading the streak at a reduced size', () => {
  // Columns: P3, B3, P3, B3, P3 -- five columns of three, strictly alternating.
  const road = playSequence(['P', 'P', 'P', 'B', 'B', 'B', 'P', 'P', 'P', 'B', 'B', 'B', 'P', 'P', 'P']);
  const reading = readRoad(road);
  assert.equal(reading.chop.length, 3);
  assert.equal(reading.suggestion.action, 'fade');
  assert.equal(reading.suggestion.spot, 'banker'); // opposite of the current Player column
  assert.equal(reading.suggestion.sizeHint, 'reduced');
  const lines = composeReading(reading);
  assert.ok(lines.some((l) => l.includes('due to flip')));
});

test('once the next column starts fresh, the chop-due suggestion clears until it matures again', () => {
  const road = playSequence(['P', 'P', 'P', 'B', 'B', 'B', 'P', 'P', 'P', 'B', 'B', 'B', 'P', 'P', 'P', 'B']);
  const reading = readRoad(road);
  assert.equal(reading.chop, null);
  assert.equal(reading.suggestion.action, 'follow');
  assert.equal(reading.suggestion.spot, 'banker');
  assert.equal(reading.suggestion.streakLength, 1);
});

test('readDerivedRoads aggregates the latest mark from each derived road', () => {
  const following = {
    derivedRoad: (name) => ({ bigEyeBoy: [{ outcome: 'R' }], smallRoad: [{ outcome: 'R' }], cockroachRoad: [{ outcome: 'B' }] }[name]),
  };
  const result = readDerivedRoads(following);
  assert.equal(result.consensus, 'following');
  assert.equal(result.reads.length, 3);

  const noData = { derivedRoad: () => [] };
  assert.equal(readDerivedRoads(noData).consensus, 'insufficient-data');

  const split = {
    derivedRoad: (name) => ({ bigEyeBoy: [{ outcome: 'R' }], smallRoad: [{ outcome: 'B' }], cockroachRoad: [] }[name]),
  };
  assert.equal(readDerivedRoads(split).consensus, 'split');

  const breaking = {
    derivedRoad: (name) => ({ bigEyeBoy: [{ outcome: 'B' }], smallRoad: [{ outcome: 'B' }], cockroachRoad: [{ outcome: 'R' }] }[name]),
  };
  assert.equal(readDerivedRoads(breaking).consensus, 'breaking');
});

test('getRoadGenieReading bundles the reading with composed lines', () => {
  const road = playSequence(['B', 'B']);
  const { lines, suggestion } = getRoadGenieReading(road);
  assert.ok(Array.isArray(lines) && lines.length > 0);
  assert.equal(suggestion.action, 'follow');
});
