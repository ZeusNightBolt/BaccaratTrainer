// "Road Genie" — a folk-superstition pattern reader in the tradition of the pit
// aunties who narrate the Big Road at high-limit baccarat tables. None of this
// has predictive power (every hand is an independent draw from the shoe) — it's
// a stylized reading of what the roads *look like*, same as a real table auntie
// would give you. Kept as pure, deterministic logic so it's fully unit-testable.

const DERIVED_ROADS = ['bigEyeBoy', 'smallRoad', 'cockroachRoad'];
const ROAD_LABEL = { bigEyeBoy: 'Big Eye Boy', smallRoad: 'Small Road', cockroachRoad: 'Cockroach Road' };

// RoadEngine.columns is an array of columns, each an array of hand entries
// sharing the same outcome. Reduce each column to its {outcome, length} shape.
function summarizeColumns(columns) {
  return columns.map((col) => ({ outcome: col[0].outcome, length: col.length }));
}

// Looks for a regular "chop" pattern: several consecutive Big Road columns all
// the same length, strictly alternating Banker/Player (e.g. 3 Player, 3 Banker,
// 3 Player, 3 Banker, 3 Player). Requires at least 4 columns to call it a pattern.
export function detectChopPattern(columns, { minColumns = 4, maxLookback = 5 } = {}) {
  if (columns.length < minColumns) return null;

  const recent = columns.slice(-maxLookback);
  if (recent.length < minColumns) return null;

  const length = recent[0].length;
  if (length < 2) return null; // single-card chop is just a normal chop road, not a notable pattern

  for (let i = 0; i < recent.length; i += 1) {
    if (recent[i].length !== length) return null;
    if (i > 0 && recent[i].outcome === recent[i - 1].outcome) return null;
  }

  return { length, columnsMatched: recent.length };
}

// Reads the most recent mark of each derived road and summarizes whether they
// agree the pattern is "following" (red) or "breaking" (blue).
export function readDerivedRoads(road) {
  const reads = DERIVED_ROADS.map((name) => {
    const grid = road.derivedRoad(name);
    const last = grid[grid.length - 1];
    return { name, label: ROAD_LABEL[name], mark: last ? last.outcome : null };
  });

  const withData = reads.filter((r) => r.mark !== null);
  const following = withData.filter((r) => r.mark === 'R').length;
  const breaking = withData.filter((r) => r.mark === 'B').length;

  let consensus = 'insufficient-data';
  if (withData.length > 0) {
    if (following > breaking) consensus = 'following';
    else if (breaking > following) consensus = 'breaking';
    else consensus = 'split';
  }

  return { reads, consensus };
}

// Full reading for the current road state. Returns a structured object the UI
// (or tests) can consume; prose is generated separately by composeReading().
export function readRoad(road) {
  const { columns } = road;

  if (columns.length === 0) {
    return {
      stage: 'cold-start',
      suggestion: null,
      chop: null,
      derived: readDerivedRoads(road),
    };
  }

  const summary = summarizeColumns(columns);
  const current = summary[summary.length - 1];
  const currentSpot = current.outcome === 'B' ? 'banker' : 'player';
  const opposingSpot = current.outcome === 'B' ? 'player' : 'banker';
  const chop = detectChopPattern(summary);
  const derived = readDerivedRoads(road);

  let suggestion;
  if (chop && current.length >= chop.length) {
    suggestion = {
      action: 'fade',
      spot: opposingSpot,
      sizeHint: 'reduced',
      reason: 'chop-pattern-due',
      streakLength: current.length,
      chopLength: chop.length,
    };
  } else {
    suggestion = {
      action: 'follow',
      spot: currentSpot,
      sizeHint: 'normal',
      reason: current.length >= 3 ? 'strong-streak' : 'early-streak',
      streakLength: current.length,
      chopLength: null,
    };
  }

  return { stage: 'reading', suggestion, chop, derived, currentStreak: { spot: currentSpot, length: current.length } };
}

const SPOT_NAME = { banker: 'Banker', player: 'Player' };

// Turns a readRoad() result into a short list of auntie-voiced lines for the UI.
export function composeReading(reading) {
  if (reading.stage === 'cold-start') {
    return ["Fresh shoe, nothing to read yet. Deal a few hands and let the road speak."];
  }

  const lines = [];
  const { suggestion, chop, derived, currentStreak } = reading;

  if (suggestion.action === 'follow') {
    if (currentStreak.length === 1) {
      lines.push(`${SPOT_NAME[suggestion.spot]} just opened a new column. Too soon to call it a trend — a small follow bet is reasonable.`);
    } else if (currentStreak.length === 2) {
      lines.push(`${SPOT_NAME[suggestion.spot]} has run twice. The road likes company — I'd stay with it at a normal unit.`);
    } else {
      lines.push(`${SPOT_NAME[suggestion.spot]} is on a run of ${currentStreak.length}. When it's hot like this, ride it — normal unit, follow the streak.`);
    }
  } else {
    lines.push(
      `I see it: the road has been chopping in neat groups of ${chop.length} for ${chop.columnsMatched} columns straight (Player, Banker, Player, Banker...). This column already matched that rhythm.`
    );
    lines.push(`The pattern says it's due to flip to ${SPOT_NAME[suggestion.spot]}. If you fade it, bet smaller than your normal unit — a rhythm can hold one more round before it breaks.`);
  }

  if (derived.consensus === 'following') {
    lines.push('The eye roads agree — Big Eye Boy, Small Road, and Cockroach Road are mostly red. The table is still following the pattern.');
  } else if (derived.consensus === 'breaking') {
    lines.push('The eye roads are turning blue together — something just changed. I\'d trust the streak less right now.');
  } else if (derived.consensus === 'split') {
    lines.push('The eye roads disagree with each other — one says follow, one says break. That means noisy, no clean read.');
  } else {
    lines.push('The eye roads need a few more columns before they have anything to say.');
  }

  const disagreements = derived.reads.filter((r) => r.mark !== null);
  if (disagreements.length >= 2) {
    const reds = disagreements.filter((r) => r.mark === 'R').map((r) => r.label);
    const blues = disagreements.filter((r) => r.mark === 'B').map((r) => r.label);
    if (reds.length && blues.length) {
      lines.push(`${reds.join(' and ')} say the pattern holds; ${blues.join(' and ')} say it already broke.`);
    }
  }

  return lines;
}

export function getRoadGenieReading(road) {
  const reading = readRoad(road);
  return { ...reading, lines: composeReading(reading) };
}
