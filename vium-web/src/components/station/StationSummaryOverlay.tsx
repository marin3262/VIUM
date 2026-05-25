import React from 'react';
import { X, MapPin, Zap, ArrowRight, Star, Navigation } from 'lucide-react';
import type { ChargingStation, StationStatus } from '../../types';
import { useStationStore } from '../../store/stationStore';

interface StationSummaryOverlayProps {
  station: ChargingStation;
  onClose: () => void;
  onViewDetail: () => void;
}

export const StationSummaryOverlay: React.FC<StationSummaryOverlayProps> = ({ 
  station, 
  onClose, 
  onViewDetail 
}) => {
  const { 
    getAvailableSlots, 
    routeSummary, 
    fetchRoute, 
    setUserLocation,
    isLoading: isRouteLoading 
  } = useStationStore();
  const availableSlots = getAvailableSlots(station);
  const totalSlots = station.chargers.length;

  // 바로 길찾기 핸들러
  const handleQuickDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.geolocation) {
      alert("GPS를 지원하지 않는 브라우저입니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const origin = { lat: latitude, lng: longitude };
        setUserLocation(origin);
        await fetchRoute(
          origin, 
          { lat: Number(station.latitude), lng: Number(station.longitude) },
          station.station_name
        );
      },
      () => alert("위치 정보를 가져올 수 없습니다."),
      { enableHighAccuracy: true }
    );
  };

  // 상태별 집계 계산
  const statusCounts = station.chargers.reduce((acc, charger) => {
    const status = charger.status as StationStatus;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<StationStatus, number>);

  // 상태별 스타일 및 한글 라벨 설정
  const statusLabels: Record<StationStatus, { label: string, color: string, bg: string, dot: string }> = {
    'Available': { label: '이용가능', color: 'text-green-700', bg: 'bg-green-50', dot: 'bg-green-500' },
    'Occupied': { label: '사용중', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
    'Charging': { label: '충전중', color: 'text-blue-700', bg: 'bg-blue-50', dot: 'bg-blue-500' },
    'Faulty': { label: '점검중', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' }
  };

  // 대표 상태 색상 결정
  const isAvailable = availableSlots > 0;
  const isAllFaulty = station.chargers.every(c => c.status === 'Faulty');
  const statusColor = isAvailable ? 'bg-blue-600' : (isAllFaulty ? 'bg-red-500' : 'bg-orange-500');

  return (
    <div className={`absolute bottom-4 z-30 transition-all duration-500 ease-in-out animate-in slide-in-from-bottom-3 ${
      routeSummary 
        ? 'left-4 right-auto w-[280px]' 
        : 'left-3 right-3 max-w-lg mx-auto md:max-w-none'
    }`}>
      <div className="bg-white/95 backdrop-blur-md rounded-[24px] shadow-2xl border border-white/50 p-4 flex flex-col gap-3 overflow-hidden relative shadow-blue-900/5">
        {/* 닫기 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors z-20"
        >
          <X size={14} />
        </button>

        <div className="flex items-start gap-3">
          {/* Status Icon Area */}
          <div className={`${statusColor} w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white shrink-0 shadow-md`}>
            <Zap size={14} fill="currentColor" />
            <span className="text-[8px] font-black mt-0.5">{availableSlots}/{totalSlots}</span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1 pr-6"> {/* 닫기 버튼과의 간격 확보 */}
            <div className="flex items-center gap-2">
              <h3 className="font-black text-gray-900 text-sm leading-tight">{station.station_name}</h3>
              {station.reviews && station.reviews.length > 0 && (
                <div className="flex items-center gap-0.5 text-yellow-500 font-bold text-[9px] shrink-0">
                  <Star size={9} fill="currentColor" />
                  {(station.reviews.reduce((acc, r) => acc + r.rating, 0) / station.reviews.length).toFixed(1)}
                </div>
              )}
            </div>
            
            {/* [개선] 주소 텍스트 생략 해제 및 레이아웃 최적화 */}
            <div className="flex items-start gap-1">
              <MapPin size={10} className="text-gray-300 mt-0.5 shrink-0" />
              <p className="text-[10px] text-gray-500 leading-normal font-medium">
                {station.address}
              </p>
            </div>
          </div>
        </div>

        {/* 하단 영역 액션바 */}
        <div className="flex items-end justify-between border-t border-gray-50 pt-2.5">
          <div className="flex flex-wrap gap-1.5 flex-1 pr-4">
            {(Object.keys(statusLabels) as StationStatus[]).map(status => {
              const count = statusCounts[status] || 0;
              if (count === 0) return null;
              const cfg = statusLabels[status];
              return (
                <div key={status} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg ${cfg.bg} ${cfg.color} text-[9px] font-black border border-transparent`}>
                  <span className={`w-1 h-1 rounded-full ${cfg.dot}`}></span>
                  {cfg.label} {count}
                </div>
              );
            })}
          </div>

          {/* 버튼 영역 */}
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={handleQuickDirections}
              disabled={isRouteLoading}
              className={`px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all active:scale-95 ${
                routeSummary 
                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                  : 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              } disabled:opacity-50`}
            >
              {isRouteLoading ? (
                <div className="w-3 h-3 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Navigation size={12} fill={routeSummary ? 'none' : 'currentColor'} /> 
                  {routeSummary ? '재탐색' : '바로 길찾기'}
                </>
              )}
            </button>

            <button 
              onClick={onViewDetail}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-blue-100 whitespace-nowrap"
            >
              상세 정보 <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
