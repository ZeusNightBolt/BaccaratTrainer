export const RULES_HTML = `
<h3>Object of the game</h3>
<p>Bet on which hand — Player or Banker — will total closer to 9, or bet on a Tie. Hand value is the sum of card ranks modulo 10 (aces = 1, 10/J/Q/K = 0, everything else face value).</p>

<h3>Payouts</h3>
<table>
  <tr><th>Bet</th><th>Pays</th><th>Notes</th></tr>
  <tr><td>Player</td><td>1:1</td><td>Push on a tie</td></tr>
  <tr><td>Banker</td><td>1:1</td><td>Commission-free. Pushes instead of winning if Banker wins with a 3-card 7</td></tr>
  <tr><td>Tie</td><td>8:1</td><td>Player and Banker bets push</td></tr>
  <tr><td>Player Pair</td><td>11:1</td><td>Player's first two cards match rank</td></tr>
  <tr><td>Banker Pair</td><td>11:1</td><td>Banker's first two cards match rank</td></tr>
  <tr><td>☀ Sun 7</td><td>40:1</td><td>Banker wins with a 3-card total of 7</td></tr>
  <tr><td>🌙 Moon 8</td><td>40:1</td><td>Player wins with a 3-card total of 8</td></tr>
</table>
<p>This is the commission-free "EZ Baccarat" style spread alongside Sun 7 / Moon 8 side bets found at Atlantic City and Resorts World tables: no 5% rake is taken off Banker wins, but a Banker win by exactly a three-card 7 pushes instead of paying — that forgone win is what funds the 40:1 Sun 7 payout.</p>

<h3>Third-card rule (dealt automatically)</h3>
<ul>
  <li>If either hand has a natural 8 or 9 on the first two cards, both stand — no further cards.</li>
  <li>Player draws a third card on 0–5, stands on 6–7.</li>
  <li>Banker's third card follows a fixed table based on its own total and the Player's third card (0–2 always draws, 7 always stands; 3–6 depend on what the Player drew).</li>
</ul>

<h3>Reading the scoreboards</h3>
<p><strong>Big Road</strong>: each result is plotted top-to-bottom in the current column; a repeat of the same winner continues the column, a change of winner starts a new one. Ties don't open a new column — they add a diagonal tie mark (with a count for multiple ties) to the last plotted result. Small dots mark Player/Banker pairs.</p>
<p><strong>Bead Plate</strong>: the same results in simple chronological order, filled straight down each column — including ties as their own cell.</p>
<p><strong>Big Eye Boy / Small Road / Cockroach Road</strong>: derived "trend" roads that compare the current Big Road column against columns one, two, and three steps back. A red mark means the pattern is repeating; blue means it just broke. They carry no predictive power over independent hands — they're a traditional way regulars read shoe patterns.</p>

<h3>Shoe</h3>
<p>Standard 8-deck shoe with a burn after shuffle and a cut card placed near the end, matching how the pit actually runs a shoe. When the cut card is reached, the shoe is replaced and the roads reset for the new shoe.</p>
`;
