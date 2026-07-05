# Baccarat Trainer — Sun 7 / Moon 8

[![CI](https://github.com/ZeusNightBolt/BaccaratTrainer/actions/workflows/ci.yml/badge.svg)](https://github.com/ZeusNightBolt/BaccaratTrainer/actions/workflows/ci.yml)
[![Deploy](https://github.com/ZeusNightBolt/BaccaratTrainer/actions/workflows/deploy.yml/badge.svg)](https://github.com/ZeusNightBolt/BaccaratTrainer/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live app: https://zeusnightbolt.github.io/BaccaratTrainer/**

A mini-baccarat trainer built to match how the game is actually spread on the floor at Atlantic City / Resorts World tables — the commission-free "EZ Baccarat" layout with the **Sun 7** (40:1) and **Moon 8** (25:1) side bets, both with adjustable paytables — instead of a generic textbook diagram. Betting felt, chip mechanics, card dealing, and the five live scoreboards are all modeled on real table behavior.

![Table view](assets/screenshots/table.png)

## Why this rebuild

The previous version got the math right but nothing about the table felt real: no proper betting layout, no chip mechanics, and no scoreboards. This rebuild keeps the theory and replaces everything around it — the felt layout, the two-chips-per-spot betting feel, card-by-card dealing, and a full roadmap suite — with production-style behavior modeled after the companion Blackjack and Roulette trainers.

## Features

- **Authentic mini-baccarat felt** — Player Pair / Banker Pair corner boxes, Player–Tie–Banker main ovals, and Moon 8 / Sun 7 side boxes laid out exactly where they sit on a real EZ Baccarat table.
- **Real chip mechanics** — pick a denomination ($5/$25/$100/$500/$1,000) off the rail, tap a spot to stack chips on it, with a live stake badge and a stack that visually rebuilds from largest to smallest denomination. Clear, Rebet, and Double all behave like a live table.
- **Card-by-card dealing** — cards are animated in the real dealing order (Player, Banker, Player, Banker, then the third cards), with hand totals updating as each card lands, naturals called immediately, and a result banner announcing the win (including Sun 7 / Moon 8 hits).
- **Five live scoreboards** — Big Road, Bead Plate, Big Eye Boy, Small Road, and Cockroach Road are all derived live from the shoe, including the traditional tie-mark-on-trailing-cell and pair-dot conventions, and the dragon-tail overflow when a streak runs past six rows.
- **A real 8-deck shoe** — burn card, cut card, penetration meter, and an automatic reshuffle (with fresh scoreboards) when the cut card is reached.
- **Commission-free Banker** — Banker pays 1:1 with no 5% rake; a Banker win on a three-card 7 pushes instead of paying, which is what funds the Sun 7 side bet, exactly as it works on the real EZ Baccarat felt.
- **Adjustable Sun 7 / Moon 8 paytables** — house ratios for these two side bets vary by casino, so the ⚙ settings panel lets you dial each one in (slider + common presets) between hands, defaulting to 40:1 / 25:1.
- **Session tools** — bankroll tracking (with an automatic practice-bankroll reset if you bust), hand/shoe counters, and a stats panel (hands played, win/loss split, net result).
- **In-app rules reference** — payouts, the third-card draw table, and a plain-English explanation of how to read each scoreboard.

![Dealt hand and result](assets/screenshots/result.png)
![Big Road, Big Eye Boy, Small Road, Cockroach Road](assets/screenshots/bigroad.png)

## Rules modeled

| Bet | Pays | Notes |
| --- | --- | --- |
| Player | 1:1 | Push on a tie |
| Banker | 1:1 | Commission-free; pushes (doesn't win) if Banker wins with a 3-card 7 |
| Tie | 8:1 | Player/Banker bets push |
| Player Pair | 11:1 | Player's first two cards match rank |
| Banker Pair | 11:1 | Banker's first two cards match rank |
| ☀ Sun 7 | 40:1 (adjustable) | Banker wins with a three-card total of 7 |
| 🌙 Moon 8 | 25:1 (adjustable) | Player wins with a three-card total of 8 |

Sun 7 and Moon 8 ratios can be retuned per-table from the ⚙ settings panel; every other payout is fixed. Full third-card drawing rules, and how to read each scoreboard, are available from the in-app **info** button.

## Tech stack

Deliberately dependency-free at runtime: vanilla ES modules, no framework, no bundler/build step — so it deploys to GitHub Pages as-is. The only tooling is dev-time: ESLint for linting and Node's built-in test runner for unit tests.

```
index.html            App shell
src/
  styles.css           All styling (casino felt theme, responsive)
  main.js              Wires state + UI together, event handling
  game/                Pure, framework-free game logic (fully unit-tested)
    rules.js            Hand values, third-card draw rules, hand resolution
    shoe.js              8-deck shoe: shuffle, burn, cut card, penetration
    sidebets.js          Bet resolution / payout math (incl. EZ Baccarat push rule)
    bigroad.js           Big Road + Bead Plate + derived "eye" roads
    state.js             Game/session state machine (bankroll, bets, history)
    *.test.js            Unit tests (node --test)
  ui/                  DOM rendering, no game logic
    table.js             Betting spots, card dealing animation, result banner
    chips.js              Chip rail + chip-stack rendering
    cards.js               Card element + dealing sequence
    roadmapView.js         Renders the five scoreboards from game state
    payoutSettings.js      Sun 7 / Moon 8 payout ratio editor
    rulesContent.js        In-app rules/help copy
```

## Local development

```bash
npm install
npm start      # serves the app at http://localhost:8080
npm test       # runs the game-logic unit test suite
npm run lint   # ESLint
```

No build step is required — `npm start` just serves the static files.

## CI/CD pipeline

- **`.github/workflows/ci.yml`** — runs on every push/PR to `main`: install, lint, test.
- **`.github/workflows/deploy.yml`** — on push to `main`: re-runs lint/test as a gate, assembles a publish bundle (dropping tests and dev tooling), and deploys it to GitHub Pages via `actions/deploy-pages`.

To enable the live link on a fork, turn on **Settings → Pages → Source: GitHub Actions** once.

## License

MIT — see [LICENSE](LICENSE).
