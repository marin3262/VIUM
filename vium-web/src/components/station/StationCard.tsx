import React from 'react';
import { Zap, Clock, Star } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useStationStore } from '../../store/stationStore';

interface StationCardProps {
  station: ChargingStation;
  onClick: (station: ChargingStation) => void;
}

export const StationCard: React.FC<StationCardProps> = ({ station, onClick }) => {
  const { getAvailableSlots } = useStationStore();
  
  const availableSlots = getAvailableSlots(station);
  const totalSlots = station.chargers.length;
  
  // 전체 상태 결정 (사용 가능 충전기가 하나라도 있으면 Available)
  const displayStatus = availableSlots > 0 ? 'Available' : (station.chargers.some(c => c.status === 'Charging') ? 'Charging' : 'Faulty');

  return (
    <div 
      onClick={() => onClick(station)}
      className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            displayStatus === 'Available' ? 'bg-green-100 text-green-600' :
            displayStatus === 'Charging' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
          }`}>
            {displayStatus === 'Available' ? '이용 가능' : displayStatus === 'Charging' ? '충전 중' : '점검 중'}
          </div>
          
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-[10px] font-bold text-gray-500">
            <Clock size={10} />
            실시간 정보
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400">{station.distance || '거리 로딩 중'}</span>
      </div>

      <h4 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-2">
        {station.station_name}
        {station.reviews && station.reviews.length > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-yellow-500 font-bold">
            <Star size={10} fill="currentColor" />
            {(station.reviews.reduce((acc, r) => acc + r.rating, 0) / station.reviews.length).toFixed(1)}
          </span>
        )}
      </h4>
      <p className="text-xs text-gray-400 mb-4 line-clamp-1">{station.address}</p>
      
      <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-600">빈 충전기 {availableSlots}/{totalSlots}</span>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-blue-600">정보 확인<span className="text-[10px] font-normal text-gray-400 ml-0.5"> / 클릭</span></p>
        </div>
      </div>
    </div>
  );
};
