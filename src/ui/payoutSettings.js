const PRESETS = {
  sun7: [20, 25, 30, 35, 40],
  moon8: [10, 15, 20, 25, 30],
};

export class PayoutSettingsView {
  constructor(root, game, { onChange } = {}) {
    this.game = game;
    this.onChange = onChange || (() => {});

    this.controls = {};
    for (const spot of ['sun7', 'moon8']) {
      const slider = root.querySelector(`#${spot}-ratio`);
      const display = root.querySelector(`#${spot}-ratio-display`);
      const presets = root.querySelector(`#${spot}-presets`);
      this.controls[spot] = { slider, display, presets };

      presets.innerHTML = '';
      for (const value of PRESETS[spot]) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'preset-chip';
        chip.textContent = `${value}:1`;
        chip.addEventListener('click', () => this.apply(spot, value));
        presets.appendChild(chip);
      }

      slider.addEventListener('input', () => this.apply(spot, Number(slider.value)));
    }

    root.querySelector('#btn-reset-payouts').addEventListener('click', () => {
      this.game.resetSideBetPayouts();
      this.refresh();
      this.onChange();
    });
  }

  apply(spot, value) {
    try {
      this.game.setSideBetPayout(spot, value);
    } catch {
      // Betting may be closed mid-round; the slider still reflects the live value on next refresh().
    }
    this.refresh();
    this.onChange();
  }

  refresh() {
    for (const spot of ['sun7', 'moon8']) {
      const { slider, display, presets } = this.controls[spot];
      const value = this.game.payouts[spot];
      slider.value = String(value);
      display.textContent = String(value);
      presets.querySelectorAll('.preset-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.textContent === `${value}:1`);
      });
    }
  }
}
