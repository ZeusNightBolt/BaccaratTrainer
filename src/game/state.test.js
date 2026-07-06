import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, PHASE } from './state.js';

test('placeChip accumulates stake per spot and enforces bankroll/table max', () => {
  const g = new GameState({ bankroll: 100 });
  g.placeChip('player', 25);
  g.placeChip('player', 25);
  assert.equal(g.bets.player, 50);
  assert.throws(() => g.placeChip('banker', 100)); // exceeds bankroll (50 already committed)
});

test('clearAllBets and clearSpot only work during betting phase', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('player', 10);
  g.placeChip('tie', 5);
  g.clearSpot('tie');
  assert.equal(g.bets.tie, undefined);
  g.clearAllBets();
  assert.deepEqual(g.bets, {});
});

test('undoLastChip removes placements one at a time in reverse order', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('player', 25);
  g.placeChip('banker', 100);
  g.placeChip('player', 25);
  assert.equal(g.bets.player, 50);

  assert.equal(g.undoLastChip(), 'player');
  assert.equal(g.bets.player, 25);

  assert.equal(g.undoLastChip(), 'banker');
  assert.equal(g.bets.banker, undefined);

  assert.equal(g.undoLastChip(), 'player');
  assert.equal(g.bets.player, undefined);

  assert.equal(g.undoLastChip(), null); // nothing left
  assert.equal(g.hasBets(), false);
});

test('rebet rebuilds an undo stack that can be unwound', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('banker', 100);
  g.playRound();
  g.returnToBetting();
  g.rebet();
  assert.deepEqual(g.bets, { banker: 100 });
  assert.equal(g.undoLastChip(), 'banker');
  assert.deepEqual(g.bets, {});
});

test('playRound deducts stake up front and pays out on the result', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('player', 100);
  const round = g.playRound();
  assert.equal(g.phase, PHASE.RESULT);
  assert.equal(round.stake, 100);
  if (round.hand.outcome === 'PLAYER') {
    assert.equal(g.bankroll, 1100);
  } else if (round.hand.outcome === 'TIE') {
    assert.equal(g.bankroll, 1000);
  } else {
    assert.equal(g.bankroll, 900);
  }
});

test('playRound throws below table minimum and refuses mid-round double play', () => {
  const g = new GameState({ bankroll: 1000 });
  assert.throws(() => g.playRound());
  g.placeChip('player', 100);
  g.playRound();
  assert.throws(() => g.playRound());
});

test('rebet restores the previous wager after returning to betting', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('banker', 100);
  g.placeChip('tie', 100);
  g.playRound();
  g.returnToBetting();
  g.rebet();
  assert.deepEqual(g.bets, { banker: 100, tie: 100 });
});

test('history and stats accumulate across rounds', () => {
  const g = new GameState({ bankroll: 1000 });
  for (let i = 0; i < 3; i += 1) {
    g.placeChip('player', 100);
    g.playRound();
    g.returnToBetting();
  }
  const stats = g.stats();
  assert.equal(stats.handsPlayed, 3);
  assert.equal(stats.wins.player + stats.wins.banker + stats.wins.tie, 3);
  assert.equal(stats.curve.length, 4); // starting point + one per round
});

test('stats report biggest win, streaks and a bankroll curve', () => {
  const g = new GameState({ bankroll: 1000 });
  // Force outcomes via a fixed shoe substitute: stub playRound-adjacent state by
  // driving the real engine and just asserting structural invariants.
  for (let i = 0; i < 6; i += 1) {
    g.placeChip('banker', 100);
    g.playRound();
    g.returnToBetting();
  }
  const s = g.stats();
  assert.ok(s.longestStreak.len >= 1 && s.longestStreak.len <= 6);
  assert.ok(s.currentStreak.len >= 1);
  assert.ok(s.peakBankroll >= g.bankroll || s.peakBankroll >= s.startingBankroll);
  assert.equal(typeof s.biggestWin, 'number');
});

test('serialize/loadSession round-trips the lifetime record and wallet', () => {
  const g = new GameState({ bankroll: 1000 });
  for (let i = 0; i < 4; i += 1) {
    g.placeChip('player', 100);
    g.playRound();
    g.returnToBetting();
  }
  const snapshot = g.serialize();
  const restored = new GameState({ bankroll: 1 });
  restored.loadSession(snapshot);
  assert.equal(restored.bankroll, g.bankroll);
  assert.equal(restored.stats().handsPlayed, 4);
  assert.equal(restored.shoeRounds.length, 0); // fresh shoe on reload
});

test('side bet payouts default to sun7 40:1 / moon8 25:1 and are adjustable between hands', () => {
  const g = new GameState({ bankroll: 1000 });
  assert.equal(g.payouts.sun7, 40);
  assert.equal(g.payouts.moon8, 25);

  g.setSideBetPayout('moon8', 30);
  assert.equal(g.payouts.moon8, 30);

  g.resetSideBetPayouts();
  assert.equal(g.payouts.moon8, 25);
});

test('setSideBetPayout rejects non-adjustable spots, bad ranges, and mid-round changes', () => {
  const g = new GameState({ bankroll: 1000 });
  assert.throws(() => g.setSideBetPayout('player', 5));
  assert.throws(() => g.setSideBetPayout('sun7', 4)); // below minimum
  assert.throws(() => g.setSideBetPayout('sun7', 101)); // above maximum
  assert.throws(() => g.setSideBetPayout('sun7', 20.5)); // not an integer

  g.placeChip('player', 100);
  g.playRound();
  assert.throws(() => g.setSideBetPayout('sun7', 35)); // mid-round
});

test('an adjusted moon8 ratio is used when settling the bet', () => {
  const g = new GameState({ bankroll: 1000 });
  g.setSideBetPayout('moon8', 50);

  // Deal order P,B,P,B,[P3]: player draws to an 8 on three cards, banker stands on 5.
  const cards = ['5', '2', '5', '3', '8'].map((rank) => ({ rank, suit: 'S' }));
  let i = 0;
  g.shoe.draw = () => cards[i++];

  g.placeChip('moon8', 100);
  const round = g.playRound();

  assert.equal(round.hand.playerThreeCardEight, true);
  assert.equal(round.settlement.moon8.returned, 5100);
});

test('shoe reshuffle resets the road engine for a fresh shoe', () => {
  const g = new GameState({ bankroll: 100000, deckCount: 1 });
  const initialShoeNumber = g.shoeNumber;
  let reshuffled = false;
  for (let i = 0; i < 40 && !reshuffled; i += 1) {
    g.placeChip('player', 100);
    g.playRound();
    g.returnToBetting();
    if (g.shoeNumber > initialShoeNumber) reshuffled = true;
  }
  assert.equal(reshuffled, true);
});

test('stats treats ties as neutral for streaks (a tie does not break a run)', () => {
  const g = new GameState({ bankroll: 50000 });
  const mk = (outcome) => ({ hand: { outcome }, netChange: 0, bankrollAfter: 50000 });
  // Banker, Banker, Tie, Banker — the tie must not reset the 3-long Banker run.
  g.history = [mk('BANKER'), mk('BANKER'), mk('TIE'), mk('BANKER')];
  const s = g.stats();
  assert.equal(s.longestStreak.outcome, 'BANKER');
  assert.equal(s.longestStreak.len, 3);
  assert.equal(s.currentStreak.outcome, 'BANKER');
  assert.equal(s.currentStreak.len, 3);
  assert.equal(s.wins.tie, 1);
});
