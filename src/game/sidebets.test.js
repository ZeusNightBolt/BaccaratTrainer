import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBets, RESULT, DEFAULT_PAYOUTS } from './sidebets.js';
import { OUTCOME } from './rules.js';

function hand(overrides) {
  return {
    outcome: OUTCOME.PLAYER,
    playerPair: false,
    bankerPair: false,
    bankerThreeCardSeven: false,
    playerThreeCardEight: false,
    ...overrides,
  };
}

test('banker bet wins even money when banker wins normally', () => {
  const { settlement, netChange } = resolveBets({ banker: 100 }, hand({ outcome: OUTCOME.BANKER }));
  assert.equal(settlement.banker.result, RESULT.WIN);
  assert.equal(settlement.banker.returned, 200);
  assert.equal(netChange, 100);
});

test('banker bet pushes (no commission loss, no win) on a three-card-seven banker win', () => {
  const { settlement, netChange } = resolveBets(
    { banker: 100 },
    hand({ outcome: OUTCOME.BANKER, bankerThreeCardSeven: true })
  );
  assert.equal(settlement.banker.result, RESULT.PUSH);
  assert.equal(settlement.banker.returned, 100);
  assert.equal(netChange, 0);
});

test('player and banker bets push on a tie; tie bet pays 8:1', () => {
  const result = resolveBets({ player: 50, banker: 50, tie: 20 }, hand({ outcome: OUTCOME.TIE }));
  assert.equal(result.settlement.player.result, RESULT.PUSH);
  assert.equal(result.settlement.banker.result, RESULT.PUSH);
  assert.equal(result.settlement.tie.result, RESULT.WIN);
  assert.equal(result.settlement.tie.returned, 180);
});

test('sun7 pays 40:1 only on banker three-card seven', () => {
  const win = resolveBets({ sun7: 5 }, hand({ outcome: OUTCOME.BANKER, bankerThreeCardSeven: true }));
  assert.equal(win.settlement.sun7.returned, 205);

  const lose = resolveBets({ sun7: 5 }, hand({ outcome: OUTCOME.BANKER, bankerThreeCardSeven: false }));
  assert.equal(lose.settlement.sun7.result, RESULT.LOSE);
  assert.equal(lose.settlement.sun7.returned, 0);
});

test('moon8 pays 25:1 by default, only on player three-card eight', () => {
  assert.equal(DEFAULT_PAYOUTS.moon8, 25);
  const win = resolveBets({ moon8: 5 }, hand({ outcome: OUTCOME.PLAYER, playerThreeCardEight: true }));
  assert.equal(win.settlement.moon8.returned, 130);

  const lose = resolveBets({ moon8: 5 }, hand({ outcome: OUTCOME.PLAYER, playerThreeCardEight: false }));
  assert.equal(lose.settlement.moon8.result, RESULT.LOSE);
});

test('resolveBets accepts custom payout ratios for sun7/moon8', () => {
  const customPayouts = { ...DEFAULT_PAYOUTS, sun7: 30, moon8: 20 };

  const sun7Win = resolveBets(
    { sun7: 10 },
    hand({ outcome: OUTCOME.BANKER, bankerThreeCardSeven: true }),
    customPayouts
  );
  assert.equal(sun7Win.settlement.sun7.returned, 310);

  const moon8Win = resolveBets(
    { moon8: 10 },
    hand({ outcome: OUTCOME.PLAYER, playerThreeCardEight: true }),
    customPayouts
  );
  assert.equal(moon8Win.settlement.moon8.returned, 210);
});

test('pair bets pay 11:1 independent of the main outcome', () => {
  const result = resolveBets(
    { playerPair: 10, bankerPair: 10 },
    hand({ outcome: OUTCOME.BANKER, playerPair: true, bankerPair: false })
  );
  assert.equal(result.settlement.playerPair.returned, 120);
  assert.equal(result.settlement.bankerPair.result, RESULT.LOSE);
});

test('only staked spots appear in the settlement', () => {
  const { settlement } = resolveBets({ player: 10 }, hand());
  assert.deepEqual(Object.keys(settlement), ['player']);
});
