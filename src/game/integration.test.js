import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from './state.js';
import { SPOTS } from './sidebets.js';

// A deterministic LCG so the whole simulation is reproducible in CI.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MAIN_SPOTS = ['player', 'banker', 'tie'];
const RESULTS = new Set(['win', 'lose', 'push']);

// Smoke test: play thousands of real hands end-to-end through the full game stack
// (shoe → deal → third-card tableau → side-bet resolution → bankroll → roads) and
// assert the invariants that must hold every single hand, plus a sanity check on
// the outcome distribution.
test('a 4000-hand seeded simulation keeps every money/state invariant', () => {
  const game = new GameState({ bankroll: 50000, rng: makeRng(0xba66a7) });
  const HANDS = 4000;
  const counts = { PLAYER: 0, BANKER: 0, TIE: 0 };
  let sun7Fired = 0;
  let bankerPush3Card7 = 0;

  for (let h = 0; h < HANDS; h += 1) {
    // Keep the sim solvent — a real player would rebuy; here we just top up.
    if (game.bankroll < 500) {
      game.bankroll = 50000;
      game.startingBankroll = 50000;
    }

    // Rotate a $100 main bet across spots, and sprinkle small side bets.
    const main = MAIN_SPOTS[h % 3];
    game.placeChip(main, 100);
    if (h % 4 === 0) game.placeChip('sun7', 25);
    if (h % 5 === 0) game.placeChip('moon8', 25);
    if (h % 7 === 0) game.placeChip('bankerBonus', 25);

    const staked = game.totalWagered;
    const before = game.bankroll;
    const round = game.playRound();

    // --- money invariants ---
    assert.ok(Number.isFinite(game.bankroll), `bankroll finite @${h}`);
    assert.ok(game.bankroll >= 0, `bankroll non-negative @${h}`);
    assert.equal(round.stake, staked, `stake recorded @${h}`);
    assert.equal(round.bankrollAfter, game.bankroll, `bankrollAfter matches @${h}`);
    assert.equal(round.netChange, round.totalReturned - round.stake, `netChange identity @${h}`);
    assert.equal(game.bankroll, before - staked + round.totalReturned, `wallet math @${h}`);
    assert.ok(Number.isFinite(round.totalReturned) && round.totalReturned >= 0, `returned sane @${h}`);

    // --- settlement invariants ---
    for (const spot of SPOTS) {
      const s = round.settlement[spot];
      if (!s) continue;
      assert.ok(RESULTS.has(s.result), `${spot} result valid @${h}`);
      assert.ok(Number.isFinite(s.returned) && s.returned >= 0, `${spot} returned sane @${h}`);
    }

    // --- hand/rules invariants ---
    const { hand } = round;
    assert.ok(['PLAYER', 'BANKER', 'TIE'].includes(hand.outcome), `outcome valid @${h}`);
    assert.ok(hand.player.length >= 2 && hand.player.length <= 3, `player card count @${h}`);
    assert.ok(hand.banker.length >= 2 && hand.banker.length <= 3, `banker card count @${h}`);
    counts[hand.outcome] += 1;

    // EZ push: a Banker win with a 3-card 7 must PUSH the Banker main bet.
    if (hand.bankerThreeCardSeven) {
      bankerPush3Card7 += 1;
      assert.equal(hand.outcome, 'BANKER', `3-card-7 only on Banker win @${h}`);
      // (only assert the Banker bet's push when it was actually placed this hand)
      if (round.bets.banker) assert.equal(round.settlement.banker.result, 'push', `EZ Banker push @${h}`);
    }
    if (hand.bankerThreeCardSeven && round.bets.sun7) {
      assert.equal(round.settlement.sun7.result, 'win', `Sun 7 pays on 3-card-7 @${h}`);
      sun7Fired += 1;
    }
    if (hand.playerThreeCardEight && round.bets.moon8) {
      assert.equal(round.settlement.moon8.result, 'win', `Moon 8 pays on 3-card-8 @${h}`);
    }

    game.returnToBetting();
  }

  // --- distribution sanity (real baccarat: Banker ~45.9%, Player ~44.6%, Tie ~9.5%) ---
  const total = counts.PLAYER + counts.BANKER + counts.TIE;
  assert.equal(total, HANDS);
  assert.ok(counts.TIE / total > 0.05 && counts.TIE / total < 0.16, `tie rate plausible: ${counts.TIE / total}`);
  assert.ok(counts.BANKER / total > 0.40 && counts.BANKER / total < 0.52, `banker rate plausible: ${counts.BANKER / total}`);
  assert.ok(counts.PLAYER / total > 0.40 && counts.PLAYER / total < 0.52, `player rate plausible: ${counts.PLAYER / total}`);
  // The rare bonus conditions should occur at least once in 4000 hands.
  assert.ok(bankerPush3Card7 > 0, 'a 3-card-7 Banker push occurred');
  assert.ok(sun7Fired > 0, 'Sun 7 fired at least once');
});

test('serialize/loadSession round-trips a mid-shoe session', () => {
  const game = new GameState({ bankroll: 50000, rng: makeRng(42) });
  for (let h = 0; h < 60; h += 1) {
    game.placeChip(MAIN_SPOTS[h % 3], 100);
    game.playRound();
    game.returnToBetting();
  }
  const snapshot = JSON.parse(JSON.stringify(game.serialize()));
  const restored = new GameState();
  restored.loadSession(snapshot);
  assert.equal(restored.bankroll, game.bankroll);
  assert.equal(restored.history.length, game.history.length);
  assert.equal(restored.stats().handsPlayed, game.stats().handsPlayed);
});
