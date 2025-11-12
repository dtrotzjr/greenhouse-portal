import { apiClient } from './api/client';
import { SensorDisplay } from './components/SensorDisplay';
import { SystemDisplay } from './components/SystemDisplay';
import { ImageDisplay } from './components/ImageDisplay';
import { DatePicker } from './components/DatePicker';
import { TimeSlider } from './components/TimeSlider';
import { UnitSelector, TemperatureUnit } from './components/UnitSelector';
import { DataPointWithData } from './types';

class GreenhouseDashboard {
  private sensorDisplay: SensorDisplay;
  private systemDisplay: SystemDisplay;
  private imageDisplay: ImageDisplay;
  private datePicker: DatePicker;
  private timeSlider: TimeSlider;
  private unitSelector: UnitSelector;

  private currentData: DataPointWithData | null = null;
  private selectedDate: Date = new Date();
  private selectedTimestamp: number | null = null;
  private autoRefreshInterval: number | null = null;
  private isViewingCurrent: boolean = true;

  constructor() {
    this.sensorDisplay = new SensorDisplay('sensor-display');
    this.systemDisplay = new SystemDisplay('system-display');
    this.imageDisplay = new ImageDisplay('image-display');
    this.datePicker = new DatePicker('date-picker');
    this.timeSlider = new TimeSlider('time-slider');
    this.unitSelector = new UnitSelector('unit-selector');

    this.setupEventHandlers();
    this.initialize();
  }

  private setupEventHandlers(): void {
    this.datePicker.onChange((date: Date) => {
      this.selectedDate = date;
      this.isViewingCurrent = this.isToday(date);
      this.loadDataPointsForDate(date);
      this.stopAutoRefresh();
      if (this.isViewingCurrent) {
        this.startAutoRefresh();
      }
    });

    this.timeSlider.onChange((timestamp: number) => {
      this.selectedTimestamp = timestamp;
      this.isViewingCurrent = false;
      this.stopAutoRefresh();
      this.loadDataForTimestamp(timestamp);
    });

    this.unitSelector.onChange((unit: TemperatureUnit) => {
      if (this.currentData) {
        this.renderData(this.currentData, unit);
      }
    });
  }

  private async initialize(): Promise<void> {
    // Set date picker to today
    const today = new Date();
    this.datePicker.setDate(today);
    this.datePicker.setMaxDate(today);

    // Load current data
    await this.loadCurrentData();
    this.startAutoRefresh();
  }

  private async loadCurrentData(): Promise<void> {
    try {
      const data = await apiClient.getCurrentData();
      this.currentData = data;
      this.selectedTimestamp = data.dataPoint.timestamp;
      this.isViewingCurrent = true;

      // Update date picker if needed
      const dataDate = new Date(data.dataPoint.timestamp * 1000);
      this.datePicker.setDate(dataDate);

      // Load timestamps for the day
      await this.loadDataPointsForDate(dataDate);

      this.renderData(data, this.unitSelector.getUnit());
    } catch (error) {
      console.error('Error loading current data:', error);
      this.showError('Failed to load current data');
    }
  }

  private async loadDataPointsForDate(date: Date): Promise<void> {
    try {
      const timestamps = await apiClient.getDataPointsForDate(date);
      this.timeSlider.setTimestamps(timestamps);

      // If viewing current day, select the latest timestamp
      if (this.isToday(date) && timestamps.length > 0) {
        const latestTimestamp = timestamps[timestamps.length - 1];
        this.timeSlider.setTimestamp(latestTimestamp);
        this.selectedTimestamp = latestTimestamp;
        await this.loadDataForTimestamp(latestTimestamp);
      } else if (timestamps.length > 0) {
        // For historical dates, select the latest by default
        const latestTimestamp = timestamps[timestamps.length - 1];
        this.timeSlider.setTimestamp(latestTimestamp);
        this.selectedTimestamp = latestTimestamp;
        await this.loadDataForTimestamp(latestTimestamp);
      }
    } catch (error) {
      console.error('Error loading data points for date:', error);
      this.timeSlider.setTimestamps([]);
    }
  }

  private async loadDataForTimestamp(timestamp: number): Promise<void> {
    try {
      const data = await apiClient.getDataByTimestamp(timestamp);
      this.currentData = data;
      this.renderData(data, this.unitSelector.getUnit());
    } catch (error) {
      console.error('Error loading data for timestamp:', error);
      this.showError('Failed to load data');
    }
  }

  private renderData(data: DataPointWithData, unit: TemperatureUnit): void {
    this.sensorDisplay.render(data.sensors, unit);
    this.systemDisplay.render(data.systemData, unit);
    this.imageDisplay.render(data.image);

    // Update timestamp display
    const timestampEl = document.getElementById('current-timestamp');
    if (timestampEl) {
      const date = new Date(data.dataPoint.timestamp * 1000);
      timestampEl.textContent = date.toLocaleString();
    }
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      return;
    }

    this.autoRefreshInterval = window.setInterval(() => {
      if (this.isViewingCurrent) {
        this.loadCurrentData();
      }
    }, 30000); // 30 seconds
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  private showError(message: string): void {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new GreenhouseDashboard();
  });
} else {
  new GreenhouseDashboard();
}

