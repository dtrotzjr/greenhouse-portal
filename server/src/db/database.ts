import Database from 'better-sqlite3';
import path from 'path';
import {
  DataPoint,
  SensorData,
  SystemData,
  ImageData,
  DataPointWithData,
} from '../types';

export class GreenhouseDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: false });
    this.db.pragma('journal_mode = WAL');
  }

  private padZero(num: number, length: number = 2): string {
    return String(num).padStart(length, '0');
  }

  getLatestDataPoint(): DataPointWithData | null {
    const dataPoint = this.db
      .prepare('SELECT * FROM data_points ORDER BY timestamp DESC LIMIT 1')
      .get() as DataPoint | undefined;

    if (!dataPoint) {
      return null;
    }

    return this.getDataPointWithData(dataPoint.id);
  }

  getDataPointByTimestamp(timestamp: number): DataPointWithData | null {
    // Find the closest data point to the given timestamp
    const dataPoint = this.db
      .prepare(
        'SELECT * FROM data_points ORDER BY ABS(timestamp - ?) LIMIT 1'
      )
      .get(timestamp) as DataPoint | undefined;

    if (!dataPoint) {
      return null;
    }

    return this.getDataPointWithData(dataPoint.id);
  }

  getDataPointWithData(dataPointId: number): DataPointWithData | null {
    const dataPoint = this.db
      .prepare('SELECT * FROM data_points WHERE id = ?')
      .get(dataPointId) as DataPoint | undefined;

    if (!dataPoint) {
      return null;
    }

    const sensors = this.db
      .prepare('SELECT * FROM sensor_data WHERE data_point_id = ? ORDER BY sensor_id')
      .all(dataPointId) as SensorData[];

    const systemData = this.db
      .prepare('SELECT * FROM system_data WHERE data_point_id = ?')
      .get(dataPointId) as SystemData | undefined;

    // Find image with closest data_point_id (may not exist for all data points)
    const image = this.db
      .prepare(
        `SELECT * FROM image_data 
         WHERE data_point_id <= ? 
         ORDER BY data_point_id DESC 
         LIMIT 1`
      )
      .get(dataPointId) as ImageData | undefined;

    return {
      dataPoint,
      sensors,
      systemData: systemData || null,
      image: image || null,
    };
  }

  getDataPointsForDate(date: Date): number[] {
    // The date parameter represents a calendar date in the server's local timezone
    // We need to find the start and end of that day in local time, then convert to UTC timestamps
    // Extract local date components to ensure we're working with the correct calendar date
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create start of day at midnight in local timezone
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);

    // Create end of day at 23:59:59.999 in local timezone
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

    const timestamps = this.db
      .prepare(
        'SELECT timestamp FROM data_points WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp'
      )
      .all(startTimestamp, endTimestamp) as { timestamp: number }[];

    return timestamps.map((row) => row.timestamp);
  }

  // Chart data aggregation methods
  getChartDataForDay(date: Date): {
    timestamps: number[];
    sensorData: {
      sensor_id: number;
      temperature_avg: number[];
      temperature_min: number[];
      temperature_max: number[];
      humidity_avg: number[];
      humidity_min: number[];
      humidity_max: number[];
    }[];
    systemData: {
      soc_temperature_avg: number[];
      soc_temperature_min: number[];
      soc_temperature_max: number[];
      wlan0_link_quality_avg: number[];
      wlan0_signal_level_avg: number[];
      storage_used_avg: number[];
      storage_avail_avg: number[];
    } | null;
  } {
    // The date parameter represents a calendar date in the server's local timezone
    // Extract local date components to ensure we're working with the correct calendar date
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create start of day at midnight in local timezone
    const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);

    // Create end of day at 23:59:59.999 in local timezone
    const endOfDay = new Date(year, month, day, 23, 59, 59, 999);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

    // Get all data points for the day
    const dataPoints = this.db
      .prepare(
        'SELECT id, timestamp FROM data_points WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp'
      )
      .all(startTimestamp, endTimestamp) as { id: number; timestamp: number }[];

    // Generate hour timestamps for the day view (one per hour)
    const hourTimestamps: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourDate = new Date(year, month, day, hour, 0, 0, 0);
      hourTimestamps.push(Math.floor(hourDate.getTime() / 1000));
    }
    const timestamps = hourTimestamps;
    
    // Group data points by hour for aggregation
    const hourlyGroups: Map<number, number[]> = new Map();
    dataPoints.forEach((dp) => {
      const date = new Date(dp.timestamp * 1000);
      const hour = date.getHours();
      if (!hourlyGroups.has(hour)) {
        hourlyGroups.set(hour, []);
      }
      hourlyGroups.get(hour)!.push(dp.id);
    });

    // Aggregate sensor data by hour (for day view, group by hour)
    const sensorIds = this.db
      .prepare('SELECT DISTINCT sensor_id FROM sensor_data ORDER BY sensor_id')
      .all() as { sensor_id: number }[];

    const sensorData = sensorIds.map((s) => {
      const tempAvg: number[] = [];
      const tempMin: number[] = [];
      const tempMax: number[] = [];
      const humAvg: number[] = [];
      const humMin: number[] = [];
      const humMax: number[] = [];

      // For each hour, aggregate the sensor data
      for (let hour = 0; hour < 24; hour++) {
        const hourDataPointIds = hourlyGroups.get(hour) || [];

        if (hourDataPointIds.length > 0) {
          const temps: number[] = [];
          const hums: number[] = [];

          hourDataPointIds.forEach((dpId) => {
            const sensor = this.db
              .prepare('SELECT temperature, humidity FROM sensor_data WHERE data_point_id = ? AND sensor_id = ?')
              .get(dpId, s.sensor_id) as { temperature: number; humidity: number } | undefined;

            if (sensor) {
              temps.push(sensor.temperature);
              hums.push(sensor.humidity);
            }
          });

          if (temps.length > 0) {
            tempAvg.push(temps.reduce((a, b) => a + b, 0) / temps.length);
            tempMin.push(Math.min(...temps));
            tempMax.push(Math.max(...temps));
            humAvg.push(hums.reduce((a, b) => a + b, 0) / hums.length);
            humMin.push(Math.min(...hums));
            humMax.push(Math.max(...hums));
          } else {
            tempAvg.push(NaN);
            tempMin.push(NaN);
            tempMax.push(NaN);
            humAvg.push(NaN);
            humMin.push(NaN);
            humMax.push(NaN);
          }
        } else {
          tempAvg.push(NaN);
          tempMin.push(NaN);
          tempMax.push(NaN);
          humAvg.push(NaN);
          humMin.push(NaN);
          humMax.push(NaN);
        }
      }

      return {
        sensor_id: s.sensor_id,
        temperature_avg: tempAvg,
        temperature_min: tempMin,
        temperature_max: tempMax,
        humidity_avg: humAvg,
        humidity_min: humMin,
        humidity_max: humMax,
      };
    });

    // Aggregate system data by hour
    const socTempAvg: number[] = [];
    const socTempMin: number[] = [];
    const socTempMax: number[] = [];
    const wlan0LinkQualityAvg: number[] = [];
    const wlan0SignalLevelAvg: number[] = [];
    const storageUsedAvg: number[] = [];
    const storageAvailAvg: number[] = [];

    // For each hour, aggregate the system data
    for (let hour = 0; hour < 24; hour++) {
      const hourDataPointIds = hourlyGroups.get(hour) || [];

      if (hourDataPointIds.length > 0) {
        const socTemps: number[] = [];
        const linkQualities: number[] = [];
        const signalLevels: number[] = [];
        const storageUseds: number[] = [];
        const storageAvails: number[] = [];

        hourDataPointIds.forEach((dpId) => {
          const system = this.db
            .prepare('SELECT * FROM system_data WHERE data_point_id = ?')
            .get(dpId) as SystemData | undefined;

          if (system) {
            socTemps.push(system.soc_temperature);
            linkQualities.push(system.wlan0_link_quality);
            signalLevels.push(system.wlan0_signal_level);
            storageUseds.push(system.storage_used);
            storageAvails.push(system.storage_avail);
          }
        });

        if (socTemps.length > 0) {
          socTempAvg.push(socTemps.reduce((a, b) => a + b, 0) / socTemps.length);
          socTempMin.push(Math.min(...socTemps));
          socTempMax.push(Math.max(...socTemps));
          wlan0LinkQualityAvg.push(linkQualities.reduce((a, b) => a + b, 0) / linkQualities.length);
          wlan0SignalLevelAvg.push(signalLevels.reduce((a, b) => a + b, 0) / signalLevels.length);
          storageUsedAvg.push(storageUseds.reduce((a, b) => a + b, 0) / storageUseds.length);
          storageAvailAvg.push(storageAvails.reduce((a, b) => a + b, 0) / storageAvails.length);
        } else {
          socTempAvg.push(NaN);
          socTempMin.push(NaN);
          socTempMax.push(NaN);
          wlan0LinkQualityAvg.push(NaN);
          wlan0SignalLevelAvg.push(NaN);
          storageUsedAvg.push(NaN);
          storageAvailAvg.push(NaN);
        }
      } else {
        socTempAvg.push(NaN);
        socTempMin.push(NaN);
        socTempMax.push(NaN);
        wlan0LinkQualityAvg.push(NaN);
        wlan0SignalLevelAvg.push(NaN);
        storageUsedAvg.push(NaN);
        storageAvailAvg.push(NaN);
      }
    }

    const systemData =
      timestamps.length > 0
        ? {
            soc_temperature_avg: socTempAvg,
            soc_temperature_min: socTempMin,
            soc_temperature_max: socTempMax,
            wlan0_link_quality_avg: wlan0LinkQualityAvg,
            wlan0_signal_level_avg: wlan0SignalLevelAvg,
            storage_used_avg: storageUsedAvg,
            storage_avail_avg: storageAvailAvg,
          }
        : null;

    return {
      timestamps,
      sensorData,
      systemData,
    };
  }

  getChartDataForMonth(year: number, month: number): {
    dates: string[];
    sensorData: {
      sensor_id: number;
      temperature_avg: number[];
      temperature_min: number[];
      temperature_max: number[];
      humidity_avg: number[];
      humidity_min: number[];
      humidity_max: number[];
    }[];
    systemData: {
      soc_temperature_avg: number[];
      soc_temperature_min: number[];
      soc_temperature_max: number[];
      wlan0_link_quality_avg: number[];
      wlan0_signal_level_avg: number[];
      storage_used_avg: number[];
      storage_avail_avg: number[];
    } | null;
  } {
    // Get first and last day of month in UTC
    // month is 1-indexed (1-12), but Date.UTC expects 0-indexed (0-11)
    // To get the last day of the month, we need month + 1 in 0-indexed terms
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    // Get all days in the month
    // Calculate days in month using UTC to ensure consistency
    const dates: string[] = [];
    const daysInMonth = endDate.getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(`${year}-${this.padZero(month)}-${this.padZero(day)}`);
    }

    // Get sensor IDs
    const sensorIds = this.db
      .prepare('SELECT DISTINCT sensor_id FROM sensor_data ORDER BY sensor_id')
      .all() as { sensor_id: number }[];

    const sensorData = sensorIds.map((s) => {
      const tempAvg: number[] = [];
      const tempMin: number[] = [];
      const tempMax: number[] = [];
      const humAvg: number[] = [];
      const humMin: number[] = [];
      const humMax: number[] = [];

      dates.forEach((dateStr) => {
        // Parse as local date (no Z = local time)
        // The dateStr is in YYYY-MM-DD format representing a calendar date
        const dayDate = new Date(dateStr + 'T00:00:00');
        // Extract local date components
        const year = dayDate.getFullYear();
        const month = dayDate.getMonth();
        const day = dayDate.getDate();
        // Create start and end of day in local timezone
        const dayStart = new Date(year, month, day, 0, 0, 0, 0);
        const dayEnd = new Date(year, month, day, 23, 59, 59, 999);
        const dayStartTs = Math.floor(dayStart.getTime() / 1000);
        const dayEndTs = Math.floor(dayEnd.getTime() / 1000);

        const dayDataPoints = this.db
          .prepare('SELECT id FROM data_points WHERE timestamp >= ? AND timestamp <= ?')
          .all(dayStartTs, dayEndTs) as { id: number }[];

        if (dayDataPoints.length > 0) {
          const temps: number[] = [];
          const hums: number[] = [];

          dayDataPoints.forEach((dp) => {
            const sensor = this.db
              .prepare('SELECT temperature, humidity FROM sensor_data WHERE data_point_id = ? AND sensor_id = ?')
              .get(dp.id, s.sensor_id) as { temperature: number; humidity: number } | undefined;

            if (sensor) {
              temps.push(sensor.temperature);
              hums.push(sensor.humidity);
            }
          });

          if (temps.length > 0) {
            tempAvg.push(temps.reduce((a, b) => a + b, 0) / temps.length);
            tempMin.push(Math.min(...temps));
            tempMax.push(Math.max(...temps));
            humAvg.push(hums.reduce((a, b) => a + b, 0) / hums.length);
            humMin.push(Math.min(...hums));
            humMax.push(Math.max(...hums));
          } else {
            tempAvg.push(NaN);
            tempMin.push(NaN);
            tempMax.push(NaN);
            humAvg.push(NaN);
            humMin.push(NaN);
            humMax.push(NaN);
          }
        } else {
          tempAvg.push(NaN);
          tempMin.push(NaN);
          tempMax.push(NaN);
          humAvg.push(NaN);
          humMin.push(NaN);
          humMax.push(NaN);
        }
      });

      return {
        sensor_id: s.sensor_id,
        temperature_avg: tempAvg,
        temperature_min: tempMin,
        temperature_max: tempMax,
        humidity_avg: humAvg,
        humidity_min: humMin,
        humidity_max: humMax,
      };
    });

    // Aggregate system data by day
    const socTempAvg: number[] = [];
    const socTempMin: number[] = [];
    const socTempMax: number[] = [];
    const wlan0LinkQualityAvg: number[] = [];
    const wlan0SignalLevelAvg: number[] = [];
    const storageUsedAvg: number[] = [];
    const storageAvailAvg: number[] = [];

    dates.forEach((dateStr) => {
      // Parse as local date (no Z = local time)
      // The dateStr is in YYYY-MM-DD format representing a calendar date
      const dayDate = new Date(dateStr + 'T00:00:00');
      // Extract local date components
      const year = dayDate.getFullYear();
      const month = dayDate.getMonth();
      const day = dayDate.getDate();
      // Create start and end of day in local timezone
      const dayStart = new Date(year, month, day, 0, 0, 0, 0);
      const dayEnd = new Date(year, month, day, 23, 59, 59, 999);
      const dayStartTs = Math.floor(dayStart.getTime() / 1000);
      const dayEndTs = Math.floor(dayEnd.getTime() / 1000);

      const dayDataPoints = this.db
        .prepare('SELECT id FROM data_points WHERE timestamp >= ? AND timestamp <= ?')
        .all(dayStartTs, dayEndTs) as { id: number }[];

      if (dayDataPoints.length > 0) {
        const socTemps: number[] = [];
        const linkQualities: number[] = [];
        const signalLevels: number[] = [];
        const storageUseds: number[] = [];
        const storageAvails: number[] = [];

        dayDataPoints.forEach((dp) => {
          const system = this.db
            .prepare('SELECT * FROM system_data WHERE data_point_id = ?')
            .get(dp.id) as SystemData | undefined;

          if (system) {
            socTemps.push(system.soc_temperature);
            linkQualities.push(system.wlan0_link_quality);
            signalLevels.push(system.wlan0_signal_level);
            storageUseds.push(system.storage_used);
            storageAvails.push(system.storage_avail);
          }
        });

        if (socTemps.length > 0) {
          socTempAvg.push(socTemps.reduce((a, b) => a + b, 0) / socTemps.length);
          socTempMin.push(Math.min(...socTemps));
          socTempMax.push(Math.max(...socTemps));
          wlan0LinkQualityAvg.push(linkQualities.reduce((a, b) => a + b, 0) / linkQualities.length);
          wlan0SignalLevelAvg.push(signalLevels.reduce((a, b) => a + b, 0) / signalLevels.length);
          storageUsedAvg.push(storageUseds.reduce((a, b) => a + b, 0) / storageUseds.length);
          storageAvailAvg.push(storageAvails.reduce((a, b) => a + b, 0) / storageAvails.length);
        } else {
          socTempAvg.push(NaN);
          socTempMin.push(NaN);
          socTempMax.push(NaN);
          wlan0LinkQualityAvg.push(NaN);
          wlan0SignalLevelAvg.push(NaN);
          storageUsedAvg.push(NaN);
          storageAvailAvg.push(NaN);
        }
      } else {
        socTempAvg.push(NaN);
        socTempMin.push(NaN);
        socTempMax.push(NaN);
        wlan0LinkQualityAvg.push(NaN);
        wlan0SignalLevelAvg.push(NaN);
        storageUsedAvg.push(NaN);
        storageAvailAvg.push(NaN);
      }
    });

    const systemData =
      dates.length > 0
        ? {
            soc_temperature_avg: socTempAvg,
            soc_temperature_min: socTempMin,
            soc_temperature_max: socTempMax,
            wlan0_link_quality_avg: wlan0LinkQualityAvg,
            wlan0_signal_level_avg: wlan0SignalLevelAvg,
            storage_used_avg: storageUsedAvg,
            storage_avail_avg: storageAvailAvg,
          }
        : null;

    return {
      dates,
      sensorData,
      systemData,
    };
  }

  getChartDataForYear(year: number): {
    months: string[];
    sensorData: {
      sensor_id: number;
      temperature_avg: number[];
      temperature_min: number[];
      temperature_max: number[];
      humidity_avg: number[];
      humidity_min: number[];
      humidity_max: number[];
    }[];
    systemData: {
      soc_temperature_avg: number[];
      soc_temperature_min: number[];
      soc_temperature_max: number[];
      wlan0_link_quality_avg: number[];
      wlan0_signal_level_avg: number[];
      storage_used_avg: number[];
      storage_avail_avg: number[];
    } | null;
  } {
    const months: string[] = [];
    for (let month = 1; month <= 12; month++) {
      months.push(`${year}-${this.padZero(month)}`);
    }

    // Get sensor IDs
    const sensorIds = this.db
      .prepare('SELECT DISTINCT sensor_id FROM sensor_data ORDER BY sensor_id')
      .all() as { sensor_id: number }[];

    const sensorData = sensorIds.map((s) => {
      const tempAvg: number[] = [];
      const tempMin: number[] = [];
      const tempMax: number[] = [];
      const humAvg: number[] = [];
      const humMin: number[] = [];
      const humMax: number[] = [];

      months.forEach((monthStr) => {
        const [yearStr, monthStr2] = monthStr.split('-');
        const monthNum = parseInt(monthStr2, 10);
        const yearNum = parseInt(yearStr, 10);

        // Use UTC to avoid timezone issues
        const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));
        const startTimestamp = Math.floor(startDate.getTime() / 1000);
        const endTimestamp = Math.floor(endDate.getTime() / 1000);

        const monthDataPoints = this.db
          .prepare('SELECT id FROM data_points WHERE timestamp >= ? AND timestamp <= ?')
          .all(startTimestamp, endTimestamp) as { id: number }[];

        if (monthDataPoints.length > 0) {
          const temps: number[] = [];
          const hums: number[] = [];

          monthDataPoints.forEach((dp) => {
            const sensor = this.db
              .prepare('SELECT temperature, humidity FROM sensor_data WHERE data_point_id = ? AND sensor_id = ?')
              .get(dp.id, s.sensor_id) as { temperature: number; humidity: number } | undefined;

            if (sensor) {
              temps.push(sensor.temperature);
              hums.push(sensor.humidity);
            }
          });

          if (temps.length > 0) {
            tempAvg.push(temps.reduce((a, b) => a + b, 0) / temps.length);
            tempMin.push(Math.min(...temps));
            tempMax.push(Math.max(...temps));
            humAvg.push(hums.reduce((a, b) => a + b, 0) / hums.length);
            humMin.push(Math.min(...hums));
            humMax.push(Math.max(...hums));
          } else {
            tempAvg.push(NaN);
            tempMin.push(NaN);
            tempMax.push(NaN);
            humAvg.push(NaN);
            humMin.push(NaN);
            humMax.push(NaN);
          }
        } else {
          tempAvg.push(NaN);
          tempMin.push(NaN);
          tempMax.push(NaN);
          humAvg.push(NaN);
          humMin.push(NaN);
          humMax.push(NaN);
        }
      });

      return {
        sensor_id: s.sensor_id,
        temperature_avg: tempAvg,
        temperature_min: tempMin,
        temperature_max: tempMax,
        humidity_avg: humAvg,
        humidity_min: humMin,
        humidity_max: humMax,
      };
    });

    // Aggregate system data by month
    const socTempAvg: number[] = [];
    const socTempMin: number[] = [];
    const socTempMax: number[] = [];
    const wlan0LinkQualityAvg: number[] = [];
    const wlan0SignalLevelAvg: number[] = [];
    const storageUsedAvg: number[] = [];
    const storageAvailAvg: number[] = [];

    months.forEach((monthStr) => {
      const [yearStr, monthStr2] = monthStr.split('-');
      const monthNum = parseInt(monthStr2, 10);
      const yearNum = parseInt(yearStr, 10);

      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);

      const monthDataPoints = this.db
        .prepare('SELECT id FROM data_points WHERE timestamp >= ? AND timestamp <= ?')
        .all(startTimestamp, endTimestamp) as { id: number }[];

      if (monthDataPoints.length > 0) {
        const socTemps: number[] = [];
        const linkQualities: number[] = [];
        const signalLevels: number[] = [];
        const storageUseds: number[] = [];
        const storageAvails: number[] = [];

        monthDataPoints.forEach((dp) => {
          const system = this.db
            .prepare('SELECT * FROM system_data WHERE data_point_id = ?')
            .get(dp.id) as SystemData | undefined;

          if (system) {
            socTemps.push(system.soc_temperature);
            linkQualities.push(system.wlan0_link_quality);
            signalLevels.push(system.wlan0_signal_level);
            storageUseds.push(system.storage_used);
            storageAvails.push(system.storage_avail);
          }
        });

        if (socTemps.length > 0) {
          socTempAvg.push(socTemps.reduce((a, b) => a + b, 0) / socTemps.length);
          socTempMin.push(Math.min(...socTemps));
          socTempMax.push(Math.max(...socTemps));
          wlan0LinkQualityAvg.push(linkQualities.reduce((a, b) => a + b, 0) / linkQualities.length);
          wlan0SignalLevelAvg.push(signalLevels.reduce((a, b) => a + b, 0) / signalLevels.length);
          storageUsedAvg.push(storageUseds.reduce((a, b) => a + b, 0) / storageUseds.length);
          storageAvailAvg.push(storageAvails.reduce((a, b) => a + b, 0) / storageAvails.length);
        } else {
          socTempAvg.push(NaN);
          socTempMin.push(NaN);
          socTempMax.push(NaN);
          wlan0LinkQualityAvg.push(NaN);
          wlan0SignalLevelAvg.push(NaN);
          storageUsedAvg.push(NaN);
          storageAvailAvg.push(NaN);
        }
      } else {
        socTempAvg.push(NaN);
        socTempMin.push(NaN);
        socTempMax.push(NaN);
        wlan0LinkQualityAvg.push(NaN);
        wlan0SignalLevelAvg.push(NaN);
        storageUsedAvg.push(NaN);
        storageAvailAvg.push(NaN);
      }
    });

    const systemData =
      months.length > 0
        ? {
            soc_temperature_avg: socTempAvg,
            soc_temperature_min: socTempMin,
            soc_temperature_max: socTempMax,
            wlan0_link_quality_avg: wlan0LinkQualityAvg,
            wlan0_signal_level_avg: wlan0SignalLevelAvg,
            storage_used_avg: storageUsedAvg,
            storage_avail_avg: storageAvailAvg,
          }
        : null;

    return {
      months,
      sensorData,
      systemData,
    };
  }

  close(): void {
    this.db.close();
  }
}

