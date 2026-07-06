import test from 'node:test';
import assert from 'node:assert/strict';
import { consultGenie } from './genieOracle.js';

function fakeGame({ outcomes = [], lastHand = null, handNo = 0 } = {}) {
  return {
    shoeRounds: outcomes.map((o) => ({ hand: { outcome: o } })),
    history: Array.from({ length: handNo }, () => ({})),
    lastRound: lastHand ? { hand: lastHand } : null,
  };
}

// Deterministic rng walking a fixed list. The oracle draws in a fixed order:
// gutB, gutP, patRoll, patSway, tieRoll, whimRoll, emoRoll, breakRoll, stakeRoll,
// bonusRoll, bonusPick, voiceRoll.
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const MAIN_SPOTS = new Set(['banker', 'player', 'tie']);
const BONUS_SPOTS = new Set(['sun7', 'moon8', 'playerBonus', 'bankerBonus']);
const RATES = new Set(['calm', 'quick', 'racing']);

test('consultGenie returns a valid pick, an emotion with a heartbeat, and a spiral of thoughts', () => {
  const r = consultGenie(
    fakeGame({ outcomes: ['B', 'P', 'B'], handNo: 3 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3])
  );
  assert.ok(MAIN_SPOTS.has(r.main.spot));
  assert.equal(typeof r.main.label, 'string');
  assert.equal(typeof r.emotion.label, 'string');
  assert.equal(typeof r.emotion.emoji, 'string');
  assert.ok(RATES.has(r.heartRate));
  assert.ok(Array.isArray(r.lines) && r.lines.length >= 2);
  assert.ok(r.lines.some((l) => l.includes('going')), 'expected a gut-commit line');
});

test('it calls a bonus hedge when the vibe takes it, and skips it otherwise', () => {
  const withBonus = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.2, 0.6, 0.3])
  );
  assert.ok(withBonus.bonus, 'expected a bonus hedge');
  assert.ok(BONUS_SPOTS.has(withBonus.bonus.spot));
  assert.ok(withBonus.bonus.note.length > 0);

  const noBonus = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3])
  );
  assert.equal(noBonus.bonus, null);
});

test('a rare low tie roll produces a wild Tie call with no bonus and no stake advice', () => {
  const r = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.03, 0.9, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3])
  );
  assert.equal(r.main.spot, 'tie');
  assert.equal(r.bonus, null);
  assert.equal(r.stake, null);
});

test('a spooked mood tells you to trim the unit', () => {
  // emoRoll 0.2 -> EMOTIONS[floor(0.2*6)=1] = "spooked"
  const r = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.2, 0.9, 0.9, 0.9, 0.3, 0.3])
  );
  assert.equal(r.emotion.key, 'spooked');
  assert.ok(r.stake && r.stake.level === 'trim');
  assert.ok(r.stake.note.length > 0);
});

test('a long run it feels wobbling triggers a trim and a snap-warning line', () => {
  const r = consultGenie(
    fakeGame({ outcomes: ['B', 'B', 'B', 'B'], handNo: 4 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.55, 0.3, 0.9, 0.9, 0.3, 0.3])
  );
  assert.ok(r.stake && r.stake.level === 'trim');
  assert.ok(r.lines.some((l) => l.includes('snapping')), 'expected a streak-break warning');
});

test('the gut dominates, so re-rolls under real randomness vary', () => {
  const spots = new Set();
  for (let i = 0; i < 40; i += 1) {
    const g = 0.1 + ((i * 0.137) % 0.8);
    const r = consultGenie(
      fakeGame({ outcomes: ['B', 'B', 'B'], handNo: i }),
      seq([g, 1 - g, 0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3])
    );
    spots.add(r.main.spot);
  }
  assert.ok(spots.has('banker') && spots.has('player'), 'expected both sides across re-rolls');
});

test('an empty shoe still yields a coherent reading (a numerology hunch keeps it talking)', () => {
  const r = consultGenie(fakeGame(), seq([0.5, 0.5, 0.5, 0.9, 0.9, 0.9, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3]));
  assert.ok(MAIN_SPOTS.has(r.main.spot));
  assert.ok(r.lines.length >= 2);
  assert.ok(r.lines.some((l) => l.includes('number')), 'expected the always-on numerology hunch');
});
