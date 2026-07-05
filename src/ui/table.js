import { createCardElement, revealCard, dealSequence } from './cards.js';
import { renderChipStack, formatCurrency } from './chips.js';
import { handTotal } from '../game/rules.js';

const CARD_STEP_MS = 300;
const THIRD_CARD_PAUSE_MS = 480; // the dramatic "does she draw?" beat before any 3rd card
const FLIP_DELAY_MS = 180; // flip mid-slide, so the card reads as dealt-then-turned

export class TableView {
  constructor(root) {
    this.root = root;
    this.spotEls = {};
    root.querySelectorAll('.bet-spot').forEach((el) => {
      this.spotEls[el.dataset.spot] = el;
    });
    this.playerCards = root.querySelector('#player-cards');
    this.bankerCards = root.querySelector('#banker-cards');
    this.playerTotal = root.querySelector('#player-total');
    this.bankerTotal = root.querySelector('#banker-total');
    this.resultBanner = root.querySelector('#result-banner');
  }

  updateBets(bets) {
    for (const [spot, el] of Object.entries(this.spotEls)) {
      const amount = bets[spot] || 0;
      const stack = el.querySelector('[data-stack]');
      const badge = el.querySelector('[data-stake]');
      renderChipStack(stack, amount);
      badge.textContent = formatCurrency(amount);
      badge.classList.toggle('show', amount > 0);
      el.classList.toggle('has-bet', amount > 0);
      el.classList.remove('spot-win', 'spot-push', 'spot-lose');
    }
  }

  clearRound() {
    this.playerCards.innerHTML = '';
    this.bankerCards.innerHTML = '';
    this.playerTotal.textContent = '';
    this.bankerTotal.textContent = '';
    this.resultBanner.classList.remove('show');
    this.resultBanner.textContent = '';
    for (const el of Object.values(this.spotEls)) {
      el.classList.remove('spot-win', 'spot-push', 'spot-lose');
    }
  }

  async dealAnimated(hand) {
    this.clearRound();
    const sequence = dealSequence(hand);
    for (let i = 0; i < sequence.length; i += 1) {
      const step = sequence[i];
      // The 5th/6th deals are third cards — hold a beat first for drama.
      if (step.index === 2) await wait(THIRD_CARD_PAUSE_MS);

      const container = step.hand === 'player' ? this.playerCards : this.bankerCards;
      const cardEl = createCardElement(step.card, step.hand);
      container.appendChild(cardEl);
      await wait(FLIP_DELAY_MS);
      revealCard(cardEl);
      await wait(CARD_STEP_MS - FLIP_DELAY_MS);
      const cardsSoFar = (step.hand === 'player' ? hand.player : hand.banker).slice(0, step.index + 1);
      const totalEl = step.hand === 'player' ? this.playerTotal : this.bankerTotal;
      totalEl.textContent = String(handTotal(cardsSoFar));
    }
  }

  // Returns the DOM elements of any spots that hit a headline bonus (for a burst).
  showResult(round) {
    const { hand, settlement } = round;
    const labels = { PLAYER: 'Player Wins', BANKER: 'Banker Wins', TIE: 'Tie' };
    let text = labels[hand.outcome];
    if (hand.outcome === 'BANKER' && hand.bankerThreeCardSeven) text += ' ☀ Sun 7!';
    if (hand.outcome === 'PLAYER' && hand.playerThreeCardEight) text += ' \u{1F311} Moon 8!';

    // Name a winning bonus tier so the scaling paytable is learnable through play.
    let sub = '';
    const bonus = settlement.playerBonus?.result === 'win' ? settlement.playerBonus
      : settlement.bankerBonus?.result === 'win' ? settlement.bankerBonus : null;
    if (bonus?.tier) {
      const side = settlement.playerBonus?.result === 'win' ? 'Player' : 'Banker';
      sub = `${side} Bonus · ${bonus.tier} · ${bonus.mult}:1`;
    }

    this.resultBanner.innerHTML = `${escapeHtml(text)}${sub ? `<span class="banner-sub">${escapeHtml(sub)}</span>` : ''}`;
    this.resultBanner.classList.add('show');

    const jackpots = [];
    for (const [spot, el] of Object.entries(this.spotEls)) {
      const outcome = settlement[spot];
      if (!outcome) continue;
      if (outcome.result === 'win') {
        el.classList.add('spot-win');
        if ((spot === 'playerBonus' || spot === 'bankerBonus') && outcome.mult >= 10) jackpots.push(el);
        if ((spot === 'sun7' || spot === 'moon8')) jackpots.push(el);
      } else if (outcome.result === 'push') {
        el.classList.add('spot-push');
      } else {
        el.classList.add('spot-lose');
      }
    }
    return jackpots;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
