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
  g.placeChip('player', 10);
  g.playRound();
  assert.throws(() => g.playRound());
});

test('rebet restores the previous wager after returning to betting', () => {
  const g = new GameState({ bankroll: 1000 });
  g.placeChip('banker', 20);
  g.placeChip('tie', 5);
  g.playRound();
  g.returnToBetting();
  g.rebet();
  assert.deepEqual(g.bets, { banker: 20, tie: 5 });
});

test('history and stats accumulate across rounds', () => {
  const g = new GameState({ bankroll: 1000 });
  for (let i = 0; i < 3; i += 1) {
    g.placeChip('player', 10);
    g.playRound();
    g.returnToBetting();
  }
  const stats = g.stats();
  assert.equal(stats.handsPlayed, 3);
  assert.equal(stats.wins.player + stats.wins.banker + stats.wins.tie, 3);
});

test('shoe reshuffle resets the road engine for a fresh shoe', () => {
  const g = new GameState({ bankroll: 100000, deckCount: 1 });
  const initialShoeNumber = g.shoeNumber;
  let reshuffled = false;
  for (let i = 0; i < 40 && !reshuffled; i += 1) {
    g.placeChip('player', 5);
    g.playRound();
    g.returnToBetting();
    if (g.shoeNumber > initialShoeNumber) reshuffled = true;
  }
  assert.equal(reshuffled, true);
});
