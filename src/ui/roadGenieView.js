import { getRoadGenieReading } from '../game/roadGenie.js';

const SPOT_NAME = { banker: 'Banker', player: 'Player' };

export class RoadGenieView {
  constructor(root, game) {
    this.game = game;
    this.orb = root.querySelector('#genie-orb');
    this.panel = root.querySelector('#genie-panel');
    this.body = root.querySelector('#genie-body');
    this.closeBtn = root.querySelector('#genie-close');

    this.orb.addEventListener('click', () => this.toggle());
    this.closeBtn.addEventListener('click', () => this.setOpen(false));

    this.render();
  }

  toggle() {
    this.setOpen(this.panel.hidden);
  }

  setOpen(open) {
    this.panel.hidden = !open;
    this.orb.setAttribute('aria-expanded', String(open));
  }

  render() {
    const reading = getRoadGenieReading(this.game.road);

    this.body.innerHTML = '';
    for (const line of reading.lines) {
      const p = document.createElement('p');
      p.className = 'genie-line';
      p.textContent = line;
      this.body.appendChild(p);
    }

    if (reading.suggestion) {
      const box = document.createElement('div');
      box.className = `genie-suggestion ${reading.suggestion.action}`;
      const spotName = SPOT_NAME[reading.suggestion.spot];
      const sizeText = reading.suggestion.sizeHint === 'reduced' ? 'smaller than your usual unit' : 'your normal unit';
      const verb = reading.suggestion.action === 'follow' ? 'Follow' : 'Fade to';
      box.textContent = `${verb} ${spotName} — size: ${sizeText}`;
      this.body.appendChild(box);
    }

    this.orb.classList.toggle('has-signal', reading.suggestion?.action === 'fade');
  }
}
