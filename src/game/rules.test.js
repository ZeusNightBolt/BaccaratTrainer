import test from 'node:test';
import assert from 'node:assert/strict';
import { handTotal, isNatural, playerDraws, bankerDraws, decideOutcome, isPair, playHand, OUTCOME } from './rules.js';

const c = (rank, suit = 'S') => ({ rank, suit });

test('handTotal sums mod 10 with face cards as 0 and aces as 1', () => {
  assert.equal(handTotal([c('K'), c('Q')]), 0);
  assert.equal(handTotal([c('A'), c('9')]), 0);
  assert.equal(handTotal([c('7'), c('8')]), 5);
  assert.equal(handTotal([c('5'), c('5'), c('5')]), 5);
});

test('isNatural true only for two-card 8 or 9', () => {
  assert.equal(isNatural([c('8'), c('A')]), true); // 9
  assert.equal(isNatural([c('8'), c('K')]), true); // 8
  assert.equal(isNatural([c('7'), c('K')]), false); // 7
  assert.equal(isNatural([c('8'), c('A'), c('K')]), false); // three cards, never natural
});

test('playerDraws on 0-5, stands on 6-7', () => {
  assert.equal(playerDraws([c('2'), c('3')]), true); // 5
  assert.equal(playerDraws([c('9'), c('9')]), false); // 8
  assert.equal(playerDraws([c('3'), c('3')]), false); // 6
  assert.equal(playerDraws([c('3'), c('4')]), false); // 7
});

test('bankerDraws: totals 0-2 always draw, 7 never draws', () => {
  assert.equal(bankerDraws([c('K'), c('K')], null), true); // 0
  assert.equal(bankerDraws([c('K'), c('2')], c('5')), true); // 2
  assert.equal(bankerDraws([c('K'), c('7')], c('5')), false); // 7
});

test('bankerDraws total 3: draws unless player third card is 8', () => {
  assert.equal(bankerDraws([c('K'), c('3')], c('8')), false);
  assert.equal(bankerDraws([c('K'), c('3')], c('7')), true);
  assert.equal(bankerDraws([c('K'), c('3')], null), true); // player stood -> banker draws on <=5
});

test('bankerDraws total 4: draws on player third card 2-7', () => {
  for (const rank of ['2', '3', '4', '5', '6', '7']) {
    assert.equal(bankerDraws([c('K'), c('4')], c(rank)), true, `rank ${rank}`);
  }
  for (const rank of ['A', '8', '9']) {
    assert.equal(bankerDraws([c('K'), c('4')], c(rank)), false, `rank ${rank}`);
  }
});

test('bankerDraws total 5: draws on player third card 4-7', () => {
  for (const rank of ['4', '5', '6', '7']) {
    assert.equal(bankerDraws([c('K'), c('5')], c(rank)), true, `rank ${rank}`);
  }
  for (const rank of ['A', '2', '3', '8', '9', '10']) {
    assert.equal(bankerDraws([c('K'), c('5')], c(rank)), false, `rank ${rank}`);
  }
});

test('bankerDraws total 6: draws only on player third card 6 or 7', () => {
  assert.equal(bankerDraws([c('K'), c('6')], c('6')), true);
  assert.equal(bankerDraws([c('K'), c('6')], c('7')), true);
  assert.equal(bankerDraws([c('K'), c('6')], c('5')), false);
});

test('bankerDraws total 6 with player standing: banker stands (6 is in the "stand on 6-7" range)', () => {
  assert.equal(bankerDraws([c('K'), c('6')], null), false);
});

test('decideOutcome picks higher total, ties when equal', () => {
  assert.equal(decideOutcome(8, 7), OUTCOME.PLAYER);
  assert.equal(decideOutcome(7, 8), OUTCOME.BANKER);
  assert.equal(decideOutcome(5, 5), OUTCOME.TIE);
});

test('isPair checks first two ranks match', () => {
  assert.equal(isPair([c('9'), c('9'), c('2')]), true);
  assert.equal(isPair([c('9'), c('8')]), false);
});

test('playHand: both naturals stop the deal at two cards each', () => {
  // Dealing order is P,B,P,B: player gets 9,K (=9); banker gets A,8 (=9).
  const cards = [c('9'), c('A'), c('K'), c('8')];
  let i = 0;
  const draw = () => cards[i++];
  const hand = playHand(draw);
  assert.equal(hand.player.length, 2);
  assert.equal(hand.banker.length, 2);
  assert.equal(hand.playerTotal, 9);
  assert.equal(hand.bankerTotal, 9);
  assert.equal(hand.outcome, OUTCOME.TIE);
});

test('playHand: player draws third card on low total, banker follows table', () => {
  // Player: 2,3 (total 5, draws). Third card: 4 -> player total 9.
  // Banker: 6,K (total 6). Player third card is 4 -> banker total 6 stands only on 6/7 draw rule -> stand.
  const cards = [c('2'), c('6'), c('3'), c('K'), c('4')];
  let i = 0;
  const draw = () => cards[i++];
  const hand = playHand(draw);
  assert.equal(hand.player.length, 3);
  assert.equal(hand.playerTotal, 9);
  assert.equal(hand.banker.length, 2);
  assert.equal(hand.bankerTotal, 6);
  assert.equal(hand.outcome, OUTCOME.PLAYER);
});

test('playHand flags a banker three-card seven for Sun 7', () => {
  // Dealing order P,B,P,B,P3,B3. Player: 2,2 -> draws, 3rd card 2 -> total 6.
  // Banker: 2,2 -> draws (player's 3rd card 2 is in the 2-7 range) -> 3rd card 3 -> total 7.
  const cards = [c('2'), c('2'), c('2'), c('2'), c('2'), c('3')];
  let i = 0;
  const draw = () => cards[i++];
  const hand = playHand(draw);
  assert.equal(hand.player.length, 3);
  assert.equal(hand.playerTotal, 6);
  assert.equal(hand.banker.length, 3);
  assert.equal(hand.bankerTotal, 7);
  assert.equal(hand.outcome, OUTCOME.BANKER);
  assert.equal(hand.bankerThreeCardSeven, true);
});
