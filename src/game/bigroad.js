// Big Road plus the three derived "eye" roads (Big Eye Boy, Small Road, Cockroach Road)
// exactly as laid out on real mini-baccarat tables. Ties never open a new column: they are
// tallied onto whichever Banker/Player cell they trail. Pair results attach a corner dot to
// the cell for that same hand.

export const MAX_ROWS = 6;

export class RoadEngine {
  constructor() {
    // Each column is an array of entries: { outcome: 'P'|'B', ties, playerPair, bankerPair }
    this.columns = [];
    this.pendingTies = 0;
  }

  addResult(outcome, { playerPair = false, bankerPair = false } = {}) {
    if (outcome === 'TIE') {
      this.pendingTies += 1;
      if (this.columns.length > 0) {
        const last = this.columns[this.columns.length - 1];
        const lastEntry = last[last.length - 1];
        lastEntry.playerPair = lastEntry.playerPair || playerPair;
        lastEntry.bankerPair = lastEntry.bankerPair || bankerPair;
      }
      return;
    }

    const entry = { outcome, ties: 0, playerPair, bankerPair };

    if (this.columns.length === 0) {
      entry.ties = this.pendingTies;
      this.pendingTies = 0;
      this.columns.push([entry]);
      return;
    }

    const lastCol = this.columns[this.columns.length - 1];
    const lastEntry = lastCol[lastCol.length - 1];
    lastEntry.ties += this.pendingTies;
    this.pendingTies = 0;

    if (lastEntry.outcome === outcome) {
      lastCol.push(entry);
    } else {
      this.columns.push([entry]);
    }
  }

  // Rendering grid for the Big Road itself, with dragon-tail overflow once a
  // streak exceeds maxRows.
  bigRoadGrid(maxRows = MAX_ROWS) {
    return layoutWithSnake(
      this.columns.map((col) => col.map((e) => ({ ...e }))),
      maxRows
    );
  }

  // name: 'bigEyeBoy' | 'smallRoad' | 'cockroachRoad'
  derivedRoad(name, maxRows = MAX_ROWS) {
    const offset = { bigEyeBoy: 1, smallRoad: 2, cockroachRoad: 3 }[name];
    if (!offset) throw new Error(`Unknown derived road: ${name}`);

    const marks = []; // flat chronological list of 'R' | 'B'
    for (let c = 0; c < this.columns.length; c += 1) {
      const col = this.columns[c];
      for (let r = 0; r < col.length; r += 1) {
        const mark = deriveMark(this.columns, c, r, offset);
        if (mark) marks.push(mark);
      }
    }

    // Group the flat R/B sequence into columns using the same run-length rule
    // as Big Road (change of color opens a new column).
    const derivedColumns = [];
    for (const mark of marks) {
      const last = derivedColumns[derivedColumns.length - 1];
      if (last && last[last.length - 1].outcome === mark) {
        last.push({ outcome: mark });
      } else {
        derivedColumns.push([{ outcome: mark }]);
      }
    }

    return layoutWithSnake(derivedColumns, maxRows);
  }

  // The Atlantic City "ask" / forecast: given a hypothetical NEXT outcome ('P' or
  // 'B'), what mark would land in each derived road? Returns
  // { bigEyeBoy, smallRoad, cockroachRoad } where each is 'R' (pattern repeats),
  // 'B' (pattern breaks), or null (not enough history yet). Real state is never
  // mutated. Ties are ignored here — they never move a derived mark.
  predict(nextOutcome) {
    const cols = this.columns.map((col) => col.map((e) => ({ outcome: e.outcome })));
    let C;
    let R;
    if (cols.length === 0) {
      cols.push([{ outcome: nextOutcome }]);
      C = 0;
      R = 0;
    } else {
      const last = cols[cols.length - 1];
      if (last[last.length - 1].outcome === nextOutcome) {
        last.push({ outcome: nextOutcome });
        C = cols.length - 1;
        R = last.length - 1;
      } else {
        cols.push([{ outcome: nextOutcome }]);
        C = cols.length - 1;
        R = 0;
      }
    }
    return {
      bigEyeBoy: deriveMark(cols, C, R, 1),
      smallRoad: deriveMark(cols, C, R, 2),
      cockroachRoad: deriveMark(cols, C, R, 3),
    };
  }
}

// Computes the Big-Eye/Small/Cockroach mark for Big Road cell (col=C, row=R),
// or null if there isn't yet enough history to derive one.
function deriveMark(columns, C, R, k) {
  if (R > 0) {
    const refCol = C - k;
    if (refCol < 0) return null;
    return columns[refCol].length > R ? 'R' : 'B';
  }
  // New column: compare the just-completed column (C-1) against the column k
  // further back (C-1-k). Only the *reference* shifts by the road's offset k;
  // the anchor stays at C-1. (For k=1 the two coincide, which is why Big Eye Boy
  // was already correct, but Small Road (k=2) and Cockroach (k=3) diverge.)
  const a = C - 1;
  const b = C - 1 - k;
  if (b < 0) return null;
  return columns[a].length === columns[b].length ? 'R' : 'B';
}

// Bead Plate: every hand (including ties) gets its own cell, filled straight
// top-to-bottom then wrapping to the next column -- no streak grouping at all.
export function beadPlateGrid(results, maxRows = MAX_ROWS) {
  return results.map((r, i) => ({
    col: Math.floor(i / maxRows),
    row: i % maxRows,
    outcome: r.outcome,
    playerPair: !!r.playerPair,
    bankerPair: !!r.bankerPair,
  }));
}

function layoutWithSnake(logicalColumns, maxRows) {
  const cells = [];
  let displayCol = -1;

  for (const streak of logicalColumns) {
    displayCol += 1;
    let maxColUsed = displayCol;
    for (let idx = 0; idx < streak.length; idx += 1) {
      let col;
      let row;
      if (idx < maxRows) {
        col = displayCol;
        row = idx;
      } else {
        row = maxRows - 1;
        col = displayCol + (idx - maxRows + 1);
      }
      maxColUsed = Math.max(maxColUsed, col);
      cells.push({ col, row, ...streak[idx] });
    }
    displayCol = maxColUsed;
  }

  return cells;
}
