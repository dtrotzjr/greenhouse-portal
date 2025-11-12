export class DatePicker {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private onChangeCallback: ((date: Date) => void) | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;
    this.input = document.createElement('input');
    this.input.type = 'date';
    this.input.className = 'date-picker';
    this.container.appendChild(this.input);

    this.input.addEventListener('change', () => {
      if (this.onChangeCallback) {
        const date = new Date(this.input.value + 'T00:00:00');
        this.onChangeCallback(date);
      }
    });
  }

  setDate(date: Date): void {
    const dateStr = date.toISOString().split('T')[0];
    this.input.value = dateStr;
  }

  getDate(): Date {
    if (!this.input.value) {
      return new Date();
    }
    return new Date(this.input.value + 'T00:00:00');
  }

  setMaxDate(date: Date): void {
    this.input.max = date.toISOString().split('T')[0];
  }

  setMinDate(date: Date): void {
    this.input.min = date.toISOString().split('T')[0];
  }

  onChange(callback: (date: Date) => void): void {
    this.onChangeCallback = callback;
  }
}

