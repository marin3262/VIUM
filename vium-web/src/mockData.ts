import { ChargingStation, UserProfile } from './types';

export const MOCK_STATIONS: ChargingStation[] = [
  {
    id: 'st-001',
    name: '강남역 공용주차장 충전소',
    address: '서울특별시 강남구 역삼동 821-1',
    lat: 37.4979,
    lng: 127.0276,
    type: 'Rapid',
    status: 'Available',
    price: 324,
    isTimeSale: true, 
    priceHistory: [250, 250, 250, 250, 280, 324, 340, 340, 340, 324, 324, 324, 310, 310, 324, 340, 350, 350, 340, 324, 310, 280, 250, 250],
    distance: '0.8km',
    availableSlots: 3,
    totalSlots: 5,
    connectorTypes: ['DC_Combo', 'Chademo'],
    lastSuccessTime: '2시간 전',
    reviews: [
      { id: 'r1', user: '에코러버', rating: 5, content: '충전 속도 정말 빨라요! 주차 공간도 넓습니다.', date: '2시간 전' },
      { id: 'r2', user: '테슬라짱', rating: 4, content: '관리 상태가 아주 좋습니다.', date: '어제' }
    ]
  },
  {
    id: 'st-002',
    name: '코엑스 지하주차장 B2',
    address: '서울특별시 강남구 삼성동 159',
    lat: 37.5113,
    lng: 127.0598,
    type: 'Rapid',
    status: 'Charging',
    price: 345,
    isTimeSale: false,
    priceHistory: [280, 280, 280, 300, 320, 345, 360, 360, 360, 345, 345, 345, 345, 345, 345, 360, 380, 380, 360, 345, 320, 300, 280, 280],
    distance: '1.2km',
    availableSlots: 0,
    totalSlots: 10,
    connectorTypes: ['DC_Combo', 'AC3'],
    lastSuccessTime: '15분 전',
    reviews: [
      { id: 'r3', user: '도심드라이버', rating: 3, content: '항상 차가 많네요. 대기가 좀 길어요.', date: '3시간 전' }
    ]
  },
  {
    id: 'st-003',
    name: '삼성역 현대백화점 충전소',
    address: '서울특별시 강남구 테헤란로 517',
    lat: 37.5085,
    lng: 127.0595,
    type: 'Standard',
    status: 'Available',
    price: 250,
    isTimeSale: true,
    priceHistory: [200, 200, 200, 200, 220, 250, 270, 270, 270, 250, 250, 250, 230, 230, 250, 270, 280, 280, 270, 250, 230, 210, 200, 200],
    distance: '1.5km',
    availableSlots: 2,
    totalSlots: 4,
    connectorTypes: ['Slow'],
    lastSuccessTime: '1시간 전',
    reviews: [
      { id: 'r4', user: '쇼핑왕', rating: 5, content: '백화점 들를 때 최고예요!', date: '2일 전' }
    ]
  },
  {
    id: 'st-004',
    name: '역삼역 테헤란로 충전소',
    address: '서울특별시 강남구 역삼동 737',
    lat: 37.5006,
    lng: 127.0364,
    type: 'Rapid',
    status: 'Faulty',
    price: 310,
    isTimeSale: false,
    priceHistory: [260, 260, 260, 260, 280, 310, 330, 330, 330, 310, 310, 310, 310, 310, 310, 330, 350, 350, 330, 310, 290, 270, 260, 260],
    distance: '2.1km',
    availableSlots: 0,
    totalSlots: 2,
    connectorTypes: ['DC_Combo'],
    lastSuccessTime: '3일 전',
    reviews: [
      { id: 'r5', user: '불편러', rating: 1, content: '기기 고장난 지 며칠 된 것 같은데 수리가 안 되네요.', date: '1주일 전' }
    ]
  }
];

export const MOCK_USER: UserProfile = {
  id: 'user-001',
  name: '최정환',
  points: 15700,
  level: '에코 드라이버',
  recentActivity: [
    { id: 'act-1', type: '충전 적립', date: '2026.03.26', amount: '+450 P' },
    { id: 'act-2', type: '고장 제보 보상', date: '2026.03.24', amount: '+1,000 P' },
    { id: 'act-3', type: '충전소 이탈 보상', date: '2026.03.22', amount: '+200 P' }
  ]
};
