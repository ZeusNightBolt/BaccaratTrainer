import { createCardElement, dealSequence } from './cards.js';
import { renderChipStack, formatCurrency } from './chips.js';
import { handTotal } from '../game/rules.js';

const CARD_STEP_MS = 260;

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
      const container = step.hand === 'player' ? this.playerCards : this.bankerCards;
      container.appendChild(createCardElement(step.card, 0));
      await wait(CARD_STEP_MS);
      const cardsSoFar = (step.hand === 'player' ? hand.player : hand.banker).slice(0, step.index + 1);
      const totalEl = step.hand === 'player' ? this.playerTotal : this.bankerTotal;
      totalEl.textContent = String(handTotal(cardsSoFar));
    }
  }

  showResult(round) {
    const { hand, settlement } = round;
    const labels = { PLAYER: 'Player Wins', BANKER: 'Banker Wins', TIE: 'Tie' };
    let text = labels[hand.outcome];
    if (hand.outcome === 'BANKER' && hand.bankerThreeCardSeven) text += ' ☀ Sun 7!';
    if (hand.outcome === 'PLAYER' && hand.playerThreeCardEight) text += ' \u{1F311} Moon 8!';
    this.resultBanner.textContent = text;
    this.resultBanner.classList.add('show');

    for (const [spot, el] of Object.entries(this.spotEls)) {
      const outcome = settlement[spot];
      if (!outcome) continue;
      if (outcome.result === 'win') el.classList.add('spot-win');
      else if (outcome.result === 'push') el.classList.add('spot-push');
      else el.classList.add('spot-lose');
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
