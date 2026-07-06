// The Genie has a heart. It is NOT the Coach. The Coach reads the roads rationally;
// the Genie *feels*. It is a jittery, overthinking little oracle: it grasps at any
// spurious rhythm it can find in the shoe (a 2-1-2-1 shuffle, a ping-pong chop,
// stacking doubles, a mirror, plain streak heat, even the hand number's "numerology"),
// spirals through a couple of contradicting theories, then throws all of it away and
// trusts its gut. It runs on an emotion that sets its heartbeat, and when the vibes
// sour — or it feels a streak about to snap — it tells you to trim your bet unit and
// ride light. None of it predicts anything; that is the whole joke. The random gut is
// the dominant term so "Ask again" stays alive. rng is injectable and consumed in a
// fixed twelve-draw order for deterministic tests.

const SIDE_LABEL = { banker: 'Banker', player: 'Player', tie: 'Tie' };
const BONUS_LABEL = { sun7: '☀ Sun 7', moon8: '🐼 Panda 8', playerBonus: 'Player Bonus', bankerBonus: 'Banker Bonus' };

// Each emotion sets the heartbeat tempo the UI animates to.
const EMOTIONS = [
  { key: 'wired', emoji: '⚡', label: 'Wired', rate: 'racing' },
  { key: 'spooked', emoji: '😨', label: 'Spooked', rate: 'racing' },
  { key: 'spiraling', emoji: '🌀', label: 'Spiraling', rate: 'quick' },
  { key: 'locked', emoji: '🎯', label: 'Locked in', rate: 'calm' },
  { key: 'giddy', emoji: '✨', label: 'Giddy', rate: 'quick' },
  { key: 'cloudy', emoji: '🌫️', label: 'Cloudy', rate: 'calm' },
];

const OPENERS = {
  wired: ['Okay okay okay—', 'Hold on, hold on—', 'Right, listen, listen—'],
  spooked: ['Mmm. I don’t love this.', 'Something’s off tonight…', 'My skin is prickling.'],
  spiraling: ['Wait. Wait. Let me think.', 'Too many threads, too many—', 'Okay so IF, and only if—'],
  locked: ['I already know this one.', 'Clear as a bell.', 'No doubt in me at all.'],
  giddy: ['Oh, this is FUN.', 'Hehe — I feel it, I feel it—', 'Ooh. Ooh. Yes.'],
  cloudy: ['It’s murky in here…', 'Hard to see through the smoke.', 'The leaves won’t settle…'],
};

const CONTRADICTIONS = [
  'No wait — that can’t be right either. Ugh.',
  'But that’s exactly what it WANTS me to think.',
  'Unless… no. NO. Focus.',
  'Two voices, both loud. Great. Cool. Fine.',
];

const TRIM_NOTES = [
  'Ride light — half a unit, tops.',
  'Small bet. Just a toe in the water.',
  'Protect the stack. Tiny chip this hand.',
  'Don’t get greedy. Trim it down.',
];

const PRESS_NOTES = [
  'This one? Lean in. Press it up.',
  'I’d size UP here — the wind’s at our back.',
  'Bold chip. Trust me for once.',
];

function pick(arr, r) {
  return arr[Math.floor(r * arr.length) % arr.length];
}

function runLengths(bp) {
  const runs = [];
  for (const o of bp) {
    if (runs.length && runs[runs.length - 1].side === o) runs[runs.length - 1].len += 1;
    else runs.push({ side: o, len: 1 });
  }
  return runs;
}

function isAlternating(seq) {
  if (seq.length < 2) return false;
  for (let i = 1; i < seq.length; i += 1) if (seq[i] === seq[i - 1]) return false;
  return true;
}

const sideOf = (o) => (o === 'B' ? 'banker' : o === 'P' ? 'player' : null);
const flip = (s) => (s === 'banker' ? 'player' : 'banker');

// Grasp at every spurious pattern the tail of the shoe offers. Always returns at
// least one candidate (a numerology hunch) so the Genie is never lost for words.
function graspPatterns(outcomes, handNo, red, black) {
  const bp = outcomes.filter((o) => o === 'B' || o === 'P');
  const runs = runLengths(bp);
  const lens = runs.map((r) => r.len);
  const streak = runs.length ? runs[runs.length - 1] : { side: null, len: 0 };
  const lastSide = sideOf(bp[bp.length - 1]);
  const other = lastSide ? flip(lastSide) : null;
  const cands = [];

  if (bp.length >= 4 && isAlternating(bp.slice(-4)) && other) {
    cands.push({ label: 'a ping-pong chop', lean: other, note: `Back and forth, back and forth — it flips to ${SIDE_LABEL[other]} again.` });
  }
  if (lens.length >= 4 && lens.at(-1) === lens.at(-3) && lens.at(-2) === lens.at(-4) && lens.at(-1) !== lens.at(-2) && other) {
    const a = lens.at(-2);
    const b = lens.at(-1);
    cands.push({ label: `a ${a}-${b}-${a}-${b} shuffle`, lean: other, note: `The rhythm says switch — over to ${SIDE_LABEL[other]}.` });
  }
  if (lens.length >= 2 && lens.at(-1) === 2 && lens.at(-2) === 2 && other) {
    cands.push({ label: 'doubles stacking — twos on twos', lean: other, note: `Two, then two, then two… this pair completes and swings to ${SIDE_LABEL[other]}.` });
  }
  if (bp.length >= 4) {
    const t = bp.slice(-4);
    if (t[0] === t[3] && t[1] === t[2] && lastSide) {
      cands.push({ label: 'a little mirror', lean: lastSide, note: `It folds on itself — ${SIDE_LABEL[lastSide]} to close the reflection.` });
    }
  }
  if (streak.len >= 3 && lastSide) {
    cands.push({ label: `a ${streak.len}-long run`, lean: lastSide, note: `${SIDE_LABEL[lastSide]} is hot… but hot things cool.` });
  }
  if (red || black) {
    if (red > black) cands.push({ label: 'the red pips piling up', lean: 'banker', note: `${red} reds just fell — red is the dragon’s colour.` });
    else if (black > red) cands.push({ label: 'the black pips piling up', lean: 'player', note: `${black} blacks on the felt — the shadows pull Player.` });
  }

  // always-on numerology hunch, so there is never dead air
  const nLean = handNo % 2 === 0 ? 'banker' : 'player';
  cands.push({ label: `the number ${handNo + 1}`, lean: nLean, note: `${handNo + 1}… it just feels ${SIDE_LABEL[nLean]}, don’t ask.` });

  return { cands, streak, lastSide };
}

function chooseVoiced(cands, r) {
  if (cands.length <= 1) return cands.slice();
  const i = Math.floor(r * cands.length) % cands.length;
  const first = cands[i];
  const second = cands[(i + 1) % cands.length];
  return r > 0.45 ? [first, second] : [first];
}

// Returns { main, bonus, stake, emotion, heartRate, lines[], lastName }.
export function consultGenie(game, rng = Math.random) {
  const outcomes = game.shoeRounds.map((r) => r.hand.outcome);
  const handNo = game.history.length;

  let red = 0;
  let black = 0;
  const last = game.lastRound;
  if (last) {
    for (const c of [...last.hand.player, ...last.hand.banker]) {
      if (c.suit === 'H' || c.suit === 'D') red += 1;
      else black += 1;
    }
  }

  // ---- twelve fixed rng draws: the whole reading is deterministic under a seed ----
  const gutB = rng();
  const gutP = rng();
  const patRoll = rng();
  const patSway = rng();
  const tieRoll = rng();
  const whimRoll = rng();
  const emoRoll = rng();
  const breakRoll = rng();
  const stakeRoll = rng();
  const bonusRoll = rng();
  const bonusPick = rng();
  const voiceRoll = rng();

  const { cands, streak, lastSide } = graspPatterns(outcomes, handNo, red, black);
  const voiced = chooseVoiced(cands, patRoll);
  const emotion = EMOTIONS[Math.floor(emoRoll * EMOTIONS.length) % EMOTIONS.length];

  // The gut feeling (0..3 each) dominates; patterns only tilt it.
  let banker = gutB * 3;
  let player = gutP * 3;

  if (voiced[0] && voiced[0].lean && patSway < 0.7) {
    const amt = 0.5 + patSway; // a modest, overthought nudge
    if (voiced[0].lean === 'banker') banker += amt;
    else player += amt;
  }

  // Does it feel the current run about to snap?
  const breakFeeling = streak.len >= 3 && breakRoll < 0.55;
  const breakTo = streak.side ? flip(sideOf(streak.side)) : null;
  if (breakFeeling && breakTo) {
    if (breakTo === 'banker') banker += 0.9;
    else player += 0.9;
  }

  if (handNo % 2 === 0) banker += 0.2;
  else player += 0.2;

  // ---- the call ----
  let mainSpot;
  let flipped = false;
  if (tieRoll < 0.05) {
    mainSpot = 'tie';
  } else {
    mainSpot = banker >= player ? 'banker' : 'player';
    if (whimRoll < 0.16) {
      mainSpot = flip(mainSpot);
      flipped = true;
    }
  }

  // ---- stake advice: trim on bad vibes / a wobbling streak; rarely press ----
  let stake = null;
  if (mainSpot !== 'tie') {
    if (emotion.key === 'spooked' || breakFeeling || stakeRoll < 0.16) {
      stake = { level: 'trim', label: 'Trim the unit', note: pick(TRIM_NOTES, voiceRoll) };
    } else if ((emotion.key === 'giddy' || emotion.key === 'wired') && stakeRoll > 0.9) {
      stake = { level: 'press', label: 'Press it up', note: pick(PRESS_NOTES, voiceRoll) };
    }
  }

  // ---- the occasional bonus hedge ----
  let bonus = null;
  if (mainSpot !== 'tie' && bonusRoll < 0.34) {
    if (mainSpot === 'banker') {
      if (bonusPick < 0.5) bonus = { spot: 'sun7', note: 'I feel the dragon’s third card — catch it on Sun 7.' };
      else if (bonusPick < 0.8) bonus = { spot: 'bankerBonus', note: 'Banker wants a blowout — a whisker on Banker Bonus.' };
      else bonus = { spot: 'moon8', note: 'and a hedge on Panda 8, in case Player peeks an eight.' };
    } else {
      if (bonusPick < 0.5) bonus = { spot: 'moon8', note: 'a Player eight is humming — sprinkle on Panda 8.' };
      else if (bonusPick < 0.8) bonus = { spot: 'playerBonus', note: 'Player wants a blowout — a chip on Player Bonus.' };
      else bonus = { spot: 'sun7', note: 'and a hedge on Sun 7, the dragon likes to spoil.' };
    }
    bonus.label = BONUS_LABEL[bonus.spot];
  }

  // ---- the spiral of thoughts ----
  const lines = [pick(OPENERS[emotion.key], voiceRoll)];
  for (const p of voiced.slice(0, 2)) lines.push(`I keep seeing ${p.label}. ${p.note}`);
  if (voiced.length >= 2) lines.push(pick(CONTRADICTIONS, voiceRoll));
  if (breakFeeling && breakTo) lines.push(`…and this run? Wobbling. I feel it snapping to ${SIDE_LABEL[breakTo]}.`);
  lines.push(`${flipped ? 'No — gut override. ' : 'My gut says… '}${SIDE_LABEL[mainSpot]}. I’m going ${SIDE_LABEL[mainSpot]}.`);
  if (mainSpot === 'tie') lines.push('…a Tie. Don’t ask me why. Keep it small.');

  return {
    main: { spot: mainSpot, label: SIDE_LABEL[mainSpot] },
    bonus: bonus ? { spot: bonus.spot, label: bonus.label, note: bonus.note } : null,
    stake,
    emotion: { key: emotion.key, emoji: emotion.emoji, label: emotion.label },
    heartRate: emotion.rate,
    lines,
    lastName: lastSide ? SIDE_LABEL[lastSide] : null,
  };
}
