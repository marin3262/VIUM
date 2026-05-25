import React, { useMemo } from 'react';
import { 
  X, MapPin, Navigation, AlertTriangle, 
  ChevronRight, Star, Clock, Zap
} from 'lucide-react';
import type { ChargingStation } from '../../types';

interface StationModalProps {
  station: ChargingStation;
  onClose: () => void;
  onShowOnMap: () => void;
}

export const StationModal: React.FC<StationModalProps> = ({ station, onClose, onShowOnMap }) => {
  const avgRating = useMemo(() => {
    if (!station.reviews.length) return 0;
    const sum = station.reviews.reduce((acc, rev) => acc + rev.rating, 0);
    return (sum / station.reviews.length).toFixed(1);
  }, [station.reviews]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-500">
        
        {/* Header Image Area */}
        <div className="relative h-48 md:h-64 shrink-0">
          <img 
            src={`https://images.unsplash.com/photo-1676288176918-090947702877?auto=format&fit=crop&q=80&w=800`}
            alt={station.station_name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all"
          >
            <X size={20} />
          </button>
          
          <div className="absolute bottom-6 left-8 right-8 text-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Active Station</span>
              {station.price && <span className="bg-white/20 backdrop-blur text-[10px] font-black px-2 py-0.5 rounded">₩{station.price}/kWh</span>}
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">{station.station_name}</h2>
            <div className="flex items-center gap-2 mt-1 opacity-80 text-sm">
              <MapPin size={14} className="text-red-400" />
              <p className="truncate font-medium">{station.address}</p>
            </div>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-8">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Rating</p>
              <div className="flex items-center justify-center gap-1">
                <Star size={14} className="text-yellow-400 fill-current" />
                <span className="text-lg font-black text-gray-900">{avgRating}</span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Available</p>
              <div className="flex items-center justify-center gap-1">
                <Zap size={14} className="text-blue-500" />
                <span className="text-lg font-black text-gray-900">
                  {station.chargers.filter(c => c.status === 'Available').length}/{station.chargers.length}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-3xl text-center border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Status</p>
              <div className="flex items-center justify-center gap-1">
                <Clock size={14} className="text-green-500" />
                <span className="text-sm font-black text-gray-900">운영중</span>
              </div>
            </div>
          </div>

          {/* Charger List */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Zap size={20} className="text-blue-600" /> 실시간 충전기 현황
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {station.chargers.map((charger) => (
                <div key={charger.charger_id} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${charger.status === 'Available' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      <Zap size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-gray-800 tracking-tight">{charger.charger_id}호기 — {charger.charger_type}</p>
                      <p className="text-[10px] text-gray-400 font-bold">{charger.connector_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      charger.status === 'Available' ? 'bg-green-100 text-green-700' :
                      charger.status === 'Charging' ? 'bg-blue-100 text-blue-700' :
                      charger.status === 'Occupied' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {charger.status}
                    </span>
                    <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews Preview */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Star size={20} className="text-yellow-400" /> 유저 생생 리뷰
              </h3>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{station.reviews.length} Reviews</span>
            </div>
            <div className="space-y-3 pb-4">
              {station.reviews.length > 0 ? station.reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="bg-gray-50/50 p-5 rounded-3xl border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-gray-900">@{review.user_name}</span>
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-[10px] ${i < review.rating ? 'fill-current' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-300 font-bold">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed">{review.content}</p>
                </div>
              )) : (
                <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                  <p className="text-xs text-gray-400 font-medium italic">아직 작성된 리뷰가 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-100 flex gap-4 shrink-0">
          <button 
            onClick={onShowOnMap}
            className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-gray-100 transition-all active:scale-95"
          >
            <Navigation size={18} className="text-blue-600" /> 위치 확인
          </button>
          <button 
            onClick={() => {
              (window as any).openReportModal(station.station_id);
            }}
            className="flex-1 py-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-red-100 transition-all active:scale-95"
          >
            <AlertTriangle size={18} /> 고장 제보
          </button>
        </div>
      </div>
    </div>
  );
};
