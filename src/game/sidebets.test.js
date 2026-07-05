import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBets, RESULT, DEFAULT_PAYOUTS } from './sidebets.js';
import { OUTCOME } from './rules.js';

function hand(overrides) {
  return {
    outcome: OUTCOME.PLAYER,
    playerTotal: 0,
    bankerTotal: 0,
    playerNatural: false,
    bankerNatural: false,
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

test('player bonus pays the margin ladder on a non-natural win', () => {
  // Player 9 vs Banker 0, drawn (non-natural): margin 9 -> 30:1
  const win9 = resolveBets(
    { playerBonus: 10 },
    hand({ outcome: OUTCOME.PLAYER, playerTotal: 9, bankerTotal: 0 })
  );
  assert.equal(win9.settlement.playerBonus.result, RESULT.WIN);
  assert.equal(win9.settlement.playerBonus.returned, 310); // 10 + 300

  // margin 4 -> 1:1
  const win4 = resolveBets(
    { playerBonus: 10 },
    hand({ outcome: OUTCOME.PLAYER, playerTotal: 7, bankerTotal: 3 })
  );
  assert.equal(win4.settlement.playerBonus.returned, 20);
});

test('bonus bet loses on a non-natural win by 3 or fewer points', () => {
  const win3 = resolveBets(
    { bankerBonus: 10 },
    hand({ outcome: OUTCOME.BANKER, playerTotal: 4, bankerTotal: 7 })
  );
  assert.equal(win3.settlement.bankerBonus.result, RESULT.LOSE);
  assert.equal(win3.settlement.bankerBonus.returned, 0);
});

test('bonus pays a flat 1:1 on a natural win regardless of margin', () => {
  // Banker natural 9 vs Player 0 -> margin 9 but natural, so 1:1 not 30:1
  const natural = resolveBets(
    { bankerBonus: 10 },
    hand({ outcome: OUTCOME.BANKER, bankerNatural: true, playerTotal: 0, bankerTotal: 9 })
  );
  assert.equal(natural.settlement.bankerBonus.result, RESULT.WIN);
  assert.equal(natural.settlement.bankerBonus.returned, 20);
});

test('bonus pushes on a natural tie and loses on a non-natural tie', () => {
  const naturalTie = resolveBets(
    { playerBonus: 10 },
    hand({ outcome: OUTCOME.TIE, playerNatural: true, bankerNatural: true, playerTotal: 8, bankerTotal: 8 })
  );
  assert.equal(naturalTie.settlement.playerBonus.result, RESULT.PUSH);
  assert.equal(naturalTie.settlement.playerBonus.returned, 10);

  const plainTie = resolveBets(
    { playerBonus: 10 },
    hand({ outcome: OUTCOME.TIE, playerTotal: 5, bankerTotal: 5 })
  );
  assert.equal(plainTie.settlement.playerBonus.result, RESULT.LOSE);
});

test('bonus loses when the other side wins', () => {
  const result = resolveBets(
    { playerBonus: 10 },
    hand({ outcome: OUTCOME.BANKER, bankerTotal: 7, playerTotal: 2 })
  );
  assert.equal(result.settlement.playerBonus.result, RESULT.LOSE);
});

test('only staked spots appear in the settlement', () => {
  const { settlement } = resolveBets({ player: 10 }, hand());
  assert.deepEqual(Object.keys(settlement), ['player']);
});
