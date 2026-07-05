import { GameState, STARTING_BANKROLL } from './game/state.js';
import { TableView } from './ui/table.js';
import { RoadmapView } from './ui/roadmapView.js';
import { renderChipRail, formatCurrency, CHIP_VALUES } from './ui/chips.js';
import { RULES_HTML } from './ui/rulesContent.js';
import { PayoutSettingsView } from './ui/payoutSettings.js';
import { RoadGenieView } from './ui/roadGenieView.js';

const game = new GameState();
const table = new TableView(document.getElementById('app'));
const roadmap = new RoadmapView(document.getElementById('scoreboard'));
const genie = new RoadGenieView(document.getElementById('app'), game);

let selectedChip = CHIP_VALUES[1]; // default to $25

const el = {
  bankroll: document.getElementById('stat-bankroll'),
  shoe: document.getElementById('stat-shoe'),
  penetration: document.getElementById('penetration-fill'),
  chipRail: document.getElementById('chip-rail'),
  betSpots: Array.from(document.querySelectorAll('.bet-spot')),
  btnClear: document.getElementById('btn-clear'),
  btnRebet: document.getElementById('btn-rebet'),
  btnDouble: document.getElementById('btn-double'),
  btnDeal: document.getElementById('btn-deal'),
  rulesModal: document.getElementById('rules-modal'),
  rulesBody: document.getElementById('rules-body'),
  btnRules: document.getElementById('btn-rules'),
  rulesClose: document.getElementById('rules-close'),
  statsModal: document.getElementById('stats-modal'),
  statsBody: document.getElementById('stats-body'),
  btnStats: document.getElementById('btn-stats'),
  statsClose: document.getElementById('stats-close'),
  settingsModal: document.getElementById('settings-modal'),
  btnSettings: document.getElementById('btn-settings'),
  settingsClose: document.getElementById('settings-close'),
  payoutSun7: document.getElementById('payout-sun7'),
  payoutMoon8: document.getElementById('payout-moon8'),
};

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

function refreshStats() {
  el.bankroll.textContent = formatCurrency(game.bankroll);
  el.shoe.textContent = `#${game.shoeNumber} · Hand ${game.history.length}`;
  el.penetration.style.width = `${Math.min(100, Math.round(game.shoe.penetration() * 100))}%`;
}

function refreshActionButtons() {
  const betting = game.canBet() && !locked;
  const hasBet = game.totalWagered > 0;
  const hasLastBet = Object.keys(game.lastBets).length > 0;
  el.btnDeal.disabled = !betting || !game.hasValidBet();
  el.btnClear.disabled = !betting || !hasBet;
  el.btnRebet.disabled = !betting || !hasLastBet || hasBet;
  el.btnDouble.disabled = !betting || !hasBet;
  el.btnSettings.disabled = !betting;
  el.betSpots.forEach((spotEl) => {
    spotEl.disabled = !betting;
  });
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
      table.updateBets(game.bets);
      refreshActionButtons();
    });
  });
});

el.btnClear.addEventListener('click', () => {
  game.clearAllBets();
  table.updateBets(game.bets);
  refreshActionButtons();
});

el.btnRebet.addEventListener('click', () => {
  withErrorToast(() => {
    game.rebet();
    table.updateBets(game.bets);
    refreshActionButtons();
  });
});

el.btnDouble.addEventListener('click', () => {
  withErrorToast(() => {
    const current = { ...game.bets };
    for (const [spot, amount] of Object.entries(current)) {
      game.placeChip(spot, amount);
    }
    table.updateBets(game.bets);
    refreshActionButtons();
  });
});

el.btnDeal.addEventListener('click', async () => {
  if (locked || !game.canBet() || !game.hasValidBet()) return;
  locked = true;
  refreshActionButtons();

  const round = game.playRound();
  await table.dealAnimated(round.hand);
  table.showResult(round);
  refreshStats();
  roadmap.render(game);
  genie.render();

  if (game.bankroll <= 0) {
    game.bankroll = STARTING_BANKROLL;
    toast(`Bankroll reset to ${formatCurrency(STARTING_BANKROLL)} for continued practice`);
    refreshStats();
  }

  setTimeout(() => {
    game.returnToBetting();
    table.updateBets(game.bets);
    locked = false;
    refreshActionButtons();
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

el.btnStats.addEventListener('click', () => {
  const s = game.stats();
  el.statsBody.innerHTML = `
    <div class="stats-grid">
      <div class="stats-tile"><div class="tile-value">${s.handsPlayed}</div><div class="tile-label">Hands Played</div></div>
      <div class="stats-tile"><div class="tile-value">${formatCurrency(s.netSinceStart)}</div><div class="tile-label">Net Since Start</div></div>
      <div class="stats-tile"><div class="tile-value">${s.wins.banker}</div><div class="tile-label">Banker Wins</div></div>
      <div class="stats-tile"><div class="tile-value">${s.wins.player}</div><div class="tile-label">Player Wins</div></div>
      <div class="stats-tile"><div class="tile-value">${s.wins.tie}</div><div class="tile-label">Ties</div></div>
      <div class="stats-tile"><div class="tile-value">${formatCurrency(game.bankroll)}</div><div class="tile-label">Current Bankroll</div></div>
    </div>
  `;
  openModal(el.statsModal);
});
el.statsClose.addEventListener('click', () => closeModal(el.statsModal));
el.statsModal.addEventListener('click', (e) => {
  if (e.target === el.statsModal) closeModal(el.statsModal);
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

refreshChipRail();
refreshStats();
refreshActionButtons();
refreshPayoutLabels();
table.updateBets(game.bets);
roadmap.render(game);
