// "Road Genie" — a pattern reader in the tradition of the pit aunties who narrate
// the Big Road at high-limit baccarat. None of this has predictive power (every
// hand is an independent draw) — it is a stylized reading of the road's *shape*.
// It goes beyond "is there a streak": it looks at the whole sequence of Big Road
// column lengths and hunts for a repeating rhythm — a ping-pong (1-1-1-1), a
// double-chop (2-2-2), an alternating 3-4-3-4, a 2-2-3-3 cycle, and so on — then
// reads where the current column sits inside that rhythm to call follow or fade.
// Kept as pure, deterministic logic so it is fully unit-testable.

const DERIVED_ROADS = ['bigEyeBoy', 'smallRoad', 'cockroachRoad'];
const ROAD_LABEL = { bigEyeBoy: 'Big Eye Boy', smallRoad: 'Small Road', cockroachRoad: 'Cockroach Road' };

// RoadEngine.columns → [{ outcome, length }] per streak column.
function summarizeColumns(columns) {
  return columns.map((col) => ({ outcome: col[0].outcome, length: col.length }));
}

// Finds the shortest repeating cycle at the TAIL of a length sequence. Returns
// { period, cycle, repeats } for the smallest period whose block repeats at least
// `minRepeats` times running back from the end, or null. Iterating period ascending
// means [3,3,3,3] is reported as period 1 (not 2), the most specific reading.
export function detectLengthCycle(lengths, { maxPeriod = 4, minRepeats = 2 } = {}) {
  const n = lengths.length;
  let best = null;
  for (let p = 1; p <= maxPeriod; p += 1) {
    if (n < p * minRepeats) continue;
    const cycle = lengths.slice(n - p);
    let repeats = 1;
    let idx = n - p;
    while (idx - p >= 0) {
      let match = true;
      for (let j = 0; j < p; j += 1) {
        if (lengths[idx - p + j] !== cycle[j]) {
          match = false;
          break;
        }
      }
      if (!match) break;
      repeats += 1;
      idx -= p;
    }
    if (repeats < minRepeats) continue;
    // Prefer the rhythm that explains the most columns (period × repeats), so a
    // 2-2-3-3 cycle beats the trailing 3-3 it contains; tie-break to shorter period.
    const coverage = p * repeats;
    if (!best || coverage > best.coverage || (coverage === best.coverage && p < best.period)) {
      best = { period: p, cycle, repeats, coverage };
    }
  }
  return best ? { period: best.period, cycle: best.cycle, repeats: best.repeats } : null;
}

// Legacy helper (kept for the "chopping in groups of N" prose): several recent
// columns of equal length strictly alternating Banker/Player.
export function detectChopPattern(columns, { minColumns = 4, maxLookback = 6 } = {}) {
  if (columns.length < minColumns) return null;
  const recent = columns.slice(-maxLookback);
  if (recent.length < minColumns) return null;
  const length = recent[0].length;
  if (length < 1) return null;
  for (let i = 0; i < recent.length; i += 1) {
    if (recent[i].length !== length) return null;
    if (i > 0 && recent[i].outcome === recent[i - 1].outcome) return null;
  }
  return { length, columnsMatched: recent.length };
}

// Reads the latest mark of each derived road and whether they agree.
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
  return { reads, consensus, following, breaking };
}

// Classifies the rhythm from the completed-column length cycle for nicer prose.
function classifyPattern(cycle) {
  const { period, cycle: values } = cycle;
  const allEqual = values.every((v) => v === values[0]);
  if (period === 1 && values[0] === 1) return { type: 'pingpong', target: 1 };
  if (period === 1 && values[0] === 2) return { type: 'double-chop', target: 2 };
  if (period === 1) return { type: 'even-chop', target: values[0] };
  if (period === 2 && !allEqual) return { type: 'alternating', target: values[0] };
  return { type: 'cycle', target: values[0] };
}

// Core reading. Uses the length cycle of the COMPLETED columns to predict whether
// the current (in-progress) column should continue (follow) or turn (fade).
export function readRoad(road) {
  const { columns } = road;
  const derived = readDerivedRoads(road);

  if (columns.length === 0) {
    return { stage: 'cold-start', suggestion: null, pattern: null, derived, currentStreak: null };
  }

  const summary = summarizeColumns(columns);
  const current = summary[summary.length - 1];
  const currentSpot = current.outcome === 'B' ? 'banker' : 'player';
  const opposingSpot = current.outcome === 'B' ? 'player' : 'banker';

  const completedLengths = summary.slice(0, -1).map((c) => c.length);
  const cycle = detectLengthCycle(completedLengths);
  const chop = detectChopPattern(summary);

  let pattern = null;
  let suggestion;

  if (cycle) {
    // In a period-p rhythm the current column repeats the value p columns back,
    // which is the first element of the detected tail block.
    const target = cycle.cycle[0];
    const info = classifyPattern(cycle);
    pattern = { ...info, period: cycle.period, cycle: cycle.cycle, repeats: cycle.repeats, target };

    if (current.length < target) {
      suggestion = mkSuggestion('follow', currentSpot, 'normal', 'cycle-continue', current.length, target);
    } else if (current.length === target) {
      suggestion = mkSuggestion('fade', opposingSpot, 'reduced', 'cycle-turn-due', current.length, target);
    } else {
      // The column outran the rhythm — treat it as a genuine streak breaking out.
      suggestion = mkSuggestion('follow', currentSpot, 'normal', 'pattern-broke-streak', current.length, target);
    }
  } else if (current.length >= 3) {
    suggestion = mkSuggestion('follow', currentSpot, 'normal', 'strong-streak', current.length, null);
  } else if (current.length === 2) {
    suggestion = mkSuggestion('follow', currentSpot, 'normal', 'early-streak', current.length, null);
  } else {
    suggestion = mkSuggestion('follow', currentSpot, 'normal', 'early-streak', current.length, null);
  }

  suggestion.confidence = scoreConfidence(suggestion, cycle, derived);

  return {
    stage: 'reading',
    suggestion,
    pattern,
    chop,
    derived,
    currentStreak: { spot: currentSpot, length: current.length },
  };
}

function mkSuggestion(action, spot, sizeHint, reason, streakLength, target) {
  return { action, spot, sizeHint, reason, streakLength, target };
}

// 1..3, blended from how established the rhythm is and whether the eye roads agree.
function scoreConfidence(suggestion, cycle, derived) {
  let score = 1;
  if (cycle) score = cycle.repeats >= 3 ? 3 : 2;
  else if (suggestion.reason === 'strong-streak') score = suggestion.streakLength >= 4 ? 3 : 2;

  // A following call wants the eye roads "following"; a fade wants them "breaking".
  const wantFollowing = suggestion.action === 'follow';
  if (derived.consensus === 'following') score += wantFollowing ? 1 : -1;
  else if (derived.consensus === 'breaking') score += wantFollowing ? -1 : 1;

  return Math.max(1, Math.min(3, score));
}

const SPOT_NAME = { banker: 'Banker', player: 'Player' };

// Turns a readRoad() result into short auntie-voiced lines for the UI.
export function composeReading(reading) {
  if (reading.stage === 'cold-start') {
    return ['Fresh shoe, nothing to read yet. Deal a few hands and let the road speak.'];
  }

  const lines = [];
  const { suggestion, pattern, derived, currentStreak } = reading;
  const follow = SPOT_NAME[suggestion.spot];

  if (pattern) {
    lines.push(describePattern(pattern));
    if (suggestion.action === 'fade') {
      lines.push(
        `The rhythm says this column is due to turn — lean ${follow}, but smaller than your unit; a rhythm can hold one more before it breaks.`
      );
    } else if (suggestion.reason === 'pattern-broke-streak') {
      lines.push(`${follow} just outran the rhythm — that is a real breakout now. Ride it at a normal unit.`);
    } else {
      lines.push(`Inside the rhythm this column has room to run — stay with ${follow} at a normal unit.`);
    }
  } else if (currentStreak.length === 1) {
    lines.push(`${follow} just opened a new column. Too soon to call a trend — a small follow is reasonable.`);
  } else if (currentStreak.length === 2) {
    lines.push(`${follow} has run twice. The road likes company — stay with it at a normal unit.`);
  } else {
    lines.push(`${follow} is on a run of ${currentStreak.length}. When it is hot, ride it — normal unit, follow the streak.`);
  }

  if (derived.consensus === 'following') {
    lines.push('The eye roads agree — Big Eye Boy, Small Road and Cockroach are mostly red. The pattern is holding.');
  } else if (derived.consensus === 'breaking') {
    lines.push('The eye roads are turning blue together — something just shifted. Trust the read a little less.');
  } else if (derived.consensus === 'split') {
    lines.push('The eye roads disagree — one says hold, one says break. Noisy, no clean read.');
  }

  return lines;
}

function describePattern(pattern) {
  const seq = pattern.cycle.join('-');
  switch (pattern.type) {
    case 'pingpong':
      return 'The road is ping-ponging — single chops, Player then Banker every hand.';
    case 'double-chop':
      return 'The road is chopping in twos — each side wins a pair, then hands it over.';
    case 'even-chop':
      return `The road is chopping in even groups of ${pattern.target}, side for side.`;
    case 'alternating':
      return `The columns are running in an alternating ${seq} rhythm (like ${seq}-${seq}).`;
    default:
      return `There is a repeating rhythm in the column lengths: ${seq}, over and over.`;
  }
}

export function getRoadGenieReading(road) {
  const reading = readRoad(road);
  return { ...reading, lines: composeReading(reading) };
}
