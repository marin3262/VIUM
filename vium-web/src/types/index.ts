export interface Review {
  id: string;
  user_name: string; // backend와 일치
  rating: number;
  content: string;
  date: string;
}

export type StationType = 'All' | 'Rapid' | 'Standard';
export type StationStatus = 'Available' | 'Charging' | 'Faulty';
export type ConnectorType = 'DC_Combo' | 'Chademo' | 'AC3' | 'Slow';

export interface ChargingStation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'Rapid' | 'Standard'; 
  status: StationStatus; 
  price: number; 
  isTimeSale: boolean;      // 계획서: 타임 세일 태그 여부
  priceHistory: number[];   // 계획서: 요금 트렌드 그래프 데이터 (24시간)
  distance: string;
  availableSlots: number;
  totalSlots: number;
  connectorTypes: ConnectorType[]; // 계획서: 커넥터 타입 필터링용
  lastSuccessTime: string;  // 계획서: '최근 생존 시간' 표시용 (예: "2시간 전")
  reviews: Review[];
}

export type ReportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ReportIssueType = 'ConnectorBroken' | 'ScreenOff' | 'PaymentError' | 'ParkingBlocked' | 'Other';

export interface Report {
  id: string;
  stationId: string;
  stationName: string;
  userId: string;
  issueType: ReportIssueType;
  content: string;
  photoUrl?: string;
  userLocation: { lat: number; lng: number };
  timestamp: string;
  status: ReportStatus;
}

export interface UserProfile {
  id: string;
  name: string;
  points: number;
  level: string;
  recentActivity: {
    id: string;
    type: string;
    date: string;
    amount: string;
  }[];
}
