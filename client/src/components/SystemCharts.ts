import { Chart, registerables } from 'chart.js';
import { TemperatureUnit } from './UnitSelector';
import { formatTemperature } from '../utils/temperature';

Chart.register(...registerables);

export type TimePeriod = 'day' | 'month' | 'year';

export class SystemCharts {
  private socTempContainer: HTMLElement;
  private wifiContainer: HTMLElement;
  private storageContainer: HTMLElement;
  private socTempChart: Chart | null = null;
  private wifiChart: Chart | null = null;
  private storageChart: Chart | null = null;
  private currentPeriod: TimePeriod = 'day';
  private unit: TemperatureUnit = 'C';
  private currentSystemData: any = null;
  private currentLabels: string[] = [];

  constructor(
    socTempContainerId: string,
    wifiContainerId: string,
    storageContainerId: string
  ) {
    const socTempContainer = document.getElementById(socTempContainerId);
    const wifiContainer = document.getElementById(wifiContainerId);
    const storageContainer = document.getElementById(storageContainerId);

    if (!socTempContainer) {
      throw new Error(`Container with id "${socTempContainerId}" not found`);
    }
    if (!wifiContainer) {
      throw new Error(`Container with id "${wifiContainerId}" not found`);
    }
    if (!storageContainer) {
      throw new Error(`Container with id "${storageContainerId}" not found`);
    }

    this.socTempContainer = socTempContainer;
    this.wifiContainer = wifiContainer;
    this.storageContainer = storageContainer;
  }

  setUnit(unit: TemperatureUnit): void {
    this.unit = unit;
    // Re-render SOC chart if we have data
    if (this.currentSystemData && this.currentLabels.length > 0) {
      this.renderSOCChart(this.currentLabels, this.currentSystemData);
    }
  }

  async render(data: any, period: TimePeriod, unit: TemperatureUnit = 'C'): Promise<void> {
    this.currentPeriod = period;
    this.unit = unit;

    if (!data || !data.systemData) {
      this.socTempContainer.innerHTML = '<p>No system data available</p>';
      this.wifiContainer.innerHTML = '<p>No system data available</p>';
      this.storageContainer.innerHTML = '<p>No system data available</p>';
      return;
    }

    const systemData = data.systemData;
    this.currentSystemData = systemData;

    // Prepare labels based on period
    let labels: string[] = [];
    if (period === 'day') {
      labels = (data.timestamps as number[]).map((ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      });
    } else if (period === 'month') {
      labels = (data.dates as string[]).map((dateStr: string) => {
        const d = new Date(dateStr);
        return d.getDate().toString();
      });
    } else if (period === 'year') {
      labels = (data.months as string[]).map((monthStr: string) => {
        const [year, month] = monthStr.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1);
        return d.toLocaleDateString('en-US', { month: 'short' });
      });
    }

    this.currentLabels = labels;

    // Render SOC Temperature Chart
    this.renderSOCChart(labels, systemData);

    // Render WiFi Chart
    this.renderWiFiChart(labels, systemData);

    // Render Storage Chart
    this.renderStorageChart(labels, systemData);
  }

  private renderSOCChart(labels: string[], systemData: any): void {
    // Store raw Celsius values for tooltip formatting
    const socAvgRaw = systemData.soc_temperature_avg;
    const socMinRaw = systemData.soc_temperature_min;
    const socMaxRaw = systemData.soc_temperature_max;

    // Convert temperatures based on unit
    const socAvg = socAvgRaw.map((t: number) => 
      isNaN(t) ? null : this.unit === 'F' ? (t * 9/5 + 32) : t
    );
    const socMin = socMinRaw.map((t: number) => 
      isNaN(t) ? null : this.unit === 'F' ? (t * 9/5 + 32) : t
    );
    const socMax = socMaxRaw.map((t: number) => 
      isNaN(t) ? null : this.unit === 'F' ? (t * 9/5 + 32) : t
    );

    this.socTempContainer.innerHTML = '<canvas id="soc-temp-chart"></canvas>';
    const canvas = document.getElementById('soc-temp-chart') as HTMLCanvasElement;

    if (this.socTempChart) {
      this.socTempChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const unitSymbol = this.unit === 'C' ? '°C' : '°F';

    this.socTempChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `SOC Temp Avg (${unitSymbol})`,
            data: socAvg,
            borderColor: 'rgb(220, 53, 69)',
            backgroundColor: 'rgba(220, 53, 69, 0.2)',
            tension: 0.1,
            pointRadius: 2,
          },
          {
            label: `SOC Temp Min (${unitSymbol})`,
            data: socMin,
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.2)',
            tension: 0.1,
            pointRadius: 1,
            borderDash: [5, 5],
          },
          {
            label: `SOC Temp Max (${unitSymbol})`,
            data: socMax,
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.2)',
            tension: 0.1,
            pointRadius: 1,
            borderDash: [5, 5],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: true,
            text: 'SOC Temperature',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  const dataIndex = context.dataIndex;
                  let rawTemp: number | null = null;
                  
                  if (context.datasetIndex === 0) {
                    // SOC Temp Avg
                    rawTemp = socAvgRaw[dataIndex];
                  } else if (context.datasetIndex === 1) {
                    // SOC Temp Min
                    rawTemp = socMinRaw[dataIndex];
                  } else if (context.datasetIndex === 2) {
                    // SOC Temp Max
                    rawTemp = socMaxRaw[dataIndex];
                  }
                  
                  if (rawTemp !== null && !isNaN(rawTemp)) {
                    label += formatTemperature(rawTemp, this.unit);
                  } else {
                    label += 'N/A';
                  }
                }
                return label;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: this.currentPeriod === 'day' ? 'Time' : this.currentPeriod === 'month' ? 'Day' : 'Month',
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: `Temperature (${unitSymbol})`,
            },
          },
        },
      },
    });
  }

  private renderWiFiChart(labels: string[], systemData: any): void {
    const linkQuality = systemData.wlan0_link_quality_avg.map((v: number) => (isNaN(v) ? null : v));
    const signalLevel = systemData.wlan0_signal_level_avg.map((v: number) => (isNaN(v) ? null : v));

    this.wifiContainer.innerHTML = '<canvas id="wifi-chart"></canvas>';
    const canvas = document.getElementById('wifi-chart') as HTMLCanvasElement;

    if (this.wifiChart) {
      this.wifiChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.wifiChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Link Quality',
            data: linkQuality,
            borderColor: 'rgb(40, 167, 69)',
            backgroundColor: 'rgba(40, 167, 69, 0.2)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
          },
          {
            label: 'Signal Level',
            data: signalLevel,
            borderColor: 'rgb(0, 123, 255)',
            backgroundColor: 'rgba(0, 123, 255, 0.2)',
            yAxisID: 'y1',
            tension: 0.1,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'WiFi Signal & Quality',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: true,
            position: 'top',
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: this.currentPeriod === 'day' ? 'Time' : this.currentPeriod === 'month' ? 'Day' : 'Month',
            },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Link Quality',
            },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Signal Level',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    });
  }

  private renderStorageChart(labels: string[], systemData: any): void {
    // Convert bytes to GB
    const storageUsed = systemData.storage_used_avg.map((v: number) => 
      isNaN(v) ? null : v / (1024 * 1024 * 1024)
    );
    const storageAvail = systemData.storage_avail_avg.map((v: number) => 
      isNaN(v) ? null : v / (1024 * 1024 * 1024)
    );

    this.storageContainer.innerHTML = '<canvas id="storage-chart"></canvas>';
    const canvas = document.getElementById('storage-chart') as HTMLCanvasElement;

    if (this.storageChart) {
      this.storageChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.storageChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Storage Used (GB)',
            data: storageUsed,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
          },
          {
            label: 'Storage Available (GB)',
            data: storageAvail,
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            yAxisID: 'y',
            tension: 0.1,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: 'Storage Used & Available',
            font: {
              size: 16,
              weight: 'bold',
            },
          },
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2) + ' GB';
                }
                return label;
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: this.currentPeriod === 'day' ? 'Time' : this.currentPeriod === 'month' ? 'Day' : 'Month',
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Storage (GB)',
            },
          },
        },
      },
    });
  }

  destroy(): void {
    if (this.socTempChart) {
      this.socTempChart.destroy();
      this.socTempChart = null;
    }
    if (this.wifiChart) {
      this.wifiChart.destroy();
      this.wifiChart = null;
    }
    if (this.storageChart) {
      this.storageChart.destroy();
      this.storageChart = null;
    }
  }
}

