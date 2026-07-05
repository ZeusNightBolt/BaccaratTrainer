const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED_SUITS = new Set(['H', 'D']);

// Builds a card that deals in face-down and flips face-up via revealCard().
// Structure: .playing-card (slide-in-from-shoe animation) > .card-flip (3D
// flip) > .card-face.card-back + .card-face.card-front.
// `handSide` biases the slide-in direction so cards read as coming from a
// dealer's shoe near center: Player cards drift in from the right, Banker's
// from the left.
export function createCardElement(card, handSide = 'player') {
  const wrap = document.createElement('div');
  wrap.className = 'playing-card';
  wrap.style.setProperty('--from-x', handSide === 'player' ? '26px' : '-26px');
  wrap.style.setProperty('--deal-rot', `${(Math.random() * 8 - 4).toFixed(1)}deg`);
  wrap.style.setProperty('--rest-rot', `${(Math.random() * 3 - 1.5).toFixed(1)}deg`);

  const flip = document.createElement('div');
  flip.className = 'card-flip';

  const back = document.createElement('div');
  back.className = 'card-face card-back';

  const front = document.createElement('div');
  front.className = `card-face card-front ${RED_SUITS.has(card.suit) ? 'red' : 'black'}`;

  const top = document.createElement('span');
  top.className = 'rank-top';
  top.textContent = `${card.rank}${SUIT_SYMBOL[card.suit]}`;

  const center = document.createElement('span');
  center.className = 'suit-center';
  center.textContent = SUIT_SYMBOL[card.suit];

  const bottom = document.createElement('span');
  bottom.className = 'rank-bottom';
  bottom.textContent = `${card.rank}${SUIT_SYMBOL[card.suit]}`;

  front.append(top, center, bottom);
  flip.append(back, front);
  wrap.append(flip);
  return wrap;
}

// Triggers the face-down -> face-up flip transition. Call shortly after the
// card has been mounted (and ideally mid-slide) for a natural dealt-then-flipped feel.
export function revealCard(cardEl) {
  cardEl.querySelector('.card-flip').classList.add('is-face-up');
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
