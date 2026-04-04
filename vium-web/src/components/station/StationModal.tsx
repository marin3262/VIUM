import React from 'react';
import { X, MapPin, MessageSquare, Star, Clock, Zap, ArrowDown, AlertTriangle } from 'lucide-react';
import { ChargingStation } from '../../types';

interface StationModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onStartCharging: () => void;
}

export const StationModal: React.FC<StationModalProps> = ({ station, onClose, onStartCharging }) => {
  if (!station) return null;

  // 데이터 부재 시를 대비한 기본값 처리
  const priceHistory = station.priceHistory || Array(24).fill(station.price || 0);
  const maxPrice = Math.max(...priceHistory);
  const minPrice = Math.min(...priceHistory);
  const range = maxPrice - minPrice || 1;
  
  const points = priceHistory.map((p, i) => {
    const x = (i / 23) * 100;
    const y = 100 - ((p - minPrice) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  // --- 버튼 상태 제어 로직 ---
  const isAvailable = station.status === 'Available';
  const isFaulty = station.status === 'Faulty';
  const isFull = station.availableSlots === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-xl rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>
        <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto no-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 leading-tight mb-2">{station.name}</h2>
              <p className="text-gray-400 text-sm flex items-center gap-1"><MapPin size={14} /> {station.address}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-500" /></button>
          </div>

          <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm flex items-center gap-2 text-gray-700"><ArrowDown size={16} className="text-blue-500" /> 오늘의 요금 트렌드</h3>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">현재 {station.price}원</span>
            </div>
            <div className="h-24 w-full relative">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <line x1="0" y1="50" x2="100" y2="50" stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="2,2" />
                <defs><linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style={{ stopColor: '#3B82F6', stopOpacity: 0.2 }} /><stop offset="100%" style={{ stopColor: '#3B82F6', stopOpacity: 0 }} /></linearGradient></defs>
                <path d={`M 0,100 L ${points} L 100,100 Z`} fill="url(#grad)" />
                <polyline fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className={`p-4 rounded-3xl text-center ${isFaulty ? 'bg-red-50' : 'bg-blue-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isFaulty ? 'text-red-400' : 'text-blue-400'}`}>상태</p>
              <p className={`text-sm font-black ${isFaulty ? 'text-red-700' : 'text-blue-700'}`}>{isFaulty ? '점검중' : '정상'}</p>
            </div>
            <div className={`p-4 rounded-3xl text-center ${isFull && isAvailable ? 'bg-orange-50' : 'bg-green-50'}`}>
              <p className={`text-[10px] font-bold uppercase mb-1 ${isFull && isAvailable ? 'text-orange-400' : 'text-green-400'}`}>잔여석</p>
              <p className={`text-sm font-black ${isFull && isAvailable ? 'text-orange-700' : 'text-green-700'}`}>{station.availableSlots} / {station.totalSlots}</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-bold text-yellow-400 uppercase mb-1">단가</p><p className="text-sm font-black text-yellow-700">{station.price}원</p></div>
          </div>

          {!isAvailable && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-pulse">
              <AlertTriangle size={20} />
              <p className="text-xs font-bold">
                {isFaulty ? '현재 고장/점검 중인 충전소입니다. 이용이 불가능합니다.' : '현재 모든 충전기가 사용 중입니다.'}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare size={18} className="text-blue-500" />사용자 리뷰</h3>
              <div className="flex gap-4">
                <button onClick={() => (window as any).openReportModal?.(station)} className="text-xs text-red-500 font-bold bg-red-50 px-3 py-1 rounded-full">고장 제보</button>
                <span className="text-sm text-blue-600 font-bold">리뷰 보기</span>
              </div>
            </div>
            <div className="space-y-3">
              {station.reviews?.length > 0 ? (
                station.reviews.map(review => (
                  <div key={review.id} className="bg-gray-50 p-4 rounded-2xl">
                    <div className="flex justify-between mb-2"><span className="text-sm font-bold text-gray-700">{review.user_name || review.user}</span><div className="flex items-center gap-1 text-yellow-400"><Star size={12} fill="currentColor" /><span className="text-xs font-bold">{review.rating}</span></div></div>
                    <p className="text-sm text-gray-600 mb-2">{review.content}</p>
                    <div className="flex items-center gap-1 text-gray-400"><Clock size={12} /><span className="text-[10px]">{new Date(review.date).toLocaleDateString() === 'Invalid Date' ? review.date : new Date(review.date).toLocaleDateString()}</span></div>
                  </div>
                ))
              ) : (
                <p className="text-center py-8 text-gray-400 text-sm italic">아직 작성된 리뷰가 없습니다.</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <button 
              disabled={!isAvailable || isFull}
              onClick={onStartCharging} 
              className={`w-full py-5 rounded-3xl text-lg font-black shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 ${
                (!isAvailable || isFull) ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white shadow-blue-100 hover:bg-blue-700'
              }`}
            >
              {isFaulty ? '충전 불가 (점검 중)' : isFull ? '빈 자리가 없습니다' : (
                <><Zap size={24} fill="currentColor" /> 충전 시작하기</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
