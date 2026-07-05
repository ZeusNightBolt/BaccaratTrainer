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

const MAX_VISIBLE_MINI_CHIPS = 4;

// Renders a small overlapping stack of mini chips representing a bet's approximate
// composition (largest denominations first), capped with a "+N" badge so a single
// spot never grows tall enough to spill outside its own border.
export function renderChipStack(container, amount) {
  container.innerHTML = '';
  container.classList.toggle('has-chips', amount > 0);
  if (!amount) return;

  let remaining = amount;
  const denominations = [...CHIP_VALUES].reverse();
  const stackChips = [];

  for (const value of denominations) {
    while (remaining >= value && stackChips.length < 20) {
      stackChips.push(value);
      remaining -= value;
    }
  }
  // Any leftover odd amount (e.g. a manually-set minimum) is shown as one more chip
  // of the smallest denomination so the stake badge and stack never disagree.
  if (remaining > 0) stackChips.push(CHIP_VALUES[0]);

  const visible = stackChips.slice(0, MAX_VISIBLE_MINI_CHIPS);
  visible.forEach((value, i) => {
    const mini = document.createElement('span');
    mini.className = 'chip mini';
    // The top (last) chip drops in, so adding to a bet reads as a fresh chip landing.
    if (i === visible.length - 1) mini.classList.add('chip-drop');
    mini.dataset.value = String(value);
    container.appendChild(mini);
  });

  const hiddenCount = stackChips.length - visible.length;
  if (hiddenCount > 0) {
    const overflow = document.createElement('span');
    overflow.className = 'chip-overflow';
    overflow.textContent = `+${hiddenCount}`;
    container.appendChild(overflow);
  }
}
