import React from 'react';
import { Zap, Clock, Star } from 'lucide-react';
import { ChargingStation } from '../../types';

interface StationCardProps {
  station: ChargingStation;
  onClick: (station: ChargingStation) => void;
}

export const StationCard: React.FC<StationCardProps> = ({ station, onClick }) => {
  return (
    <div 
      onClick={() => onClick(station)}
      className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.98] relative overflow-hidden"
    >
      {/* 타임 세일 배지 (계획서 제안) */}
      {station.isTimeSale && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl shadow-sm animate-pulse">
          🌙 심야 할인 중
        </div>
      )}

      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            station.status === 'Available' ? 'bg-green-100 text-green-600' :
            station.status === 'Charging' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
          }`}>
            {station.status === 'Available' ? '이용 가능' : station.status === 'Charging' ? '충전 중' : '점검 중'}
          </div>
          
          {/* 최근 생존 시간 배지 (계획서 4P) */}
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-[10px] font-bold text-gray-500">
            <Clock size={10} />
            {station.lastSuccessTime} 충전 성공
          </div>
        </div>
        <span className="text-xs font-bold text-gray-400">{station.distance}</span>
      </div>

      <h4 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors flex items-center gap-2">
        {station.name}
        {station.reviews.length > 0 && (
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
          <span className="text-xs font-bold text-gray-600">빈 충전기 {station.availableSlots}/{station.totalSlots}</span>
        </div>
        <div className="text-right">
          {station.isTimeSale && (
            <p className="text-[9px] text-gray-400 line-through leading-none">324.4원</p>
          )}
          <p className="text-sm font-black text-blue-600">{station.price}원<span className="text-[10px] font-normal text-gray-400 ml-0.5">/kWh</span></p>
        </div>
      </div>
    </div>
  );
};
