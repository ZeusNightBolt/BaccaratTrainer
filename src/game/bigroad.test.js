import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadEngine } from './bigroad.js';

// Sequence: B, B, P, P, P, B, T, B, P, B, B
function buildEngine() {
  const engine = new RoadEngine();
  const seq = ['B', 'B', 'P', 'P', 'P', 'B', 'TIE', 'B', 'P', 'B', 'B'];
  for (const outcome of seq) engine.addResult(outcome);
  return engine;
}

test('predict forecasts the derived-road mark for a hypothetical next result', () => {
  const engine = buildEngine();
  // predict() must match what actually happens when that outcome is appended.
  for (const next of ['B', 'P']) {
    const forecast = engine.predict(next);
    const clone = new RoadEngine();
    for (const o of ['B', 'B', 'P', 'P', 'P', 'B', 'TIE', 'B', 'P', 'B', 'B']) clone.addResult(o);
    clone.addResult(next);
    // The forecast mark equals the last mark of each derived road after appending.
    for (const [road, key] of [
      ['bigEyeBoy', 'bigEyeBoy'],
      ['smallRoad', 'smallRoad'],
      ['cockroachRoad', 'cockroachRoad'],
    ]) {
      const grid = clone.derivedRoad(road);
      if (forecast[key] === null) continue;
      const last = grid[grid.length - 1];
      assert.equal(forecast[key], last.outcome, `${road} forecast for next=${next}`);
    }
  }
});

test('predict returns nulls on an empty or too-short road', () => {
  const engine = new RoadEngine();
  const f = engine.predict('B');
  assert.deepEqual(f, { bigEyeBoy: null, smallRoad: null, cockroachRoad: null });
});

test('Big Road groups streaks into columns and tallies ties on the trailing cell', () => {
  const engine = buildEngine();
  assert.equal(engine.columns.length, 5);
  assert.deepEqual(
    engine.columns.map((col) => col.length),
    [2, 3, 2, 1, 2]
  );
  // The tie landed right after the first B in column index 2.
  assert.equal(engine.columns[2][0].ties, 1);
  assert.equal(engine.columns[2][1].ties, 0);
});

test('Big Road grid lays out (col,row) with no overflow when streaks are short', () => {
  const engine = buildEngine();
  const grid = engine.bigRoadGrid();
  const at = (col, row) => grid.find((cell) => cell.col === col && cell.row === row);
  assert.equal(at(0, 0).outcome, 'B');
  assert.equal(at(0, 1).outcome, 'B');
  assert.equal(at(1, 2).outcome, 'P');
  assert.equal(at(4, 1).outcome, 'B');
  assert.equal(grid.length, 10);
});

test('Big Road applies dragon-tail overflow past maxRows', () => {
  const engine = new RoadEngine();
  for (let i = 0; i < 8; i += 1) engine.addResult('B');
  const grid = engine.bigRoadGrid(6);
  const at = (col, row) => grid.find((cell) => cell.col === col && cell.row === row);
  // Rows 0-5 fill column 0; the 7th and 8th entries snake across row 5.
  for (let r = 0; r < 6; r += 1) assert.equal(at(0, r).outcome, 'B');
  assert.equal(at(1, 5).outcome, 'B');
  assert.equal(at(2, 5).outcome, 'B');
});

test('Big Eye Boy derives R/B marks per the look-back-1-column rule', () => {
  const engine = buildEngine();
  const grid = engine.derivedRoad('bigEyeBoy');
  const colors = grid.map((cell) => cell.outcome);
  assert.deepEqual(colors, ['R', 'B', 'B', 'R', 'B', 'B', 'B']);
  // Grouped into columns of length [1,2,1,3]
  const byCol = {};
  for (const cell of grid) {
    byCol[cell.col] = byCol[cell.col] || [];
    byCol[cell.col].push(cell.outcome);
  }
  assert.deepEqual(Object.values(byCol).map((c) => c.length), [1, 2, 1, 3]);
});

test('Small Road anchors a new column at C-1 and looks back k=2 (regression)', () => {
  // Big Road B P P B B P B -> column heights [1,2,2,1,1]. The last mark must be
  // BLUE (pattern breaks): a bug that shifted BOTH compared columns by k reported
  // a spurious RED here for Small Road / Cockroach while Big Eye Boy stayed correct.
  const engine = new RoadEngine();
  for (const o of ['B', 'P', 'P', 'B', 'B', 'P', 'B']) engine.addResult(o);
  const small = engine.derivedRoad('smallRoad').map((c) => c.outcome);
  assert.deepEqual(small, ['B', 'B', 'B']);
});

test('Cockroach Road derives correct marks with the k=3 look-back (regression)', () => {
  const engine = new RoadEngine();
  for (const o of ['B', 'P', 'B', 'B', 'P', 'P', 'B', 'P', 'B', 'P', 'B']) engine.addResult(o);
  const roach = engine.derivedRoad('cockroachRoad').map((c) => c.outcome);
  assert.deepEqual(roach, ['B', 'B', 'R', 'B', 'B', 'R']);
});

test('derived roads produce no marks until enough Big Road history exists', () => {
  const engine = new RoadEngine();
  engine.addResult('B');
  engine.addResult('P');
  assert.equal(engine.derivedRoad('bigEyeBoy').length, 0);
  assert.equal(engine.derivedRoad('smallRoad').length, 0);
  assert.equal(engine.derivedRoad('cockroachRoad').length, 0);
});
