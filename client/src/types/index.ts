export interface DataPoint {
  id: number;
  timestamp: number;
  synchronized: number;
}

export interface SensorData {
  id: number;
  sensor_id: number;
  name?: string;
  temperature: number;
  humidity: number;
  data_point_id: number;
}

export interface SystemData {
  id: number;
  soc_temperature: number;
  wlan0_link_quality: number;
  wlan0_signal_level: number;
  storage_total_size: number;
  storage_used: number;
  storage_avail: number;
  data_point_id: number;
}

export interface ImageData {
  id: number;
  filename: string;
  data_point_id: number;
}

export interface DataPointWithData {
  dataPoint: DataPoint;
  sensors: SensorData[];
  systemData: SystemData | null;
  image: ImageData | null;
}

