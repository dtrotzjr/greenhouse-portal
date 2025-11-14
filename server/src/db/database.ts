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
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const startTimestamp = Math.floor(startOfDay.getTime() / 1000);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

    const timestamps = this.db
      .prepare(
        'SELECT timestamp FROM data_points WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp'
      )
      .all(startTimestamp, endTimestamp) as { timestamp: number }[];

    return timestamps.map((row) => row.timestamp);
  }

  close(): void {
    this.db.close();
  }
}

