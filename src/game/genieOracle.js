// The Genie is NOT the Coach. The Coach reads the roads rationally (follow/fade).
// The Genie is a fortune-teller: it takes a big random "gut feeling", tilts it with
// a few gleefully spurious "omens" pulled from the shoe (streak length, last suits,
// hand parity, leftover tie echoes), sometimes flips the whole thing on a whim, and
// just tells you, straight up, what to bet — plus, when the vibe takes it, a bonus
// hedge (Sun 7 / Panda 8 / Dragon Bonus). None of it predicts anything; that is the
// whole joke. The random gut feeling is the dominant term so that "Ask again" keeps
// feeling alive, while the omens only tilt the odds. rng is injectable for tests and
// is consumed in a fixed order (see the eight draws below).

const SIDE_LABEL = { banker: 'Banker', player: 'Player', tie: 'Tie' };
const BONUS_LABEL = { sun7: '☀ Sun 7', moon8: '🐼 Panda 8', playerBonus: 'Player Bonus', bankerBonus: 'Banker Bonus' };

const MOODS = [
  'The bones are warm.',
  'The shoe is whispering.',
  'A restless draft crosses the felt.',
  'The dragon stirs in the deck.',
  'Cloudy… but the pull is real.',
  'The tea leaves settled just so.',
];

function trailingStreak(outcomes) {
  if (outcomes.length === 0) return { side: null, len: 0 };
  const last = outcomes[outcomes.length - 1];
  let len = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === last; i -= 1) len += 1;
  return { side: last, len };
}

function gatherOmens(game) {
  const outcomes = game.shoeRounds.map((r) => r.hand.outcome);
  const recent = outcomes.slice(-10);
  const streak = trailingStreak(outcomes);
  const ties = recent.filter((o) => o === 'TIE').length;

  let red = 0;
  let black = 0;
  const last = game.lastRound;
  if (last) {
    for (const c of [...last.hand.player, ...last.hand.banker]) {
      if (c.suit === 'H' || c.suit === 'D') red += 1;
      else black += 1;
    }
  }
  return { recent, streak, ties, red, black, handNo: game.history.length };
}

// Returns { main:{spot,label}, bonus:null|{spot,label,note}, mood, lines[], lastName }.
export function consultGenie(game, rng = Math.random) {
  const o = gatherOmens(game);
  const lastName = o.streak.side
    ? SIDE_LABEL[o.streak.side.toLowerCase() === 'tie' ? 'tie' : o.streak.side === 'B' ? 'banker' : 'player']
    : null;

  // ---- eight fixed rng draws, so the whole reading is deterministic under a seed ----
  const gutB = rng();      // banker gut feeling (dominant term)
  const gutP = rng();      // player gut feeling (dominant term)
  const fadeRoll = rng();  // on a long streak: fade it or ride it?
  const tieRoll = rng();   // rare wild Tie call
  const whimRoll = rng();  // the genie's contrarian flip
  const bonusRoll = rng(); // does it feel like a bonus hedge at all?
  const bonusPick = rng(); // which bonus
  const moodRoll = rng();  // flavour mood

  // The gut feeling (range 0..3 each) dominates; omens only tilt it.
  let banker = gutB * 3;
  let player = gutP * 3;

  const omenLines = [];

  if (o.streak.side === 'B' || o.streak.side === 'P') {
    const hotSpot = o.streak.side === 'B' ? 'banker' : 'player';
    const tilt = 0.3 + Math.min(o.streak.len, 5) * 0.12;
    if (o.streak.len >= 3 && fadeRoll < 0.5) {
      // the streak feels "tired" — lean the other way
      if (hotSpot === 'banker') player += tilt;
      else banker += tilt;
      omenLines.push(`${SIDE_LABEL[hotSpot]} has walked ${o.streak.len} steps — its legs look tired.`);
    } else {
      // ride the hot hand
      if (hotSpot === 'banker') banker += tilt;
      else player += tilt;
      omenLines.push(`${SIDE_LABEL[hotSpot]} is warm — ${o.streak.len} in a row, and the heat lingers.`);
    }
  }

  if (o.red || o.black) {
    // bounded so a lucky suit run can't lock the vibe forever
    banker += Math.min(o.red, 4) * 0.12;
    player += Math.min(o.black, 4) * 0.12;
    if (o.red > o.black) omenLines.push(`${o.red} red pips just fell — red calls to the dragon.`);
    else if (o.black > o.red) omenLines.push(`${o.black} black pips on the table — the shadows favour Player.`);
  }

  if (o.handNo % 2 === 0) banker += 0.2;
  else player += 0.2;

  if (o.ties >= 1) omenLines.push(`${o.ties === 1 ? 'A tie' : `${o.ties} ties`} still echo in this shoe — restless.`);

  // ---- the call ----
  let mainSpot;
  let flipped = false;
  if (tieRoll < 0.06) {
    mainSpot = 'tie'; // rare wild call
  } else {
    mainSpot = banker >= player ? 'banker' : 'player';
    // the genie's whim — every so often it just feels the opposite
    if (whimRoll < 0.14) {
      mainSpot = mainSpot === 'banker' ? 'player' : 'banker';
      flipped = true;
    }
  }

  // ---- the bonus hedge, only when the vibe takes it ----
  let bonus = null;
  if (mainSpot !== 'tie' && bonusRoll < 0.4) {
    if (mainSpot === 'banker') {
      if (bonusPick < 0.5) bonus = { spot: 'sun7', note: 'I feel the dragon\'s third card — catch it on Sun 7.' };
      else if (bonusPick < 0.8) bonus = { spot: 'bankerBonus', note: 'Banker wants to win big — a whisker on Banker Bonus.' };
      else bonus = { spot: 'moon8', note: 'and a hedge on Panda 8, in case Player peeks an eight.' };
    } else {
      if (bonusPick < 0.5) bonus = { spot: 'moon8', note: 'a Player eight is humming — sprinkle on Panda 8.' };
      else if (bonusPick < 0.8) bonus = { spot: 'playerBonus', note: 'Player wants a blowout — a chip on Player Bonus.' };
      else bonus = { spot: 'sun7', note: 'and a hedge on Sun 7, the dragon likes to spoil.' };
    }
    bonus.label = BONUS_LABEL[bonus.spot];
  }

  const mood = MOODS[Math.floor(moodRoll * MOODS.length)];

  const lines = [];
  lines.push(`I feel ${SIDE_LABEL[mainSpot]}.`);
  // keep at most two omen whispers so the panel stays short
  for (const l of omenLines.slice(0, 2)) lines.push(l);
  if (flipped) lines.push(`…though the dragon whispers otherwise — I flip to ${SIDE_LABEL[mainSpot]}.`);
  if (mainSpot === 'tie') lines.push('The needle points nowhere and everywhere — a wild Tie, small.');

  return {
    main: { spot: mainSpot, label: SIDE_LABEL[mainSpot] },
    bonus: bonus ? { spot: bonus.spot, label: bonus.label, note: bonus.note } : null,
    mood,
    lines,
    lastName,
  };
}
