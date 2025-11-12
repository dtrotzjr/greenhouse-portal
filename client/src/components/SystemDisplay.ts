import { SystemData } from '../types';
import { formatTemperature } from '../utils/temperature';

export class SystemDisplay {
  private container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;
  }

  formatBytes(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  }

  render(systemData: SystemData | null, unit: 'C' | 'F'): void {
    if (!systemData) {
      this.container.innerHTML = '<p>No system data available</p>';
      return;
    }

    const storageUsedPercent = ((systemData.storage_used / systemData.storage_total_size) * 100).toFixed(1);

    this.container.innerHTML = `
      <div class="system-card">
        <h3>System Information</h3>
        <div class="system-metrics">
          <div class="metric">
            <span class="metric-label">SOC Temperature:</span>
            <span class="metric-value">${formatTemperature(systemData.soc_temperature, unit)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">WiFi Signal:</span>
            <span class="metric-value">${systemData.wlan0_signal_level} dBm</span>
          </div>
          <div class="metric">
            <span class="metric-label">WiFi Link Quality:</span>
            <span class="metric-value">${(systemData.wlan0_link_quality * 100).toFixed(1)}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Storage Used:</span>
            <span class="metric-value">${this.formatBytes(systemData.storage_used)} / ${this.formatBytes(systemData.storage_total_size)} (${storageUsedPercent}%)</span>
          </div>
          <div class="metric">
            <span class="metric-label">Storage Available:</span>
            <span class="metric-value">${this.formatBytes(systemData.storage_avail)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

