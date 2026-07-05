import { OUTCOME } from './rules.js';

// This trainer models the commission-free "EZ Baccarat" variant used alongside the
// Sun 7 / Moon 8 side bets at Atlantic City / Resorts World tables: Banker bets pay
// even money with NO 5% commission, but push (no win, no loss) when Banker wins with
// a three-card total of 7 -- that push is exactly what funds the Sun 7 40:1 payout.

export const SPOTS = ['player', 'banker', 'tie', 'playerPair', 'bankerPair', 'sun7', 'moon8'];

export const PAYOUTS = {
  player: 1,
  banker: 1, // commission-free; pushes on banker 3-card-7 instead
  tie: 8,
  playerPair: 11,
  bankerPair: 11,
  sun7: 40,
  moon8: 40,
};

export const RESULT = { WIN: 'win', LOSE: 'lose', PUSH: 'push' };

// hand: the object returned by playHand() in rules.js
// bets: { [spot]: stake } — only spots with stake > 0 need be present
// Returns { [spot]: { stake, result, profit, returned } } and totals.
export function resolveBets(bets, hand) {
  const settlement = {};
  let totalStaked = 0;
  let totalReturned = 0;

  for (const spot of SPOTS) {
    const stake = bets[spot];
    if (!stake) continue;
    totalStaked += stake;

    const { result, profit } = resolveSpot(spot, stake, hand);
    const returned = result === RESULT.LOSE ? 0 : stake + profit;
    totalReturned += returned;
    settlement[spot] = { stake, result, profit, returned };
  }

  return {
    settlement,
    totalStaked,
    totalReturned,
    netChange: totalReturned - totalStaked,
  };
}

function resolveSpot(spot, stake, hand) {
  const mult = PAYOUTS[spot];
  switch (spot) {
    case 'player':
      if (hand.outcome === OUTCOME.PLAYER) return { result: RESULT.WIN, profit: stake * mult };
      if (hand.outcome === OUTCOME.TIE) return { result: RESULT.PUSH, profit: 0 };
      return { result: RESULT.LOSE, profit: 0 };

    case 'banker':
      if (hand.outcome === OUTCOME.BANKER) {
        if (hand.bankerThreeCardSeven) return { result: RESULT.PUSH, profit: 0 };
        return { result: RESULT.WIN, profit: stake * mult };
      }
      if (hand.outcome === OUTCOME.TIE) return { result: RESULT.PUSH, profit: 0 };
      return { result: RESULT.LOSE, profit: 0 };

    case 'tie':
      if (hand.outcome === OUTCOME.TIE) return { result: RESULT.WIN, profit: stake * mult };
      return { result: RESULT.LOSE, profit: 0 };

    case 'playerPair':
      if (hand.playerPair) return { result: RESULT.WIN, profit: stake * mult };
      return { result: RESULT.LOSE, profit: 0 };

    case 'bankerPair':
      if (hand.bankerPair) return { result: RESULT.WIN, profit: stake * mult };
      return { result: RESULT.LOSE, profit: 0 };

    case 'sun7':
      if (hand.bankerThreeCardSeven) return { result: RESULT.WIN, profit: stake * mult };
      return { result: RESULT.LOSE, profit: 0 };

    case 'moon8':
      if (hand.playerThreeCardEight) return { result: RESULT.WIN, profit: stake * mult };
      return { result: RESULT.LOSE, profit: 0 };

    default:
      throw new Error(`Unknown bet spot: ${spot}`);
  }
}
