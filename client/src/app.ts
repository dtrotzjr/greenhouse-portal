import { apiClient } from './api/client';
import { SensorDisplay } from './components/SensorDisplay';
import { SystemDisplay } from './components/SystemDisplay';
import { ImageDisplay } from './components/ImageDisplay';
import { DatePicker } from './components/DatePicker';
import { TimeSlider } from './components/TimeSlider';
import { UnitSelector, TemperatureUnit } from './components/UnitSelector';
import { ChartDisplay, TimePeriod } from './components/ChartDisplay';
import { SystemCharts } from './components/SystemCharts';
import { DataPointWithData } from './types';

class GreenhouseDashboard {
  private sensorDisplay: SensorDisplay;
  private systemDisplay: SystemDisplay;
  private imageDisplay: ImageDisplay;
  private datePicker: DatePicker;
  private timeSlider: TimeSlider;
  private unitSelector: UnitSelector;
  private chartDisplay: ChartDisplay;
  private systemCharts: SystemCharts;

  private currentData: DataPointWithData | null = null;
  private selectedDate: Date = new Date();
  private selectedTimestamp: number | null = null;
  private autoRefreshInterval: number | null = null;
  private isViewingCurrent: boolean = true;
  private currentPeriod: TimePeriod = 'day';

  constructor() {
    this.sensorDisplay = new SensorDisplay('sensor-display');
    this.systemDisplay = new SystemDisplay('system-display');
    this.imageDisplay = new ImageDisplay('image-display');
    this.datePicker = new DatePicker('date-picker');
    this.timeSlider = new TimeSlider('time-slider');
    this.unitSelector = new UnitSelector('unit-selector');
    this.chartDisplay = new ChartDisplay('temp-humidity-chart-container');
    this.systemCharts = new SystemCharts(
      'soc-temp-chart-container',
      'wifi-chart-container',
      'storage-chart-container'
    );

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
      this.chartDisplay.setUnit(unit);
      this.systemCharts.setUnit(unit);
      // Reload chart data with new unit
      this.loadChartData();
    });

    // Period selector handler
    const periodSelector = document.getElementById('period-selector') as HTMLSelectElement;
    if (periodSelector) {
      periodSelector.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.currentPeriod = target.value as TimePeriod;
        this.loadChartData();
      });
    }
  }

  private async initialize(): Promise<void> {
    // Set date picker to today
    const today = new Date();
    // Ensure selectedDate is initialized with today's date (normalized to midnight local time)
    this.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    this.datePicker.setDate(today);
    this.datePicker.setMaxDate(today);

    // Load current data
    await this.loadCurrentData();
    
    // Load chart data
    await this.loadChartData();
    
    this.startAutoRefresh();
  }

  private async loadCurrentData(): Promise<void> {
    try {
      const data = await apiClient.getCurrentData();
      this.currentData = data;
      this.selectedTimestamp = data.dataPoint.timestamp;
      this.isViewingCurrent = true;

      // Create a Date object from the timestamp (converts UTC to local time)
      const dataDateFromTimestamp = new Date(data.dataPoint.timestamp * 1000);
      
      // Extract local date components to create a date representing the local calendar date
      // This ensures we show the date that the timestamp represents in the user's local timezone
      const localDate = new Date(
        dataDateFromTimestamp.getFullYear(),
        dataDateFromTimestamp.getMonth(),
        dataDateFromTimestamp.getDate()
      );
      
      // Update both the date picker and selectedDate to ensure they're in sync
      this.datePicker.setDate(localDate);
      this.selectedDate = localDate;

      // Load timestamps for the day using the local date
      await this.loadDataPointsForDate(localDate);

      this.renderData(data, this.unitSelector.getUnit());
      
      // Reload chart data if date changed
      await this.loadChartData();
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
      
      // Reload chart data when date changes
      await this.loadChartData();
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
    // Compare dates using local date components
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

  private async loadChartData(): Promise<void> {
    try {
      let chartData: any;
      const date = this.selectedDate;
      const period = this.currentPeriod;

      if (period === 'day') {
        chartData = await apiClient.getChartDataForDay(date);
        await this.chartDisplay.render(chartData, 'day', date, this.unitSelector.getUnit());
        await this.systemCharts.render(chartData, 'day', this.unitSelector.getUnit());
      } else if (period === 'month') {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        chartData = await apiClient.getChartDataForMonth(year, month);
        await this.chartDisplay.render(chartData, 'month', date, this.unitSelector.getUnit());
        await this.systemCharts.render(chartData, 'month', this.unitSelector.getUnit());
      } else if (period === 'year') {
        const year = date.getFullYear();
        chartData = await apiClient.getChartDataForYear(year);
        await this.chartDisplay.render(chartData, 'year', date, this.unitSelector.getUnit());
        await this.systemCharts.render(chartData, 'year', this.unitSelector.getUnit());
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
      const chartContainer = document.getElementById('temp-humidity-chart-container');
      if (chartContainer) {
        chartContainer.innerHTML = '<p>Failed to load chart data</p>';
      }
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

