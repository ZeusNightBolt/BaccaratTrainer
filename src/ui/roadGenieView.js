import { consultGenie } from '../game/genieOracle.js';

// The floating Genie orb. Where the Coach reasons, the Genie *feels* — it consults
// genieOracle for a straight-up "bet this" call plus the occasional bonus hedge,
// prints it in a fortune-teller voice, and lights the recommended spots on the felt
// in a mystic glow while its panel is open.
export class RoadGenieView {
  constructor(root, game, { spotEls = {} } = {}) {
    this.game = game;
    this.spotEls = spotEls;
    this.orb = root.querySelector('#genie-orb');
    this.panel = root.querySelector('#genie-panel');
    this.body = root.querySelector('#genie-body');
    this.closeBtn = root.querySelector('#genie-close');
    this.askBtn = root.querySelector('#genie-ask');
    this.reading = null;

    this.orb.addEventListener('click', () => this.toggle());
    this.closeBtn.addEventListener('click', () => this.setOpen(false));
    if (this.askBtn) {
      this.askBtn.addEventListener('click', () => {
        this.consult();
        this.orb.classList.remove('has-signal');
      });
    }

    this.consult();
  }

  toggle() {
    this.setOpen(this.panel.hidden);
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.orb.setAttribute('aria-expanded', String(open));
    if (open) this.orb.classList.remove('has-signal');
    this.applyHighlight();
  }

  // Called by the app after each hand — re-rolls the vibe for the next bet.
  render() {
    this.consult();
  }

  consult() {
    this.reading = consultGenie(this.game);
    this.paint();
    this.applyHighlight();
    // Nudge the user (orb badge) when the Genie is calling a bonus hedge.
    if (this.panel.hidden) this.orb.classList.toggle('has-signal', !!this.reading.bonus);
  }

  paint() {
    const r = this.reading;
    this.body.innerHTML = '';

    const mood = document.createElement('p');
    mood.className = 'genie-mood';
    mood.textContent = r.mood;
    this.body.appendChild(mood);

    const rec = document.createElement('div');
    rec.className = `genie-rec pick-${r.main.spot}`;
    rec.innerHTML = `<span class="genie-rec-lead">Bet</span><span class="genie-rec-spot">${r.main.label}</span>`;
    this.body.appendChild(rec);

    for (const line of r.lines.slice(1)) {
      const p = document.createElement('p');
      p.className = 'genie-line';
      p.textContent = line;
      this.body.appendChild(p);
    }

    if (r.bonus) {
      const bonus = document.createElement('div');
      bonus.className = 'genie-bonus';
      bonus.innerHTML =
        `<span class="genie-bonus-head"><span class="genie-bonus-tag">Hedge</span><b>${r.bonus.label}</b></span>` +
        `<span class="genie-bonus-note">${r.bonus.note}</span>`;
      this.body.appendChild(bonus);
    }
  }

  clearHighlight() {
    Object.values(this.spotEls).forEach((el) => el && el.classList.remove('genie-pick', 'genie-pick-bonus'));
  }

  applyHighlight() {
    this.clearHighlight();
    if (this.panel.hidden || !this.reading || !this.game.canBet()) return;
    const main = this.spotEls[this.reading.main.spot];
    if (main) main.classList.add('genie-pick');
    if (this.reading.bonus) {
      const bonusEl = this.spotEls[this.reading.bonus.spot];
      if (bonusEl) bonusEl.classList.add('genie-pick-bonus');
    }
  }
}
