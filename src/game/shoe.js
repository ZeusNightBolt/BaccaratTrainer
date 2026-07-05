import { RANKS, SUITS, cardValue } from './rules.js';

const DEFAULT_DECK_COUNT = 8;
// Real shoes place the cut card ~14-16 cards from the back; we stop a new shoe
// once fewer than this many cards remain, matching typical AC/Resorts World cut placement.
const CUT_CARD_RESERVE = 16;

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function createShoeCards(deckCount = DEFAULT_DECK_COUNT) {
  const cards = [];
  for (let i = 0; i < deckCount; i += 1) {
    cards.push(...createDeck());
  }
  return cards;
}

// Fisher-Yates shuffle using an injectable RNG so tests can be deterministic.
export function shuffle(cards, rng = Math.random) {
  const arr = cards.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Burns cards per the value of the first drawn card (standard casino procedure),
// which sets how many cards deep the first "known" position is.
function burn(cards) {
  const rest = cards.slice();
  const first = rest.shift();
  let burnCount = cardValue(first.rank);
  if (burnCount === 0) burnCount = 10; // 10/J/Q/K burn 10
  const burned = rest.splice(0, burnCount);
  return { rest, burnedCount: burned.length + 1 };
}

export class Shoe {
  constructor({ deckCount = DEFAULT_DECK_COUNT, rng = Math.random, cutCardReserve = CUT_CARD_RESERVE } = {}) {
    this.deckCount = deckCount;
    this.rng = rng;
    this.cutCardReserve = cutCardReserve;
    this.reset();
  }

  reset() {
    const shuffled = shuffle(createShoeCards(this.deckCount), this.rng);
    const { rest, burnedCount } = burn(shuffled);
    this.cards = rest;
    this.burnedCount = burnedCount;
    this.dealtCount = 0;
    this.handsThisShoe = 0;
  }

  get remaining() {
    return this.cards.length;
  }

  // True once the cut card has been reached and the shoe should be replaced
  // before the next hand begins (never mid-hand).
  needsReshuffle() {
    return this.cards.length < this.cutCardReserve;
  }

  draw() {
    if (this.cards.length === 0) {
      throw new Error('Shoe is empty');
    }
    this.dealtCount += 1;
    return this.cards.shift();
  }

  markHandComplete() {
    this.handsThisShoe += 1;
  }

  // 0..1, how deep into the shoe we are, for a penetration indicator.
  penetration() {
    const total = this.deckCount * 52 - this.burnedCount;
    return total === 0 ? 0 : this.dealtCount / total;
  }
}
