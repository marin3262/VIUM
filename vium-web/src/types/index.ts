export type StationStatus = 'Available' | 'Occupied' | 'Charging' | 'Faulty';
export type ChargerType = '급속' | '완속' | '초급속';
export type ConnectorFilterId = 'All' | 'DC Combo' | 'Chademo' | 'AC 5핀' | 'Slow';

export interface Review {
  id: number;
  station_id: string;
  user_id: number;
  user_name: string;
  rating: number;
  content: string;
  status?: 'VISIBLE' | 'HIDDEN';
  created_at: string;
}

export interface Charger {
  charger_id: string;
  station_id: string;
  charger_type: ChargerType;
  connector_type: string;
  status: StationStatus;
}

export interface ChargingStation {
  station_id: string;
  station_name: string;
  address: string;
  latitude: number;
  longitude: number;
  price?: number;
  isTimeSale?: boolean;
  priceHistory?: number[];
  lastSuccessTime?: string;
  chargers: Charger[];
  reviews: Review[];
  distance?: string;
  current_battery?: number;
}

export interface MileageLog {
  log_id: number;
  amount: number;
  description: string;
  created_at: string;
}

export interface UserProfile {
  user_id: number;
  email: string;
  nickname: string;
  mileage_balance: number;
  level: string;
  trust_score?: number;
  is_admin?: boolean;
  mileage_logs: MileageLog[];
}
