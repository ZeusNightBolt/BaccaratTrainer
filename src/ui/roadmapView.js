import { beadPlateGrid } from '../game/bigroad.js';

const OUTCOME_CODE = { PLAYER: 'P', BANKER: 'B', TIE: 'TIE' };

export class RoadmapView {
  constructor(root) {
    this.mainEl = root.querySelector('#road-main');
    this.derivedEls = {
      bigEyeBoy: root.querySelector('#road-bigeyeboy'),
      smallRoad: root.querySelector('#road-smallroad'),
      cockroachRoad: root.querySelector('#road-cockroach'),
    };
    this.tabs = Array.from(root.querySelectorAll('.tab-btn'));
    this.activeView = 'bigroad';

    this.tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeView = btn.dataset.view;
        this.tabs.forEach((b) => b.classList.toggle('active', b === btn));
        if (this._lastGame) this.render(this._lastGame);
      });
    });
  }

  render(game) {
    this._lastGame = game;

    const cells =
      this.activeView === 'bigroad'
        ? game.road.bigRoadGrid()
        : beadPlateGrid(
            game.history.map((r) => ({
              outcome: OUTCOME_CODE[r.hand.outcome],
              playerPair: r.hand.playerPair,
              bankerPair: r.hand.bankerPair,
            }))
          );

    renderGrid(this.mainEl, cells, { big: true });

    for (const [name, el] of Object.entries(this.derivedEls)) {
      renderGrid(el, game.road.derivedRoad(name), { big: false });
    }
  }
}

function renderGrid(container, cells, { big }) {
  container.innerHTML = '';
  const sorted = [...cells].sort((a, b) => a.col - b.col || a.row - b.row);

  for (const cell of sorted) {
    const el = document.createElement('div');
    el.className = big ? `road-cell outcome-${cell.outcome}` : `derived-cell outcome-${cell.outcome}`;

    if (big && cell.outcome !== 'TIE') {
      if (cell.ties) {
        const tie = document.createElement('span');
        tie.className = 'tie-mark';
        el.appendChild(tie);
        if (cell.ties > 1) {
          const count = document.createElement('span');
          count.className = 'tie-count';
          count.textContent = String(cell.ties);
          el.appendChild(count);
        }
      }
      if (cell.playerPair) {
        const dot = document.createElement('span');
        dot.className = 'pair-dot player';
        el.appendChild(dot);
      }
      if (cell.bankerPair) {
        const dot = document.createElement('span');
        dot.className = 'pair-dot banker';
        el.appendChild(dot);
      }
    }

    container.appendChild(el);
  }
}
