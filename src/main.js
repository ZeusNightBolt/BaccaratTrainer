import { GameState, STARTING_BANKROLL } from './game/state.js';
import { TableView } from './ui/table.js';
import { RoadmapView } from './ui/roadmapView.js';
import { renderChipRail, formatCurrency } from './ui/chips.js';
import { RULES_HTML } from './ui/rulesContent.js';
import { PayoutSettingsView } from './ui/payoutSettings.js';
import { RoadGenieView } from './ui/roadGenieView.js';
import { TrainingModes } from './ui/trainingModes.js';
import { flyChip, coinShower, screenFlash, dragonRoar } from './ui/effects.js';

const appRoot = document.getElementById('app');
const game = new GameState();
const table = new TableView(appRoot);
const roadmap = new RoadmapView(document.getElementById('scoreboard'));
const genie = new RoadGenieView(appRoot, game, { spotEls: table.spotEls });
const training = new TrainingModes({
  app: appRoot,
  game,
  roadmap,
  spotEls: table.spotEls,
  onBoardChanged: () => {
    roadmap.render(game);
    refreshStats();
  },
});

let selectedChip = 100; // default to the $100 main-game minimum

const el = {
  bankroll: document.getElementById('stat-bankroll'),
  net: document.getElementById('stat-net'),
  shoe: document.getElementById('stat-shoe'),
  pen: document.getElementById('stat-pen'),
  totalBet: document.getElementById('total-bet'),
  balance: document.getElementById('balance'),
  penetration: document.getElementById('penetration-fill'),
  chipRail: document.getElementById('chip-rail'),
  betSpots: Array.from(document.querySelectorAll('.bet-spot')),
  roadToggle: document.getElementById('road-toggle'),
  btnClear: document.getElementById('btn-clear'),
  btnRebet: document.getElementById('btn-rebet'),
  btnUndo: document.getElementById('btn-undo'),
  btnDeal: document.getElementById('btn-deal'),
  rulesModal: document.getElementById('rules-modal'),
  rulesBody: document.getElementById('rules-body'),
  btnRules: document.getElementById('btn-rules'),
  rulesClose: document.getElementById('rules-close'),
  statsModal: document.getElementById('stats-modal'),
  statsBody: document.getElementById('stats-body'),
  btnSession: document.getElementById('btn-session'),
  statsClose: document.getElementById('stats-close'),
  btnResetSession: document.getElementById('btn-reset-session'),
  settingsModal: document.getElementById('settings-modal'),
  btnSettings: document.getElementById('btn-settings'),
  settingsClose: document.getElementById('settings-close'),
  payoutSun7: document.getElementById('payout-sun7'),
  payoutMoon8: document.getElementById('payout-moon8'),
};

const SESSION_KEY = 'baccaratTrainer.session.v1';

function saveSession() {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(game.serialize()));
  } catch {
    /* storage unavailable (private mode / disabled) — carry on in-memory */
  }
}

function loadSavedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    game.loadSession(JSON.parse(raw));
    shownBankroll = game.bankroll;
  } catch {
    /* corrupt or unavailable — start fresh */
  }
}

let locked = false;

function refreshPayoutLabels() {
  el.payoutSun7.textContent = `${game.payouts.sun7}:1`;
  el.payoutMoon8.textContent = `${game.payouts.moon8}:1`;
}

const payoutSettings = new PayoutSettingsView(document, game, {
  onChange: refreshPayoutLabels,
});

function refreshChipRail() {
  renderChipRail(el.chipRail, {
    selectedValue: selectedChip,
    onSelect: (value) => {
      selectedChip = value;
      refreshChipRail();
    },
  });
}

let shownBankroll = STARTING_BANKROLL;

function refreshStats() {
  el.shoe.textContent = `Shoe #${game.shoeNumber} · ${game.history.length}h`;
  const pct = Math.min(100, Math.round(game.shoe.penetration() * 100));
  el.penetration.style.width = `${pct}%`;
  if (el.pen) el.pen.textContent = `${pct}%`;
  animateBankroll(game.bankroll);
  refreshNet();
  refreshBetSummary();
}

function refreshNet() {
  const net = game.bankroll - game.startingBankroll;
  el.net.classList.remove('up', 'down');
  if (net > 0) {
    el.net.textContent = `+${formatCurrency(net)}`;
    el.net.classList.add('up');
  } else if (net < 0) {
    el.net.textContent = `-${formatCurrency(-net)}`;
    el.net.classList.add('down');
  } else {
    el.net.textContent = 'Even';
  }
}

function refreshBetSummary() {
  el.totalBet.textContent = formatCurrency(game.totalWagered);
  el.balance.textContent = formatCurrency(game.bankroll);
}

// Count the bankroll up/down over ~500ms with a colour flash on change.
let bankrollRaf = null;
function animateBankroll(target) {
  if (target === shownBankroll) {
    el.bankroll.textContent = formatCurrency(target);
    return;
  }
  const from = shownBankroll;
  const delta = target - from;
  const start = performance.now();
  const dur = 500;
  el.bankroll.classList.remove('flash-up', 'flash-down');
  el.bankroll.classList.add(delta > 0 ? 'flash-up' : 'flash-down');
  if (bankrollRaf) cancelAnimationFrame(bankrollRaf);

  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - t) * (1 - t);
    const value = Math.round(from + delta * eased);
    el.bankroll.textContent = formatCurrency(value);
    if (t < 1) {
      bankrollRaf = requestAnimationFrame(step);
    } else {
      shownBankroll = target;
      setTimeout(() => el.bankroll.classList.remove('flash-up', 'flash-down'), 400);
    }
  };
  bankrollRaf = requestAnimationFrame(step);
}

function sparkleBurst(spotEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = spotEl.getBoundingClientRect();
  const burst = document.createElement('div');
  burst.className = 'burst';
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  for (let i = 0; i < 12; i += 1) {
    const p = document.createElement('i');
    const angle = (Math.PI * 2 * i) / 12 + (i % 2) * 0.3;
    const dist = 34 + (i % 3) * 12;
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
    burst.appendChild(p);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 800);
}

function refreshActionButtons() {
  const betting = game.canBet() && !locked;
  const hasBet = game.hasBets();
  const hasLastBet = Object.keys(game.lastBets).length > 0;
  el.btnDeal.disabled = !betting || !game.hasValidBet();
  el.btnClear.disabled = !betting || !hasBet;
  el.btnUndo.disabled = !betting || !hasBet;
  el.btnRebet.disabled = !betting || !hasLastBet || hasBet;
  el.btnSettings.disabled = !betting;
  el.betSpots.forEach((spotEl) => {
    spotEl.disabled = !betting;
  });
}

// Reflect a bet change across the felt, HUD and buttons in one call.
function afterBetChange() {
  table.updateBets(game.bets);
  refreshBetSummary();
  refreshActionButtons();
}

function toast(message) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 250);
  }, 1800);
}

function withErrorToast(fn) {
  try {
    fn();
  } catch (err) {
    toast(err.message);
  }
}

el.betSpots.forEach((spotEl) => {
  spotEl.addEventListener('click', () => {
    if (!game.canBet() || locked) return;
    withErrorToast(() => {
      game.placeChip(spotEl.dataset.spot, selectedChip);
      afterBetChange();
      // a chip arcs from the rail to the spot you tapped
      flyChip(el.chipRail.querySelector('.chip.selected'), spotEl, selectedChip);
    });
  });
});

// The roads are a collapsible dropdown so the table stays centered by default.
el.roadToggle.addEventListener('click', () => {
  const open = !appRoot.classList.contains('roads-open');
  appRoot.classList.toggle('roads-open', open);
  el.roadToggle.setAttribute('aria-expanded', String(open));
});

el.btnClear.addEventListener('click', () => {
  game.clearAllBets();
  afterBetChange();
});

el.btnUndo.addEventListener('click', () => {
  game.undoLastChip();
  afterBetChange();
});

el.btnRebet.addEventListener('click', () => {
  withErrorToast(() => {
    game.rebet();
    afterBetChange();
  });
});

el.btnDeal.addEventListener('click', async () => {
  if (locked || !game.canBet() || !game.hasValidBet()) return;
  locked = true;
  refreshActionButtons();

  const round = game.playRound();
  await table.dealAnimated(round.hand);
  const jackpots = table.showResult(round);
  refreshStats();
  roadmap.render(game);
  genie.render();
  training.onHandComplete();
  jackpots.forEach(sparkleBurst);

  // The dragon breathes fire on the rare 3-card-7 Banker (Sun 7) or 3-card-8
  // Player (Moon 8) bonus condition — celebrated whether or not it was bet.
  if (round.hand.bankerThreeCardSeven || round.hand.playerThreeCardEight) dragonRoar();

  // Celebrate a win in proportion to what it paid: coins pour from every winning
  // spot into the wallet, and a headline win flashes the whole screen gold.
  if (round.netChange > 0) {
    const winEls = Object.values(table.spotEls).filter((s) => s.classList.contains('spot-win'));
    const coins = Math.min(28, 7 + Math.floor(round.netChange / 400));
    const per = Math.max(3, Math.ceil(coins / Math.max(1, winEls.length)));
    winEls.forEach((s) => coinShower(s, el.bankroll, per));
    if (round.netChange >= 2000 || jackpots.length) screenFlash('gold');
  }

  if (game.bankroll <= 0) {
    game.bankroll = STARTING_BANKROLL;
    game.startingBankroll = STARTING_BANKROLL;
    game.peakBankroll = STARTING_BANKROLL;
    game.history = [];
    shownBankroll = STARTING_BANKROLL;
    toast(`Bankroll reset to ${formatCurrency(STARTING_BANKROLL)} for continued practice`);
    refreshStats();
  }

  saveSession();

  setTimeout(() => {
    game.returnToBetting();
    table.updateBets(game.bets);
    locked = false;
    refreshBetSummary();
    refreshActionButtons();
    training.onHandComplete();
    genie.applyHighlight();
  }, 1900);
});

function openModal(modalEl) {
  modalEl.hidden = false;
}
function closeModal(modalEl) {
  modalEl.hidden = true;
}

el.btnRules.addEventListener('click', () => {
  el.rulesBody.innerHTML = RULES_HTML;
  openModal(el.rulesModal);
});
el.rulesClose.addEventListener('click', () => closeModal(el.rulesModal));
el.rulesModal.addEventListener('click', (e) => {
  if (e.target === el.rulesModal) closeModal(el.rulesModal);
});

function streakLabel(streak) {
  if (!streak.outcome) return '—';
  const name = { PLAYER: 'P', BANKER: 'B', TIE: 'T' }[streak.outcome];
  return `${streak.len}×${name}`;
}

function sparkline(curve) {
  if (curve.length < 2) {
    return '<div class="sparkline-empty">Play a few hands to chart your bankroll</div>';
  }
  const W = 100;
  const H = 64;
  const pad = 6;
  const min = Math.min(...curve);
  const max = Math.max(...curve);
  const range = max - min || 1;
  const x = (i) => (i / (curve.length - 1)) * W;
  const y = (v) => H - pad - ((v - min) / range) * (H - pad * 2);
  const pts = curve.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = pts.join(' ');
  const area = `${x(0).toFixed(2)},${H} ${line} ${x(curve.length - 1).toFixed(2)},${H}`;
  const baseY = y(curve[0]).toFixed(2);
  return `
    <svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(230,198,110,0.28)" />
          <stop offset="100%" stop-color="rgba(230,198,110,0)" />
        </linearGradient>
      </defs>
      <line class="spark-base" x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" />
      <polygon class="spark-area" points="${area}" />
      <polyline class="spark-line" points="${line}" />
    </svg>`;
}

function renderSession() {
  const s = game.stats();
  const net = s.netSinceStart;
  const netCls = net > 0 ? 'up' : net < 0 ? 'down' : 'flat';
  const netText = net > 0 ? `+${formatCurrency(net)}` : net < 0 ? `-${formatCurrency(-net)}` : 'Even';
  const total = Math.max(1, s.handsPlayed);
  const pct = (n) => `${Math.round((n / total) * 100)}%`;

  el.statsBody.innerHTML = `
    <div class="session-hero">
      <div class="session-hero-main">
        <div class="session-net ${netCls}">${netText}</div>
        <div class="session-net-label">Net this session</div>
      </div>
      <div class="session-bankroll">
        <div class="sb-value">${formatCurrency(game.bankroll)}</div>
        <div class="sb-label">Bankroll</div>
      </div>
    </div>

    ${sparkline(s.curve)}

    <div class="outcome-bar">
      <div class="seg-banker" style="width:${pct(s.wins.banker)}"></div>
      <div class="seg-player" style="width:${pct(s.wins.player)}"></div>
      <div class="seg-tie" style="width:${pct(s.wins.tie)}"></div>
    </div>
    <div class="outcome-bar-legend">
      <span class="obl-banker">Banker ${s.wins.banker}</span>
      <span class="obl-player">Player ${s.wins.player}</span>
      <span class="obl-tie">Tie ${s.wins.tie}</span>
    </div>

    <div class="stats-grid">
      <div class="stats-tile"><div class="tile-value">${s.handsPlayed}</div><div class="tile-label">Hands</div></div>
      <div class="stats-tile"><div class="tile-value ${s.biggestWin > 0 ? 'up' : ''}">${formatCurrency(s.biggestWin)}</div><div class="tile-label">Best Hand</div></div>
      <div class="stats-tile"><div class="tile-value gold">${formatCurrency(s.peakBankroll)}</div><div class="tile-label">Peak</div></div>
      <div class="stats-tile"><div class="tile-value">${streakLabel(s.currentStreak)}</div><div class="tile-label">Streak Now</div></div>
      <div class="stats-tile"><div class="tile-value">${streakLabel(s.longestStreak)}</div><div class="tile-label">Longest Run</div></div>
      <div class="stats-tile"><div class="tile-value">#${game.shoeNumber}</div><div class="tile-label">Shoe</div></div>
    </div>
  `;
}

el.btnSession.addEventListener('click', () => {
  renderSession();
  openModal(el.statsModal);
});
el.statsClose.addEventListener('click', () => closeModal(el.statsModal));
el.statsModal.addEventListener('click', (e) => {
  if (e.target === el.statsModal) closeModal(el.statsModal);
});

el.btnResetSession.addEventListener('click', () => {
  game.bankroll = STARTING_BANKROLL;
  game.startingBankroll = STARTING_BANKROLL;
  game.peakBankroll = STARTING_BANKROLL;
  game.history = [];
  shownBankroll = STARTING_BANKROLL;
  saveSession();
  refreshStats();
  renderSession();
  toast('Session reset');
});

el.btnSettings.addEventListener('click', () => {
  if (el.btnSettings.disabled) return;
  payoutSettings.refresh();
  openModal(el.settingsModal);
});
el.settingsClose.addEventListener('click', () => closeModal(el.settingsModal));
el.settingsModal.addEventListener('click', (e) => {
  if (e.target === el.settingsModal) closeModal(el.settingsModal);
});

loadSavedSession();
refreshChipRail();
refreshStats();
refreshActionButtons();
refreshPayoutLabels();
table.updateBets(game.bets);
roadmap.render(game);
