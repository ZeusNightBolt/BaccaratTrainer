import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, createShoeCards, shuffle, Shoe, cryptoRandomInt } from './shoe.js';

test('createDeck has 52 unique rank/suit combinations', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  const keys = new Set(deck.map((c) => `${c.rank}${c.suit}`));
  assert.equal(keys.size, 52);
});

test('createShoeCards multiplies the deck by the deck count', () => {
  assert.equal(createShoeCards(8).length, 8 * 52);
});

test('shuffle is a permutation (same multiset, injectable RNG)', () => {
  const cards = createDeck();
  const rng = (() => {
    let seed = 42;
    return () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
  })();
  const shuffled = shuffle(cards, rng);
  assert.equal(shuffled.length, cards.length);
  const before = cards.map((c) => `${c.rank}${c.suit}`).sort();
  const after = shuffled.map((c) => `${c.rank}${c.suit}`).sort();
  assert.deepEqual(after, before);
});

test('cryptoRandomInt stays in [0, max) and covers every residue', () => {
  const max = 7;
  const seen = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const v = cryptoRandomInt(max);
    assert.ok(Number.isInteger(v) && v >= 0 && v < max);
    seen.add(v);
  }
  assert.equal(seen.size, max);
  assert.equal(cryptoRandomInt(1), 0);
  assert.throws(() => cryptoRandomInt(0));
  assert.throws(() => cryptoRandomInt(1.5));
});

test('default (crypto) shuffle is a permutation of the deck', () => {
  const cards = createDeck();
  const shuffled = shuffle(cards);
  assert.equal(shuffled.length, cards.length);
  const before = cards.map((c) => `${c.rank}${c.suit}`).sort();
  const after = shuffled.map((c) => `${c.rank}${c.suit}`).sort();
  assert.deepEqual(after, before);
});

test('Shoe burns cards on reset and tracks remaining/penetration', () => {
  const shoe = new Shoe({ deckCount: 1, rng: () => 0.999999 });
  const totalBeforeBurn = 52;
  assert.ok(shoe.remaining < totalBeforeBurn);
  const initialRemaining = shoe.remaining;
  shoe.draw();
  assert.equal(shoe.remaining, initialRemaining - 1);
  assert.ok(shoe.penetration() > 0);
});

test('Shoe signals reshuffle once the cut-card reserve is reached', () => {
  const shoe = new Shoe({ deckCount: 1, cutCardReserve: 10, rng: () => 0 });
  assert.equal(shoe.needsReshuffle(), false);
  while (shoe.remaining >= 10) shoe.draw();
  assert.equal(shoe.needsReshuffle(), true);
});

test('Shoe.draw throws once empty', () => {
  const shoe = new Shoe({ deckCount: 1, cutCardReserve: 0, rng: () => 0 });
  while (shoe.remaining > 0) shoe.draw();
  assert.throws(() => shoe.draw());
});
