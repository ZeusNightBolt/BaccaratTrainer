export const CHIP_VALUES = [5, 25, 100, 500, 1000];

export function formatCurrency(amount) {
  return `$${amount.toLocaleString('en-US')}`;
}

export function renderChipRail(container, { selectedValue, onSelect }) {
  container.innerHTML = '';
  for (const value of CHIP_VALUES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip${value === selectedValue ? ' selected' : ''}`;
    chip.dataset.value = String(value);
    chip.textContent = value >= 1000 ? `${value / 1000}K` : value;
    chip.setAttribute('aria-label', `Select ${formatCurrency(value)} chip`);
    chip.addEventListener('click', () => onSelect(value));
    container.appendChild(chip);
  }
}

// Renders a small stack of mini chips representing a bet's approximate composition
// (largest denominations first) so the felt visually matches how a real stack looks.
export function renderChipStack(container, amount) {
  container.innerHTML = '';
  if (!amount) return;

  let remaining = amount;
  const denominations = [...CHIP_VALUES].reverse();
  const stackChips = [];

  for (const value of denominations) {
    while (remaining >= value && stackChips.length < 8) {
      stackChips.push(value);
      remaining -= value;
    }
  }
  // Any leftover odd amount (e.g. a manually-set minimum) is shown as one more chip
  // of the smallest denomination so the stake badge and stack never disagree.
  if (remaining > 0 && stackChips.length < 8) stackChips.push(CHIP_VALUES[0]);

  for (const value of stackChips) {
    const mini = document.createElement('span');
    mini.className = 'chip mini';
    mini.dataset.value = String(value);
    container.appendChild(mini);
  }
}
