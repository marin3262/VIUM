import React from 'react';
import { useStationStore } from '../../store/stationStore';

export const PillFilter: React.FC = () => {
  const { 
    activeFilter, setActiveFilter, 
    selectedConnector, setSelectedConnector,
    onlyAvailable, setOnlyAvailable 
  } = useStationStore();

  const connectors = [
    { id: 'All', label: '모든 커넥터' },
    { id: 'DC Combo', label: 'DC 콤보' },
    { id: 'Chademo', label: '차데모' },
    { id: 'AC 5핀', label: 'AC 5핀 (완속)' },
    { id: 'Slow', label: 'AC 완속' }
  ];

  return (
    <div className="space-y-4">
      {/* 1. 충전 타입 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {['All', '급속', '완속'].map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type as any)}
            className={`px-5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap border ${
              activeFilter === type 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
            }`}
          >
            {type === 'All' ? '전체' : type}
          </button>
        ))}
      </div>

      {/* 2. 커넥터 타입 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {connectors.map((conn) => (
          <button
            key={conn.id}
            onClick={() => setSelectedConnector(conn.id)}
            className={`px-4 py-1.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
              selectedConnector === conn.id 
                ? 'bg-gray-900 text-white border-gray-900' 
                : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'
            }`}
          >
            {conn.label}
          </button>
        ))}
      </div>

      {/* 3. 이용 가능 여부 스위치 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOnlyAvailable(!onlyAvailable)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
            onlyAvailable ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              onlyAvailable ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-xs font-bold text-gray-500">현재 이용 가능한 곳만 보기</span>
      </div>
    </div>
  );
};
