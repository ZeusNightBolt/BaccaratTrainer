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

// Deterministic rng that walks a fixed list (cycling if exhausted).
// The oracle draws in a fixed order: gutB, gutP, fadeRoll, tieRoll, whimRoll,
// bonusRoll, bonusPick, moodRoll.
function seq(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

const MAIN_SPOTS = new Set(['banker', 'player', 'tie']);
const BONUS_SPOTS = new Set(['sun7', 'moon8', 'playerBonus', 'bankerBonus']);

test('consultGenie always returns a valid main pick, a mood and lines', () => {
  const r = consultGenie(fakeGame({ outcomes: ['B', 'P', 'B'], handNo: 3 }), seq([0.5, 0.5, 0.5, 0.9, 0.5, 0.9, 0.3, 0.3]));
  assert.ok(MAIN_SPOTS.has(r.main.spot));
  assert.equal(typeof r.main.label, 'string');
  assert.equal(typeof r.mood, 'string');
  assert.ok(Array.isArray(r.lines) && r.lines.length >= 1);
  assert.ok(r.lines[0].startsWith('I feel'));
});

test('it calls a bonus hedge when the vibe (rng) takes it, and skips it otherwise', () => {
  // not a tie, no whim flip, bonusRoll < 0.4 -> a bonus is suggested.
  const withBonus = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.5, 0.2, 0.6, 0.3])
  );
  assert.ok(withBonus.bonus, 'expected a bonus hedge');
  assert.ok(BONUS_SPOTS.has(withBonus.bonus.spot));
  assert.equal(typeof withBonus.bonus.label, 'string');
  assert.ok(withBonus.bonus.note.length > 0);

  // bonusRoll >= 0.4 -> no hedge.
  const noBonus = consultGenie(
    fakeGame({ outcomes: ['B', 'P'], handNo: 2 }),
    seq([0.5, 0.5, 0.5, 0.9, 0.5, 0.9, 0.3, 0.3])
  );
  assert.equal(noBonus.bonus, null);
});

test('a rare low tie roll produces a wild Tie call with no bonus', () => {
  const r = consultGenie(fakeGame({ outcomes: ['B', 'P'], handNo: 2 }), seq([0.5, 0.5, 0.5, 0.03, 0.5, 0.5, 0.5, 0.3]));
  assert.equal(r.main.spot, 'tie');
  assert.equal(r.bonus, null);
});

test('a low whim roll flips the call to the opposite side', () => {
  // gutB high, gutP low -> banker leads; whimRoll 0.05 (<0.14) flips it to player.
  const r = consultGenie(fakeGame({ outcomes: ['B', 'P'], handNo: 2 }), seq([0.9, 0.1, 0.5, 0.9, 0.05, 0.9, 0.3, 0.3]));
  assert.equal(r.main.spot, 'player');
  assert.ok(r.lines.some((l) => l.includes('flip to Player')));
});

test('the gut feeling dominates, so re-rolls under real randomness vary', () => {
  // With a fixed game state, many consults with a cycling non-degenerate rng should
  // not all collapse to one side.
  const spots = new Set();
  for (let i = 0; i < 40; i += 1) {
    const g = 0.1 + ((i * 0.137) % 0.8); // spread of gut values
    const r = consultGenie(fakeGame({ outcomes: ['B', 'B', 'B'], handNo: i }), seq([g, 1 - g, 0.5, 0.9, 0.9, 0.9, 0.3, 0.3]));
    spots.add(r.main.spot);
  }
  assert.ok(spots.has('banker') && spots.has('player'), 'expected both sides to appear across re-rolls');
});

test('an empty shoe still yields a coherent reading', () => {
  const r = consultGenie(fakeGame(), seq([0.5, 0.5, 0.5, 0.9, 0.5, 0.9, 0.3, 0.3]));
  assert.ok(MAIN_SPOTS.has(r.main.spot));
  assert.ok(r.lines[0].startsWith('I feel'));
});
