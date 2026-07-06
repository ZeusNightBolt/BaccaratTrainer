import { consultGenie } from '../game/genieOracle.js';

// The floating Genie orb. Where the Coach reasons, the Genie *feels* — it consults
// genieOracle for a straight-up "bet this" call, an emotional heartbeat, a jittery
// spiral of second-guessing thoughts, an occasional "trim your unit" warning and a
// bonus hedge, then lights the recommended spots on the felt in a mystic glow. The
// orb itself beats faster or slower depending on the Genie's current mood.
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
        this.askBtn.classList.remove('is-rerolling');
        // force reflow so the shake animation restarts on every click
        void this.askBtn.offsetWidth;
        this.askBtn.classList.add('is-rerolling');
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
    // the orb beats to the Genie's mood, even while closed
    this.orb.dataset.rate = this.reading.heartRate;
    // Nudge the user (orb badge) when the Genie is calling a bonus hedge or a trim.
    if (this.panel.hidden) this.orb.classList.toggle('has-signal', !!this.reading.bonus || !!this.reading.stake);
  }

  paint() {
    const r = this.reading;
    this.body.innerHTML = '';
    let step = 0;
    const stagger = (el) => {
      el.style.animationDelay = `${step * 55}ms`;
      step += 1;
      return el;
    };

    // ---- emotion + beating heart ----
    const emo = document.createElement('div');
    emo.className = 'genie-emotion';
    emo.dataset.rate = r.heartRate;
    emo.innerHTML =
      `<span class="genie-heart" aria-hidden="true">🫀</span>` +
      `<span class="genie-emo-face">${r.emotion.emoji}</span>` +
      `<span class="genie-emo-label">${r.emotion.label}</span>`;
    this.body.appendChild(stagger(emo));

    // ---- the call ----
    const rec = document.createElement('div');
    rec.className = `genie-rec pick-${r.main.spot}`;
    rec.innerHTML = `<span class="genie-rec-lead">Bet</span><span class="genie-rec-spot">${r.main.label}</span>`;
    this.body.appendChild(stagger(rec));

    // ---- stake advice (trim / press) ----
    if (r.stake) {
      const stake = document.createElement('div');
      stake.className = `genie-stake stake-${r.stake.level}`;
      stake.innerHTML =
        `<span class="genie-stake-head">${r.stake.level === 'trim' ? '🛟' : '🚀'} ${r.stake.label}</span>` +
        `<span class="genie-stake-note">${r.stake.note}</span>`;
      this.body.appendChild(stagger(stake));
    }

    // ---- the spiral of thoughts ----
    for (const line of r.lines) {
      const p = document.createElement('p');
      p.className = 'genie-line';
      p.textContent = line;
      this.body.appendChild(stagger(p));
    }

    // ---- bonus hedge ----
    if (r.bonus) {
      const bonus = document.createElement('div');
      bonus.className = 'genie-bonus';
      bonus.innerHTML =
        `<span class="genie-bonus-head"><span class="genie-bonus-tag">Hedge</span><b>${r.bonus.label}</b></span>` +
        `<span class="genie-bonus-note">${r.bonus.note}</span>`;
      this.body.appendChild(stagger(bonus));
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
