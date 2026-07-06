import { getRoadGenieReading } from '../game/roadGenie.js';

const SPOT_NAME = { banker: 'Banker', player: 'Player' };

const DRILL_ROADS = [
  { name: 'bigEyeBoy', label: 'Big Eye Boy', shape: 'ring' },
  { name: 'smallRoad', label: 'Small Road', shape: 'dot' },
  { name: 'cockroachRoad', label: 'Cockroach', shape: 'slash' },
];

// Owns the Play / Coach Me / Drill modes and the app's top-level mode chrome.
export class TrainingModes {
  constructor({ app, game, roadmap, spotEls, rng = Math.random, onBoardChanged }) {
    this.app = app;
    this.game = game;
    this.roadmap = roadmap;
    this.spotEls = spotEls;
    this.rng = rng;
    this.onBoardChanged = onBoardChanged || (() => {});
    this.mode = 'play';

    this.modeButtons = Array.from(app.querySelectorAll('.mode'));
    this.coachRail = app.querySelector('#coach-rail');
    this.coachVerdict = app.querySelector('#coach-verdict');
    this.coachLine = app.querySelector('#coach-line');
    this.coachConf = app.querySelector('#coach-conf');

    this.drillDock = app.querySelector('#drill-dock');
    this.drillQuestion = app.querySelector('#drill-question');
    this.drillAnswerBtns = Array.from(app.querySelectorAll('.drill-ans'));
    this.drillNextBtn = app.querySelector('#drill-next');
    this.drillAccuracy = app.querySelector('#drill-accuracy');
    this.drillStreak = app.querySelector('#drill-streak');
    this.drillCount = app.querySelector('#drill-count');

    this.drill = { count: 0, correct: 0, streak: 0, answer: null, locked: false };

    this.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    });
    this.drillAnswerBtns.forEach((btn) => {
      btn.addEventListener('click', () => this.answerDrill(btn.dataset.answer));
    });
    this.drillNextBtn.addEventListener('click', () => this.nextDrillQuestion());

    // Coach Me is the primary mode — open its rail on load.
    this.setMode('coach');
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.app.dataset.mode = mode;
    this.modeButtons.forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
    });

    this.coachRail.hidden = mode !== 'coach';
    this.drillDock.hidden = mode !== 'drill';

    // Drill is all about reading the board, so force the roads open and lock the
    // toggle; leaving Drill collapses them back to the default (table centered).
    const roadsOpen = mode === 'drill';
    this.app.classList.toggle('roads-open', roadsOpen);
    const roadToggle = this.app.querySelector('#road-toggle');
    if (roadToggle) {
      roadToggle.setAttribute('aria-expanded', String(roadsOpen));
      roadToggle.disabled = roadsOpen;
    }

    this.clearAdvise();

    if (mode === 'coach') this.renderCoach();
    if (mode === 'drill') this.startDrill();
  }

  // Called by the app after each real hand settles.
  onHandComplete() {
    if (this.mode === 'coach') this.renderCoach();
  }

  clearAdvise() {
    Object.values(this.spotEls).forEach((el) => el && el.classList.remove('coach-advise'));
  }

  // ---- Coach Me ----
  renderCoach() {
    const reading = getRoadGenieReading(this.game.road);
    this.clearAdvise();

    const s = reading.suggestion;
    this.coachVerdict.className = 'coach-verdict';
    if (s) {
      const verb = s.action === 'follow' ? 'Follow' : 'Fade';
      this.coachVerdict.classList.add(s.action);
      this.coachVerdict.textContent = `${verb} ${SPOT_NAME[s.spot]}`;
      const spotEl = this.spotEls[s.spot];
      if (spotEl && this.game.canBet()) spotEl.classList.add('coach-advise');
    } else {
      this.coachVerdict.textContent = 'Read';
    }

    this.coachLine.textContent = reading.lines[0] || 'Not enough of the shoe to read yet.';

    const conf = s ? s.confidence || 1 : 1;
    this.coachConf.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const pip = document.createElement('i');
      if (i < conf) pip.className = 'on';
      this.coachConf.appendChild(pip);
    }
  }

  // ---- Drill ----
  startDrill() {
    this.drill = { count: 0, correct: 0, streak: 0, answer: null, locked: false };
    this.refreshDrillScore();
    this.nextDrillQuestion();
  }

  // Finds a (road, side) whose forecast is defined, seeding the shoe if needed.
  pickDrillQuestion() {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const preds = { P: this.game.road.predict('P'), B: this.game.road.predict('B') };
      const options = [];
      for (const side of ['P', 'B']) {
        for (const road of DRILL_ROADS) {
          if (preds[side][road.name]) options.push({ side, road });
        }
      }
      if (options.length) {
        const pick = options[Math.floor(this.rng() * options.length)];
        return { ...pick, correct: preds[pick.side][pick.road.name] };
      }
      this.game.advanceShoe();
    }
    return null;
  }

  nextDrillQuestion() {
    this.drillNextBtn.hidden = true;
    this.drill.locked = false;
    this.drillAnswerBtns.forEach((b) => {
      b.classList.remove('correct', 'wrong');
      b.disabled = false;
    });

    const q = this.pickDrillQuestion();
    this.onBoardChanged();
    if (!q) {
      this.drillQuestion.textContent = 'Shuffling a fresh shoe…';
      return;
    }
    this.current = q;
    const sideName = q.side === 'P' ? 'Player' : 'Banker';
    this.drillQuestion.innerHTML =
      `Next hand <b>${sideName}</b> &mdash; what mark shows on ` +
      `<b>${q.road.label}</b> <span class="q-shape"><i class="derived-cell shape-${q.road.shape} outcome-R"></i></span>?`;
  }

  answerDrill(choice) {
    if (this.drill.locked || !this.current) return;
    this.drill.locked = true;
    const correct = this.current.correct; // 'R' | 'B'
    this.drill.count += 1;
    if (choice === correct) {
      this.drill.correct += 1;
      this.drill.streak += 1;
    } else {
      this.drill.streak = 0;
    }
    this.drillAnswerBtns.forEach((b) => {
      b.disabled = true;
      if (b.dataset.answer === correct) b.classList.add('correct');
      else if (b.dataset.answer === choice) b.classList.add('wrong');
    });
    this.refreshDrillScore();
    this.drillNextBtn.hidden = false;
    // Advance the real shoe so the next question sees a grown board.
    this.game.advanceShoe();
  }

  refreshDrillScore() {
    const { count, correct, streak } = this.drill;
    this.drillAccuracy.textContent = count ? `${Math.round((correct / count) * 100)}%` : '—';
    this.drillStreak.textContent = String(streak);
    this.drillCount.textContent = String(count);
  }
}
