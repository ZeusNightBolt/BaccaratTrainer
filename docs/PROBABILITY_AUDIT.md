# Probability, RNG, and Rules-Fidelity Audit

Date: 2026-07-07 · Scope: `src/game/` (shoe, rules, side bets, state) · Branch: `claude/casino-gateway-probability-check-cpfzy1`

## Methodology

1. Line-by-line review of `src/game/shoe.js`, `rules.js`, `sidebets.js`, `state.js` against the
   Punto Banco tableau and the EZ Baccarat (commission-free) paytable as spread in Atlantic
   City / Resorts World, including the Sun 7 (Dragon 7), Moon 8 (Panda 8), and Dragon Bonus
   side bets.
2. Full unit/integration suite: `npm test` (`node --test src/game/*.test.js`).
3. 20,000,000-hand Monte-Carlo simulation through the real engine (`Shoe` → `playHand` →
   `resolveBets`, seeded mulberry32 injected via the test-only rng hook), compared against
   closed-form 8-deck theory. Standard error at 20 M hands is ≈0.01 % for outcome
   frequencies and ≈0.03–0.13 % for bet EVs (higher for the long-odds side bets).
4. RNG review of every live (non-test) code path.

## Findings

| # | Area | Severity | Finding | Status |
|---|------|----------|---------|--------|
| 1 | RNG — live shuffle | **High** | The production shuffle defaulted to `Math.random` (`shuffle(cards, rng = Math.random)`; `main.js` constructs `GameState()` with no rng, so every live shoe was shuffled with a non-cryptographic PRNG). | **Fixed.** Default shuffle now draws each Fisher–Yates index from `crypto.getRandomValues` via `cryptoRandomInt()`, with rejection sampling over 2³² so there is no modulo bias. Seedable float RNGs remain injectable for tests only; new tests lock in range/coverage of `cryptoRandomInt` and the default shuffle permutation. |
| 2 | RNG — shuffle algorithm | — | Fisher–Yates loop itself is correct (i from n−1 down to 1, j uniform on [0, i]). | Verified, no change. |
| 3 | Shoe composition | — | 8 decks × 52 = 416 cards, correct 13×4 multiset per deck; shuffle is a pure permutation; `draw()` consumes without duplication and throws when empty; reshuffle only ever happens between hands. | Verified, no change. |
| 4 | Burn / cut card | Info | First card turned, its value burned (10/J/Q/K burn 10) — standard procedure. Cut-card model: new shoe once fewer than 16 cards remain before a hand (max hand consumes 6, so the shoe can never run dry mid-hand). Real tables place the cut ~14 cards from the back and finish one more hand; the 16-card reserve is an equivalent-realism simplification. | Acceptable; no change. |
| 5 | Third-card tableau | — | Player draws 0–5, stands 6–7; natural 8/9 on either side stops the deal. Banker: 0–2 always draws; 3 draws unless player's third is 8; 4 draws vs 2–7; 5 draws vs 4–7; 6 draws vs 6–7 only; 7 stands; player standing ⇒ banker draws 0–5. Dealing order P, B, P, B, P-third, B-third. All exactly per Punto Banco. | Verified, no change. |
| 6 | Main-bet payouts | — | This trainer models **EZ Baccarat**: Banker pays 1:1 with no commission and **pushes** on a winning three-card Banker 7; Player pays 1:1; Tie pays 8:1; Player/Banker push on ties. (The classic 0.95-commission table is intentionally not modeled; the EZ variant is internally consistent and correctly implemented.) | Verified, no change. |
| 7 | Side bets | — | Sun 7 pays 40:1 on Banker winning three-card 7; Moon 8 pays 25:1 on Player winning three-card 8; Dragon Bonus pays 1:1 flat on a natural win, the 30/10/6/4/2/1 ladder on non-natural wins by 9…4, pushes on a natural tie, loses otherwise — all per the published paytables. Sun 7/Moon 8 ratios are player-adjustable (5–100, integers, between hands only) and clearly disclosed. | Verified, no change. |
| 8 | Money handling | — | `resolveBets` returns stake+profit on win, stake on push, 0 on loss; `GameState.playRound` deducts total stake then credits total returned. Integration test holds bankroll invariants over 4,000 seeded hands. | Verified, no change. |
| 9 | Honesty | Info | The "Genie" oracle reads only past outcomes (`shoeRounds` history), never future shoe cards, and its own comments state it predicts nothing; nothing in the deal path conditions on history or bets. Cosmetic `Math.random` uses (card tilt, chip arcs, genie theatrics) do not touch outcomes. | Verified, no change. |

## Verified numbers (20 M hands vs 8-deck closed-form theory)

| Quantity | Simulated | Theory |
|---|---|---|
| P(Player win) | 44.6277 % | 44.6247 % |
| P(Banker win) | 45.8648 % | 45.8597 % |
| P(Tie) | 9.5075 % | 9.5156 % |
| P(Banker 3-card 7 win) — Sun 7 | 2.2511 % | 2.2530 % |
| P(Player 3-card 8 win) — Moon 8 | 3.4538 % | 3.4543 % |
| Player bet house edge | 1.2371 % | 1.2351 % |
| Banker bet (EZ, push on 3-card 7) house edge | 1.0140 % | 1.0184 % |
| Tie 8:1 house edge | 14.4326 % | 14.3596 % |
| Sun 7 at 40:1 house edge | 7.7065 % | 7.6265 % |
| Moon 8 at 25:1 house edge | 10.2022 % | 10.1882 % |
| Player Dragon Bonus house edge | 2.6450 % | ≈2.651 % |
| Banker Dragon Bonus house edge | 9.4258 % | ≈9.372 % |

All deviations are within Monte-Carlo standard error. Verdict: **drawing rules, shoe
composition, and payout mathematics are faithful to the modeled EZ Baccarat game.**

## Recommendations (no code change made)

- If a classic commission table (Banker pays 0.95, edge ≈1.06 %) is ever added, follow the
  same pattern: closed-form edge first, Monte-Carlo assertion, then UI.
- A CI-level Monte-Carlo gate (smaller N with generous tolerances) would catch future
  paytable or tableau regressions automatically; the current suite covers the rules
  branch-by-branch but not aggregate edges.
- `Shoe.penetration()` divides by post-burn card count; if a penetration marker is ever
  displayed against the physical 416-card shoe, decide explicitly which denominator the UI
  should show.

## Test run

`npm test` — 78 tests, 78 pass, 0 fail (includes 2 new RNG tests added by this audit).
`npm run lint` — clean.
