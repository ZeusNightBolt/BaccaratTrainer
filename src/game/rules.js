// Core baccarat hand-value and third-card drawing rules.
// Card rank: 'A','2'..'9','10','J','Q','K'. Suit is irrelevant to value.

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];

export function cardValue(rank) {
  if (rank === 'A') return 1;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

export function handTotal(cards) {
  const sum = cards.reduce((acc, c) => acc + cardValue(c.rank), 0);
  return sum % 10;
}

export function isNatural(cards) {
  return cards.length === 2 && (handTotal(cards) === 8 || handTotal(cards) === 9);
}

// Returns true if the player draws a third card, given only the player's first two cards.
// Must only be called when neither hand is natural.
export function playerDraws(playerCards) {
  return handTotal(playerCards) <= 5;
}

// Returns true if the banker draws a third card.
// playerThirdCard is null if the player stood.
export function bankerDraws(bankerCards, playerThirdCard) {
  const total = handTotal(bankerCards);
  if (total <= 2) return true;
  if (total >= 7) return false;

  if (playerThirdCard === null) {
    // Player stood (had 6 or 7): banker draws on 0-5, stands on 6-7 (already handled above).
    return total <= 5;
  }

  const p = cardValue(playerThirdCard.rank);
  switch (total) {
    case 3:
      return p !== 8;
    case 4:
      return p >= 2 && p <= 7;
    case 5:
      return p >= 4 && p <= 7;
    case 6:
      return p === 6 || p === 7;
    default:
      return false;
  }
}

export const OUTCOME = { PLAYER: 'PLAYER', BANKER: 'BANKER', TIE: 'TIE' };

export function decideOutcome(playerTotal, bankerTotal) {
  if (playerTotal > bankerTotal) return OUTCOME.PLAYER;
  if (bankerTotal > playerTotal) return OUTCOME.BANKER;
  return OUTCOME.TIE;
}

export function isPair(cards) {
  return cards.length >= 2 && cards[0].rank === cards[1].rank;
}

// Plays out a full hand given a shoe-drawing function `draw()` that returns the next card.
// Returns { player, banker, playerTotal, bankerTotal, outcome, playerNatural, bankerNatural,
//           playerPair, bankerPair, bankerThreeCardSeven, playerThreeCardEight }
export function playHand(draw) {
  // Real table dealing order: Player, Banker, Player, Banker, then Player's
  // third card (if any), then Banker's third card (if any).
  const player = [draw()];
  const banker = [draw()];
  player.push(draw());
  banker.push(draw());

  const playerPair = isPair(player);
  const bankerPair = isPair(banker);

  const naturalPlayer = isNatural(player);
  const naturalBanker = isNatural(banker);

  let playerThirdCard = null;

  if (!naturalPlayer && !naturalBanker) {
    if (playerDraws(player)) {
      playerThirdCard = draw();
      player.push(playerThirdCard);
    }
    if (bankerDraws(banker, playerThirdCard)) {
      banker.push(draw());
    }
  }

  const playerTotal = handTotal(player);
  const bankerTotal = handTotal(banker);
  const outcome = decideOutcome(playerTotal, bankerTotal);

  const bankerThreeCardSeven = banker.length === 3 && bankerTotal === 7 && outcome === OUTCOME.BANKER;
  const playerThreeCardEight = player.length === 3 && playerTotal === 8 && outcome === OUTCOME.PLAYER;

  return {
    player,
    banker,
    playerTotal,
    bankerTotal,
    outcome,
    playerNatural: naturalPlayer,
    bankerNatural: naturalBanker,
    playerPair,
    bankerPair,
    bankerThreeCardSeven,
    playerThreeCardEight,
  };
}
