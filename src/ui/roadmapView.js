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

    if (this.activeView === 'bigroad') {
      renderGrid(this.mainEl, game.road.bigRoadGrid(), 'bigroad');
    } else {
      const cells = beadPlateGrid(
        game.history.map((r) => ({
          outcome: OUTCOME_CODE[r.hand.outcome],
          playerPair: r.hand.playerPair,
          bankerPair: r.hand.bankerPair,
        }))
      );
      renderGrid(this.mainEl, cells, 'beadplate');
    }

    for (const [name, el] of Object.entries(this.derivedEls)) {
      renderGrid(el, game.road.derivedRoad(name), 'derived');
    }
  }
}

const ROWS = 6;

// Places each cell at its exact (col,row) via CSS grid coordinates so streaks
// stack vertically and ties/pairs land on the correct marker — the previous
// auto-flow approach ignored the coordinates entirely.
function renderGrid(container, cells, variant) {
  container.innerHTML = '';
  container.classList.toggle('is-empty', cells.length === 0);

  const columns = cells.length ? Math.max(...cells.map((c) => c.col)) + 1 : 1;
  container.style.setProperty('--road-cols', columns);

  for (const cell of cells) {
    const el = document.createElement('div');
    const base = variant === 'derived' ? 'derived-cell' : 'road-cell';
    el.className = `${base} outcome-${cell.outcome}`;
    if (variant === 'beadplate') el.classList.add('is-bead');
    el.style.gridColumn = String(cell.col + 1);
    el.style.gridRow = String(cell.row + 1);

    if (variant === 'bigroad' && cell.outcome !== 'TIE') {
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

    if (variant === 'beadplate') {
      const letter = document.createElement('span');
      letter.className = 'bead-letter';
      letter.textContent = cell.outcome === 'TIE' ? 'T' : cell.outcome;
      el.appendChild(letter);
    }

    container.appendChild(el);
  }
}

export { ROWS };
