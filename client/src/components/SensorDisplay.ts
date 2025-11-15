import { SensorData } from '../types';
import { formatTemperature } from '../utils/temperature';

export class SensorDisplay {
  private container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    this.container = container;
  }

  render(sensors: SensorData[], unit: 'C' | 'F'): void {
    if (sensors.length === 0) {
      this.container.innerHTML = '<p>No sensor data available</p>';
      return;
    }

    const sensorsHtml = sensors
      .map(sensor => { 
        if (sensor.sensor_id === 1) { 
          return "Internal" 
        } else if (sensor.sensor_id === 2) {
          return "External"
        } else {
          return "Unknown"
        }
      }).map(
        (sensor) => `
      <div class="sensor-card">
        <h3>Sensor ${sensor}</h3>
        <div class="sensor-metrics">
          <div class="metric">
            <span class="metric-label">Temperature:</span>
            <span class="metric-value">${formatTemperature(sensor.temperature, unit)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Humidity:</span>
            <span class="metric-value">${sensor.humidity.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    this.container.innerHTML = `
      <div class="sensors-grid">
        ${sensorsHtml}
      </div>
    `;
  }
}

