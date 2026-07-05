const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);

export function createCardElement(card, delayMs = 0) {
  const el = document.createElement('div');
  el.className = `playing-card ${RED_SUITS.has(card.suit) ? 'red' : 'black'}`;
  el.style.animationDelay = `${delayMs}ms`;

  const top = document.createElement('span');
  top.className = 'rank-top';
  top.textContent = `${card.rank}${SUIT_SYMBOL[card.suit]}`;

  const center = document.createElement('span');
  center.className = 'suit-center';
  center.textContent = SUIT_SYMBOL[card.suit];

  const bottom = document.createElement('span');
  bottom.className = 'rank-bottom';
  bottom.textContent = `${card.rank}${SUIT_SYMBOL[card.suit]}`;

  el.append(top, center, bottom);
  return el;
}

// Real dealing order is Player, Banker, Player, Banker, [Player 3rd], [Banker 3rd].
// Returns an ordered list of { hand: 'player'|'banker', card, index } to animate in sequence.
export function dealSequence(hand) {
  const seq = [];
  seq.push({ hand: 'player', card: hand.player[0], index: 0 });
  seq.push({ hand: 'banker', card: hand.banker[0], index: 0 });
  seq.push({ hand: 'player', card: hand.player[1], index: 1 });
  seq.push({ hand: 'banker', card: hand.banker[1], index: 1 });
  if (hand.player.length === 3) seq.push({ hand: 'player', card: hand.player[2], index: 2 });
  if (hand.banker.length === 3) seq.push({ hand: 'banker', card: hand.banker[2], index: 2 });
  return seq;
}
