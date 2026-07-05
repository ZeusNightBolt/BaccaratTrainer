import { Shoe } from './shoe.js';
import { playHand } from './rules.js';
import {
  resolveBets,
  SPOTS,
  DEFAULT_PAYOUTS,
  ADJUSTABLE_SPOTS,
  MIN_ADJUSTABLE_PAYOUT,
  MAX_ADJUSTABLE_PAYOUT,
} from './sidebets.js';
import { RoadEngine } from './bigroad.js';

const STARTING_BANKROLL = 1000;
const TABLE_MIN = 5;
const TABLE_MAX = 5000;

export const PHASE = { BETTING: 'BETTING', DEALING: 'DEALING', RESULT: 'RESULT' };

export class GameState {
  constructor({ bankroll = STARTING_BANKROLL, rng = Math.random, deckCount = 8 } = {}) {
    this.bankroll = bankroll;
    this.tableMin = TABLE_MIN;
    this.tableMax = TABLE_MAX;
    this.shoe = new Shoe({ rng, deckCount });
    this.road = new RoadEngine();
    this.bets = {};
    this.lastBets = {};
    this.history = [];
    this.phase = PHASE.BETTING;
    this.lastRound = null;
    this.shoeNumber = 1;
    this.payouts = { ...DEFAULT_PAYOUTS };
  }

  // Sun 7 / Moon 8 paytables vary by casino; let the player retune them between hands.
  setSideBetPayout(spot, ratio) {
    if (!ADJUSTABLE_SPOTS.includes(spot)) throw new Error(`${spot} payout is not adjustable`);
    if (!this.canBet()) throw new Error('Payouts can only be changed between hands');
    if (!Number.isInteger(ratio) || ratio < MIN_ADJUSTABLE_PAYOUT || ratio > MAX_ADJUSTABLE_PAYOUT) {
      throw new Error(`Payout must be a whole number between ${MIN_ADJUSTABLE_PAYOUT} and ${MAX_ADJUSTABLE_PAYOUT}`);
    }
    this.payouts[spot] = ratio;
  }

  resetSideBetPayouts() {
    for (const spot of ADJUSTABLE_SPOTS) this.payouts[spot] = DEFAULT_PAYOUTS[spot];
  }

  get totalWagered() {
    return SPOTS.reduce((sum, spot) => sum + (this.bets[spot] || 0), 0);
  }

  canBet() {
    return this.phase === PHASE.BETTING;
  }

  placeChip(spot, amount) {
    if (!this.canBet()) throw new Error('Betting is closed for this round');
    if (!SPOTS.includes(spot)) throw new Error(`Unknown spot: ${spot}`);
    const current = this.bets[spot] || 0;
    const next = current + amount;
    const wouldBeTotal = this.totalWagered - current + next;
    if (wouldBeTotal > this.bankroll) throw new Error('Insufficient bankroll');
    if (next > this.tableMax) throw new Error(`Table max is ${this.tableMax}`);
    this.bets[spot] = next;
    return this.bets[spot];
  }

  clearSpot(spot) {
    if (!this.canBet()) return;
    delete this.bets[spot];
  }

  clearAllBets() {
    if (!this.canBet()) return;
    this.bets = {};
  }

  rebet() {
    if (!this.canBet()) return;
    const total = SPOTS.reduce((s, spot) => s + (this.lastBets[spot] || 0), 0);
    if (total > this.bankroll) throw new Error('Insufficient bankroll to repeat last bet');
    this.bets = { ...this.lastBets };
  }

  hasValidBet() {
    return this.totalWagered >= this.tableMin;
  }

  // Deducts the wager, deals the hand, resolves side bets, updates bankroll/history/roads.
  // Returns the full round detail for the UI to animate and render.
  playRound() {
    if (!this.canBet()) throw new Error('A round is already in progress');
    if (!this.hasValidBet()) throw new Error(`Minimum bet is ${this.tableMin}`);
    if (this.shoe.needsReshuffle()) {
      this.shoe.reset();
      this.shoeNumber += 1;
      this.road = new RoadEngine();
    }

    this.phase = PHASE.DEALING;
    const stake = this.totalWagered;
    this.bankroll -= stake;

    const hand = playHand(() => this.shoe.draw());
    this.shoe.markHandComplete();

    const { settlement, totalReturned, netChange } = resolveBets(this.bets, hand, this.payouts);
    this.bankroll += totalReturned;

    const roadCode = { PLAYER: 'P', BANKER: 'B', TIE: 'TIE' }[hand.outcome];
    this.road.addResult(roadCode, { playerPair: hand.playerPair, bankerPair: hand.bankerPair });

    const round = {
      hand,
      bets: { ...this.bets },
      settlement,
      stake,
      totalReturned,
      netChange,
      bankrollAfter: this.bankroll,
      handNumber: this.history.length + 1,
      shoeNumber: this.shoeNumber,
      penetration: this.shoe.penetration(),
    };

    this.history.push(round);
    this.lastBets = { ...this.bets };
    this.bets = {};
    this.lastRound = round;
    this.phase = PHASE.RESULT;
    return round;
  }

  // Called by the UI once result animations/toasts have finished.
  returnToBetting() {
    this.phase = PHASE.BETTING;
  }

  stats() {
    const rounds = this.history;
    const wins = { player: 0, banker: 0, tie: 0 };
    for (const r of rounds) {
      if (r.hand.outcome === 'PLAYER') wins.player += 1;
      else if (r.hand.outcome === 'BANKER') wins.banker += 1;
      else wins.tie += 1;
    }
    return {
      handsPlayed: rounds.length,
      wins,
      netSinceStart: this.bankroll - STARTING_BANKROLL,
      startingBankroll: STARTING_BANKROLL,
    };
  }
}

export { STARTING_BANKROLL, TABLE_MIN, TABLE_MAX };
