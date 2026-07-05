import { OUTCOME } from './rules.js';

// This trainer models the commission-free "EZ Baccarat" variant used alongside the
// Sun 7 / Moon 8 side bets at Atlantic City / Resorts World tables: Banker bets pay
// even money with NO 5% commission, but push (no win, no loss) when Banker wins with
// a three-card total of 7 -- that push is exactly what funds the Sun 7 side bet.
//
// House paytables for Sun 7 / Moon 8 vary by casino, so those two ratios are
// player-adjustable at the table (see GameState.setSideBetPayout); everything
// else follows the standard fixed paytable below.

export const SPOTS = ['player', 'banker', 'tie', 'playerBonus', 'bankerBonus', 'sun7', 'moon8'];

// Spots whose payout ratio the player can retune from the default.
export const ADJUSTABLE_SPOTS = ['sun7', 'moon8'];
export const MIN_ADJUSTABLE_PAYOUT = 5;
export const MAX_ADJUSTABLE_PAYOUT = 100;

export const DEFAULT_PAYOUTS = {
  player: 1,
  banker: 1, // commission-free; pushes on banker 3-card-7 instead
  tie: 8,
  sun7: 40,
  moon8: 25,
};

// Player Bonus / Banker Bonus (the "Dragon Bonus" margin-of-victory side bet, as
// spread at Resorts World / Atlantic City). A bet on a side wins when THAT side wins:
//   - with a natural (two-card 8/9): pays 1:1 flat, regardless of margin
//   - with a drawn (non-natural) hand: pays by the point margin of victory below
//   - a natural tie (both hands natural and equal) pushes; every other result loses
export const BONUS_MARGIN_PAYOUTS = { 9: 30, 8: 10, 7: 6, 6: 4, 5: 2, 4: 1 };
export const BONUS_NATURAL_PAYOUT = 1;

export const RESULT = { WIN: 'win', LOSE: 'lose', PUSH: 'push' };

// hand: the object returned by playHand() in rules.js
// bets: { [spot]: stake } — only spots with stake > 0 need be present
// payouts: optional overrides (typically GameState.payouts) for the adjustable spots
// Returns { [spot]: { stake, result, profit, returned } } and totals.
export function resolveBets(bets, hand, payouts = DEFAULT_PAYOUTS) {
  const settlement = {};
  let totalStaked = 0;
  let totalReturned = 0;

  for (const spot of SPOTS) {
    const stake = bets[spot];
    if (!stake) continue;
    totalStaked += stake;

    const res = resolveSpot(spot, stake, hand, payouts);
    const returned = res.result === RESULT.LOSE ? 0 : stake + res.profit;
    totalReturned += returned;
    settlement[spot] = { stake, returned, ...res };
  }

  return {
    settlement,
    totalStaked,
    totalReturned,
    netChange: totalReturned - totalStaked,
  };
}

function resolveSpot(spot, stake, hand, payouts) {
  const mult = payouts[spot] ?? DEFAULT_PAYOUTS[spot];
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

    case 'playerBonus':
      return resolveBonus(OUTCOME.PLAYER, stake, hand);

    case 'bankerBonus':
      return resolveBonus(OUTCOME.BANKER, stake, hand);

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

function resolveBonus(side, stake, hand) {
  const bothNatural = hand.playerNatural && hand.bankerNatural;

  if (hand.outcome === OUTCOME.TIE) {
    // A natural tie returns the bet; any other tie loses.
    return bothNatural
      ? { result: RESULT.PUSH, profit: 0 }
      : { result: RESULT.LOSE, profit: 0 };
  }

  if (hand.outcome !== side) return { result: RESULT.LOSE, profit: 0 };

  const sideNatural = side === OUTCOME.PLAYER ? hand.playerNatural : hand.bankerNatural;
  if (sideNatural) {
    return { result: RESULT.WIN, profit: stake * BONUS_NATURAL_PAYOUT, tier: 'Natural', mult: BONUS_NATURAL_PAYOUT };
  }

  const margin = Math.abs(hand.playerTotal - hand.bankerTotal);
  const mult = BONUS_MARGIN_PAYOUTS[margin];
  if (mult) {
    return { result: RESULT.WIN, profit: stake * mult, tier: `Win by ${margin}`, mult };
  }

  // Non-natural win by 3 or fewer points pays nothing.
  return { result: RESULT.LOSE, profit: 0 };
}
