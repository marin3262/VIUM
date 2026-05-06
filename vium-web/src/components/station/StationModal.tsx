import React, { useMemo } from 'react';
import { X, MapPin, Zap, Clock, ShieldAlert, Navigation, Star, TrendingUp, MessageSquare, AlertCircle } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useStationStore } from '../../store/stationStore';

interface StationModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onStartCharging: () => void;
  onShowOnMap: () => void; // 신규: 지도에서 확인하기 액션
}

export const StationModal: React.FC<StationModalProps> = ({ station, onClose, onStartCharging, onShowOnMap }) => {
  if (!station) return null;

  const { getAvailableSlots } = useStationStore();
  const availableSlots = getAvailableSlots(station);
  const totalSlots = station.chargers.length;

  // [IoT Demo] 자동 충전 시작 감지 로직
  React.useEffect(() => {
    if (!station) return;
    const isAnyChargerOccupied = station.chargers.some(c => c.status === 'Occupied');
    
    if (isAnyChargerOccupied) {
      console.log('🔌 [IoT] Connector detection! Auto-starting charging flow...');
      const timer = setTimeout(() => {
        onStartCharging();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [station?.chargers, onStartCharging]);

  // 1. 고장난 충전기 식별 로직
  const faultyChargers = useMemo(() => 
    station.chargers.filter(c => c.status === 'Faulty'),
    [station.chargers]
  );

  // 버튼 텍스트 동적 결정 로직
  let buttonText = '충전 시작하기';
  if (availableSlots === 0) {
    if (faultyChargers.length === totalSlots) {
      buttonText = '현재 점검 중입니다';
    } else if (faultyChargers.length > 0) {
      buttonText = '만차 (일부 점검 중)';
    } else {
      buttonText = '충전기 만차';
    }
  }

  // 2. 요금 그래프 데이터 로직
  const displayPriceHistory = useMemo(() => {
    let history = station.priceHistory;
    if (typeof history === 'string') {
      try { history = JSON.parse(history); } catch (e) { history = []; }
    }
    if (!Array.isArray(history) || history.length < 24) {
      const base = station.price || 300;
      return Array.from({ length: 24 }, (_, i) => {
        if (i <= 6) return base - 60; 
        if (i >= 11 && i <= 15) return base + 50;
        return base + (i % 2 === 0 ? 15 : -15);
      });
    }
    return history;
  }, [station.priceHistory, station.price]);

  const minPrice = Math.min(...displayPriceHistory);
  const maxPrice = Math.max(...displayPriceHistory);
  const priceRange = (maxPrice - minPrice) || 100;

  // 3. 리뷰 정렬 (최신순)
  const sortedReviews = useMemo(() => {
    if (!station.reviews) return [];
    return [...station.reviews].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [station.reviews]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="relative min-h-[160px] bg-gradient-to-br from-blue-600 to-indigo-700 p-8 flex flex-col justify-end shrink-0">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"><X size={20} /></button>
          <div className="space-y-2 pr-10">
            <h2 className="text-2xl font-black text-white leading-tight break-keep">{station.station_name}</h2>
            <p className="text-blue-100/80 text-xs flex items-start gap-1.5 leading-relaxed">
              <MapPin size={14} className="shrink-0 mt-0.5" /> 
              <span>{station.address}</span>
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
          {/* 고장 충전기 안내 메시지 섹션 */}
          {faultyChargers.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-[24px] p-5 flex items-start gap-4 animate-pulse">
              <div className="bg-red-100 p-2 rounded-xl text-red-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-red-900">충전기 이용 제한 안내</h4>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  현재 <span className="font-black underline">{faultyChargers.map(c => c.charger_id.split('_').pop() + '호기').join(', ')}</span>가 고장으로 인해 점검 중입니다.
                </p>
              </div>
            </div>
          )}

          {/* Status Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center">
              <Zap className="text-blue-600 mb-1" size={18} />
              <p className="text-[9px] font-bold text-blue-400 uppercase">잔여석</p>
              <p className="text-sm font-black text-blue-700">{availableSlots}/{totalSlots}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 flex flex-col items-center">
              <Star className="text-orange-500 mb-1" size={18} fill="currentColor" />
              <p className="text-[9px] font-bold text-orange-400 uppercase">평점</p>
              <p className="text-sm font-black text-orange-700">4.8</p>
            </div>
            <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex flex-col items-center">
              <Navigation className="text-green-600 mb-1" size={18} />
              <p className="text-[9px] font-bold text-green-400 uppercase">거리</p>
              <p className="text-sm font-black text-green-700">{station.distance || '0.8km'}</p>
            </div>
          </div>

          {/* 스펙 및 성공 정보 */}
          <div className="bg-gray-50 rounded-[32px] p-5 space-y-4 border border-gray-100">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-blue-500"><Zap size={16} /></div>
                <p className="text-sm font-bold text-gray-700">충전기 스펙</p>
              </div>
              <div className="text-right">
                {station.chargers?.map(c => (
                  <p key={c.charger_id} className="text-xs font-black text-gray-900 mb-1">
                    {c.charger_id.split('_').pop()}호기: {c.charger_type} ({c.connector_type})
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* 요금 그래프 */}
          <div className="space-y-4 bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex justify-between items-end">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500" /> 24시간 요금 추이</h3>
              <p className="text-lg font-black text-blue-600">{station.price}원<span className="text-[10px] font-normal text-gray-400 ml-1">/kWh</span></p>
            </div>
            
            <div className="h-28 flex items-end justify-between gap-[2px] px-1 pt-2">
              {displayPriceHistory.map((p, i) => {
                const rawHeight = ((p - minPrice) / priceRange) * 100;
                const heightValue = Math.max(Math.floor(rawHeight), 8); 
                const isCurrentHour = i === new Date().getHours();
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div 
                      style={{ 
                        height: `${heightValue}%`,
                        backgroundColor: isCurrentHour ? '#2563eb' : '#bfdbfe',
                        width: '100%',
                        minWidth: '4px'
                      }} 
                      className={`rounded-t-sm transition-all duration-500 ${isCurrentHour ? 'shadow-[0_-2px_8px_rgba(37,99,235,0.4)]' : 'hover:bg-blue-300'}`}
                    ></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* [신규] 커뮤니티 리뷰 섹션 */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 px-1">
              <MessageSquare size={16} className="text-blue-500" /> 커뮤니티 리뷰 ({sortedReviews.length})
            </h3>
            
            <div className="space-y-3">
              {sortedReviews.length > 0 ? (
                sortedReviews.map((review, idx) => (
                  <div key={idx} className="bg-gray-50 p-5 rounded-[28px] border border-gray-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              size={10} 
                              className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} 
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 tracking-tighter italic">@{review.user_name || '익명회원'}</span>
                      </div>
                      <span className="text-[9px] font-bold text-gray-300">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-700 leading-relaxed break-keep">{review.content}</p>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <p className="text-xs font-bold text-gray-400">아직 작성된 리뷰가 없습니다.</p>
                  <p className="text-[10px] text-gray-300 mt-1">첫 번째 생생한 리뷰를 남겨보세요!</p>
                </div>
              )}
            </div>
          </div>

          {/* Buttons: 3단 레이아웃으로 개선 */}
          <div className="flex gap-2 pt-2">
            <button 
              onClick={() => {
                if ((window as any).openReportModal) {
                  (window as any).openReportModal(station.station_id);
                }
              }} 
              className="flex-1 bg-white border-2 border-red-100 text-red-500 py-4 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1 hover:bg-red-50 transition-all"
            >
              <ShieldAlert size={16} /> 제보
            </button>
            
            <button 
              onClick={onShowOnMap}
              className="flex-1 bg-blue-50 border-2 border-blue-100 text-blue-600 py-4 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1 hover:bg-blue-100 transition-all"
            >
              <MapPin size={16} /> 위치확인
            </button>

            <button onClick={onStartCharging} disabled={availableSlots === 0} className={`flex-[2] py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all ${availableSlots > 0 ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}>
              <Zap size={18} fill="currentColor" /> {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
