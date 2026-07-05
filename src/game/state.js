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

// Atlantic City high-limit salon: 8-deck commission-free table, $100 minimum,
// $50k maximum, seated with a $50k buy-in.
const STARTING_BANKROLL = 50000;
const TABLE_MIN = 100;
const TABLE_MAX = 50000;

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
    // Ordered log of individual chip placements, so a bet can be undone one chip
    // at a time (the authentic terminal action — there is no "double" in baccarat).
    this.betStack = [];
    this.history = []; // lifetime record (stats, bankroll curve, persistence)
    this.shoeRounds = []; // just the current shoe — every road resets with it
    this.phase = PHASE.BETTING;
    this.lastRound = null;
    this.shoeNumber = 1;
    this.startingBankroll = bankroll;
    this.peakBankroll = bankroll;
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
    this.betStack.push({ spot, amount });
    return this.bets[spot];
  }

  // Removes the most recently placed chip. Returns the affected spot, or null.
  undoLastChip() {
    if (!this.canBet() || this.betStack.length === 0) return null;
    const { spot, amount } = this.betStack.pop();
    const remaining = (this.bets[spot] || 0) - amount;
    if (remaining > 0) this.bets[spot] = remaining;
    else delete this.bets[spot];
    return spot;
  }

  hasBets() {
    return this.betStack.length > 0 || this.totalWagered > 0;
  }

  clearSpot(spot) {
    if (!this.canBet()) return;
    delete this.bets[spot];
    this.betStack = this.betStack.filter((c) => c.spot !== spot);
  }

  clearAllBets() {
    if (!this.canBet()) return;
    this.bets = {};
    this.betStack = [];
  }

  rebet() {
    if (!this.canBet()) return;
    const total = SPOTS.reduce((s, spot) => s + (this.lastBets[spot] || 0), 0);
    if (total > this.bankroll) throw new Error('Insufficient bankroll to repeat last bet');
    this.bets = { ...this.lastBets };
    // Rebuild the undo stack so each repeated spot can still be undone.
    this.betStack = SPOTS.filter((s) => this.lastBets[s]).map((s) => ({ spot: s, amount: this.lastBets[s] }));
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
      this.shoeRounds = [];
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
    this.shoeRounds.push(round);
    this.peakBankroll = Math.max(this.peakBankroll, this.bankroll);
    this.lastBets = { ...this.bets };
    this.bets = {};
    this.betStack = [];
    this.lastRound = round;
    this.phase = PHASE.RESULT;
    return round;
  }

  // Called by the UI once result animations/toasts have finished.
  returnToBetting() {
    this.phase = PHASE.BETTING;
  }

  // Deals a hand purely to advance the shoe and roads (no wager, no wallet or
  // record change) — used by Drill mode to grow the board between questions.
  advanceShoe() {
    if (this.shoe.needsReshuffle()) {
      this.shoe.reset();
      this.shoeNumber += 1;
      this.road = new RoadEngine();
      this.shoeRounds = [];
    }
    const hand = playHand(() => this.shoe.draw());
    this.shoe.markHandComplete();
    const roadCode = { PLAYER: 'P', BANKER: 'B', TIE: 'TIE' }[hand.outcome];
    this.road.addResult(roadCode, { playerPair: hand.playerPair, bankerPair: hand.bankerPair });
    this.shoeRounds.push({ hand });
    return hand;
  }

  stats() {
    const rounds = this.history;
    const wins = { player: 0, banker: 0, tie: 0 };
    let biggestWin = 0;
    let longest = { outcome: null, len: 0 };
    let run = { outcome: null, len: 0 };
    const curve = [this.startingBankroll];

    for (const r of rounds) {
      const o = r.hand.outcome;
      if (o === 'PLAYER') wins.player += 1;
      else if (o === 'BANKER') wins.banker += 1;
      else wins.tie += 1;

      biggestWin = Math.max(biggestWin, r.netChange);
      curve.push(r.bankrollAfter);

      if (o === run.outcome) run.len += 1;
      else run = { outcome: o, len: 1 };
      if (run.len > longest.len) longest = { ...run };
    }

    const decisions = wins.player + wins.banker; // ties are neutral
    return {
      handsPlayed: rounds.length,
      wins,
      netSinceStart: this.bankroll - this.startingBankroll,
      startingBankroll: this.startingBankroll,
      peakBankroll: this.peakBankroll,
      biggestWin,
      currentStreak: run,
      longestStreak: longest,
      bankerRate: decisions ? wins.banker / decisions : 0,
      playerRate: decisions ? wins.player / decisions : 0,
      curve,
    };
  }

  // Serialise the lifetime record for localStorage. Roads/shoe are intentionally
  // left out — reopening the app seats you at a fresh shoe with your wallet and
  // record intact, exactly like sitting back down at the table.
  serialize() {
    return {
      v: 1,
      bankroll: this.bankroll,
      startingBankroll: this.startingBankroll,
      peakBankroll: this.peakBankroll,
      shoeNumber: this.shoeNumber,
      payouts: { ...this.payouts },
      rounds: this.history.map((r) => ({
        outcome: r.hand.outcome,
        netChange: r.netChange,
        bankrollAfter: r.bankrollAfter,
        stake: r.stake,
      })),
    };
  }

  loadSession(data) {
    if (!data || data.v !== 1) return;
    this.bankroll = data.bankroll;
    this.startingBankroll = data.startingBankroll ?? STARTING_BANKROLL;
    this.peakBankroll = data.peakBankroll ?? this.bankroll;
    this.shoeNumber = data.shoeNumber ?? 1;
    if (data.payouts) this.payouts = { ...DEFAULT_PAYOUTS, ...data.payouts };
    this.history = (data.rounds || []).map((r) => ({
      hand: { outcome: r.outcome },
      netChange: r.netChange,
      bankrollAfter: r.bankrollAfter,
      stake: r.stake,
    }));
  }
}

export { STARTING_BANKROLL, TABLE_MIN, TABLE_MAX };
