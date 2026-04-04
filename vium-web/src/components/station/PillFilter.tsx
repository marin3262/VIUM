import React from 'react';
import { Filter, Zap, CheckCircle2 } from 'lucide-react';
import { useStationStore } from '../../store/stationStore';
import { ConnectorType, StationType } from '../../types';

export const PillFilter: React.FC = () => {
  const { 
    activeFilter, setActiveFilter, 
    selectedConnector, setSelectedConnector,
    onlyAvailable, setOnlyAvailable 
  } = useStationStore();

  const connectorOptions: { label: string; value: ConnectorType | 'All' }[] = [
    { label: '전체 커넥터', value: 'All' },
    { label: 'DC 콤보', value: 'DC_Combo' },
    { label: '차데모', value: 'Chademo' },
    { label: 'AC3 상', value: 'AC3' },
    { label: 'AC 5핀', value: 'Slow' },
  ];

  const typeOptions: { label: string; value: StationType }[] = [
    { label: '전체', value: 'All' },
    { label: '급속', value: 'Rapid' },
    { label: '완속', value: 'Standard' },
  ];

  return (
    <div className="space-y-4 px-1">
      {/* 1층: 충전 속도 및 필터 아이콘 */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <div className="bg-blue-600 p-2 rounded-xl text-white shrink-0">
          <Filter size={18} />
        </div>
        
        {typeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeFilter === opt.value 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'bg-white text-gray-400 border border-gray-100 hover:border-blue-200'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <div className="h-6 w-[1px] bg-gray-200 mx-2 shrink-0"></div>

        <button
          onClick={() => setOnlyAvailable(!onlyAvailable)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            onlyAvailable 
              ? 'bg-green-600 text-white shadow-lg shadow-green-100' 
              : 'bg-white text-gray-400 border border-gray-100 hover:border-green-200'
          }`}
        >
          <CheckCircle2 size={14} />
          충전 가능만
        </button>
      </div>

      {/* 2층: 커넥터 상세 필터 (계획서 제안) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {connectorOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedConnector(opt.value)}
            className={`px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              selectedConnector === opt.value 
                ? 'bg-gray-800 text-white shadow-md' 
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
