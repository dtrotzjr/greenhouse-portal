export type TemperatureUnit = 'C' | 'F';

export class UnitSelector {
  private container: HTMLElement;
  private unit: TemperatureUnit = 'C';
  private onChangeCallback: ((unit: TemperatureUnit) => void) | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;

    const wrapper = document.createElement('div');
    wrapper.className = 'unit-selector';

    const celsiusBtn = document.createElement('button');
    celsiusBtn.textContent = '°C';
    celsiusBtn.className = 'unit-btn active';
    celsiusBtn.dataset.unit = 'C';

    const fahrenheitBtn = document.createElement('button');
    fahrenheitBtn.textContent = '°F';
    fahrenheitBtn.className = 'unit-btn';
    fahrenheitBtn.dataset.unit = 'F';

    const handleClick = (e: Event) => {
      const target = e.target as HTMLButtonElement;
      const newUnit = target.dataset.unit as TemperatureUnit;
      if (newUnit && newUnit !== this.unit) {
        this.setUnit(newUnit);
      }
    };

    celsiusBtn.addEventListener('click', handleClick);
    fahrenheitBtn.addEventListener('click', handleClick);

    wrapper.appendChild(celsiusBtn);
    wrapper.appendChild(fahrenheitBtn);
    this.container.appendChild(wrapper);
  }

  setUnit(unit: TemperatureUnit): void {
    this.unit = unit;
    const buttons = this.container.querySelectorAll('.unit-btn');
    buttons.forEach((btn) => {
      if ((btn as HTMLElement).dataset.unit === unit) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (this.onChangeCallback) {
      this.onChangeCallback(unit);
    }
  }

  getUnit(): TemperatureUnit {
    return this.unit;
  }

  onChange(callback: (unit: TemperatureUnit) => void): void {
    this.onChangeCallback = callback;
  }
}

