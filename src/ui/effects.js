// Lightweight, self-cleaning visual effects layered on top of the felt: a chip
// that arcs from the rail to the spot you tapped, a payout-scaled coin shower that
// flies from a winning spot into the wallet, and a full-screen gold flash for a
// headline win. Everything is spawned into <body>, animates via CSS, and removes
// itself on animationend, so there is no state to manage and no cleanup to forget.

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// A chip arcs from `fromEl` (the selected rail chip) to `toEl` (the tapped spot).
export function flyChip(fromEl, toEl, value) {
  if (reduced() || !fromEl || !toEl) return;
  const a = centre(fromEl);
  const b = centre(toEl);
  const chip = document.createElement('div');
  chip.className = 'fly-chip chip';
  chip.dataset.value = String(value);
  chip.style.left = `${a.x}px`;
  chip.style.top = `${a.y}px`;
  chip.style.setProperty('--dx', `${b.x - a.x}px`);
  chip.style.setProperty('--dy', `${b.y - a.y}px`);
  chip.style.setProperty('--arc', `${-46 - Math.random() * 26}px`);
  document.body.appendChild(chip);
  chip.addEventListener('animationend', () => chip.remove(), { once: true });
}

// `count` gold coins spray from a winning spot and are drawn into the wallet HUD.
export function coinShower(fromEl, toEl, count) {
  if (reduced() || !fromEl || !toEl) return;
  const a = centre(fromEl);
  const b = centre(toEl);
  for (let i = 0; i < count; i += 1) {
    const coin = document.createElement('i');
    coin.className = 'coin-fly';
    coin.style.left = `${a.x}px`;
    coin.style.top = `${a.y}px`;
    coin.style.setProperty('--dx', `${b.x - a.x + (Math.random() * 44 - 22)}px`);
    coin.style.setProperty('--dy', `${b.y - a.y}px`);
    coin.style.setProperty('--arc', `${-40 - Math.random() * 70}px`);
    coin.style.setProperty('--spin', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    coin.style.animationDelay = `${(i * 0.028).toFixed(3)}s`;
    document.body.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove(), { once: true });
  }
}

// A brief gold vignette pulse from the screen edges — reserved for headline wins.
export function screenFlash(kind = 'gold') {
  if (reduced()) return;
  const flash = document.createElement('div');
  flash.className = `screen-flash flash-${kind}`;
  document.body.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });
}
