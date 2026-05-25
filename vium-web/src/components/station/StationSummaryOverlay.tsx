import React from 'react';
import { X, Navigation, Zap, Clock, Star, MapPin } from 'lucide-react';
import type { ChargingStation } from '../../types';

interface StationSummaryOverlayProps {
  station: ChargingStation;
  onClose: () => void;
  onViewDetail: () => void;
}

export const StationSummaryOverlay: React.FC<StationSummaryOverlayProps> = ({ station, onClose, onViewDetail }) => {
  const avgRating = station.reviews.length > 0
    ? (station.reviews.reduce((acc, r) => acc + r.rating, 0) / station.reviews.length).toFixed(1)
    : '0.0';

  const availableChargers = station.chargers.filter(c => c.status === 'Available').length;

  const handleRouteSearch = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        window.dispatchEvent(new CustomEvent('vium_search_route', {
          detail: {
            origin: { lat: latitude, lng: longitude },
            destination: { lat: station.latitude, lng: station.longitude, name: station.station_name }
          }
        }));
      },
      () => alert("위치 정보를 가져올 수 없습니다.")
    );
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-20 animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white/95 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col">
        
        {/* 상단 닫기 버튼 */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100/50 hover:bg-gray-100 rounded-full text-gray-500 transition-colors z-10"
        >
          <X size={16} />
        </button>

        <div className="p-6 space-y-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded text-white uppercase tracking-tighter">Fast Charging</span>
                <div className="flex items-center gap-1 text-yellow-500">
                  <Star size={10} className="fill-current" />
                  <span className="text-[10px] font-black">{avgRating}</span>
                </div>
              </div>
              <h3 className="text-lg font-black text-gray-900 truncate tracking-tight">{station.station_name}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-gray-400">
                <MapPin size={10} />
                <p className="text-[10px] font-bold truncate">{station.address}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 px-4 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-100">
              <Zap size={14} className="text-blue-500" />
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase leading-none">Available</p>
                <p className="text-xs font-black text-gray-900 leading-tight">이용가능 {availableChargers}</p>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 px-4 py-2.5 rounded-2xl flex items-center gap-2 border border-gray-100">
              <Clock size={14} className="text-orange-500" />
              <div>
                <p className="text-[8px] font-black text-gray-400 uppercase leading-none">Price</p>
                <p className="text-xs font-black text-gray-900 leading-tight">₩{station.price || 0}/kWh</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleRouteSearch}
              className="flex-1 bg-gray-900 text-white py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Navigation size={14} className="text-blue-400" />
              길찾기
            </button>
            <button 
              onClick={onViewDetail}
              className="flex-1 bg-white border-2 border-gray-100 text-gray-700 py-3.5 rounded-2xl text-xs font-black hover:bg-gray-50 active:scale-95 transition-all"
            >
              상세보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
