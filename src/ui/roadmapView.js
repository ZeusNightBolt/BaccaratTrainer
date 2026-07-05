import { beadPlateGrid } from '../game/bigroad.js';

const OUTCOME_CODE = { PLAYER: 'P', BANKER: 'B', TIE: 'TIE' };

// The three derived roads each get a distinct marker SHAPE (not just colour),
// exactly like a real Atlantic City / Macau board:
//   Big Eye Boy  -> hollow ring     (variant 'ring')
//   Small Road   -> solid dot       (variant 'dot')
//   Cockroach    -> diagonal slash  (variant 'slash')
const DERIVED = [
  { name: 'bigEyeBoy', id: 'road-bigeyeboy', variant: 'ring' },
  { name: 'smallRoad', id: 'road-smallroad', variant: 'dot' },
  { name: 'cockroachRoad', id: 'road-cockroach', variant: 'slash' },
];

export class RoadmapView {
  constructor(root) {
    this.beadEl = root.querySelector('#road-bead');
    this.bigEl = root.querySelector('#road-main');
    this.boardTop = root.querySelector('.board-top');
    this.derivedEls = {};
    for (const d of DERIVED) this.derivedEls[d.name] = root.querySelector(`#${d.id}`);

    // Tabs only drive the mobile single-pane fallback (both panes show on desktop).
    this.tabs = Array.from(root.querySelectorAll('.tab-btn'));
    this.mobileView = 'bigroad';
    this.tabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mobileView = btn.dataset.view;
        this.tabs.forEach((b) => b.classList.toggle('active', b === btn));
        if (this.boardTop) this.boardTop.dataset.mobileView = this.mobileView;
      });
    });
    if (this.boardTop) this.boardTop.dataset.mobileView = this.mobileView;
  }

  render(game) {
    const beadCells = beadPlateGrid(
      game.shoeRounds.map((r) => ({
        outcome: OUTCOME_CODE[r.hand.outcome],
        playerPair: r.hand.playerPair,
        bankerPair: r.hand.bankerPair,
      }))
    );
    renderGrid(this.beadEl, beadCells, 'beadplate');
    renderGrid(this.bigEl, game.road.bigRoadGrid(), 'bigroad');

    for (const d of DERIVED) {
      renderGrid(this.derivedEls[d.name], game.road.derivedRoad(d.name), d.variant);
    }
  }
}

const BIG_VARIANTS = new Set(['bigroad', 'beadplate']);

// Places each cell at its exact (col,row) grid coordinate so streaks stack into
// columns and overlays land on the right marker. `variant` selects the marker shape.
function renderGrid(container, cells, variant) {
  if (!container) return;
  container.innerHTML = '';
  container.classList.toggle('is-empty', cells.length === 0);

  const columns = cells.length ? Math.max(...cells.map((c) => c.col)) + 1 : 1;
  container.style.setProperty('--road-cols', columns);

  const isBig = BIG_VARIANTS.has(variant);
  const lastIndex = cells.length - 1;

  cells.forEach((cell, i) => {
    const el = document.createElement('div');
    const base = isBig ? 'road-cell' : 'derived-cell';
    el.className = `${base} outcome-${cell.outcome} shape-${variant}`;
    el.style.gridColumn = String(cell.col + 1);
    el.style.gridRow = String(cell.row + 1);
    if (i === lastIndex) el.classList.add('is-latest');

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
      // Authentic AC/Macau convention: Banker pair = red dot top-left,
      // Player pair = blue dot bottom-right.
      if (cell.bankerPair) el.appendChild(pairDot('banker'));
      if (cell.playerPair) el.appendChild(pairDot('player'));
    }

    if (variant === 'beadplate') {
      const letter = document.createElement('span');
      letter.className = 'bead-letter';
      letter.textContent = cell.outcome === 'TIE' ? 'T' : cell.outcome;
      el.appendChild(letter);
    }

    container.appendChild(el);
  });

  // Keep the live edge of long shoes in view.
  container.scrollLeft = container.scrollWidth;
}

function pairDot(side) {
  const dot = document.createElement('span');
  dot.className = `pair-dot ${side}`;
  return dot;
}
