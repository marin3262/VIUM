import { create } from 'zustand';
import type { ChargingStation, ChargerType, Review } from '../types';
import { stationService } from '../services/stationService';

interface StationState {
  stations: ChargingStation[];
  activeFilter: ChargerType | 'All';
  selectedConnector: string | 'All'; // 누락되었던 필드 추가
  onlyAvailable: boolean;
  isLoading: boolean;
  
  // Actions
  fetchStations: () => Promise<void>;
  setActiveFilter: (filter: ChargerType | 'All') => void;
  setSelectedConnector: (connector: string | 'All') => void; // 누락되었던 액션 추가
  setOnlyAvailable: (available: boolean) => void;
  
  // Computed (Helper functions)
  getAvailableSlots: (station: ChargingStation) => number;
  getFilteredStations: () => ChargingStation[];
}

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
  activeFilter: 'All',
  selectedConnector: 'All',
  onlyAvailable: false,
  isLoading: false,

  fetchStations: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.getStations();
      if (response.success && response.data) {
        set({ stations: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setSelectedConnector: (connector) => set({ selectedConnector: connector }),
  setOnlyAvailable: (available) => set({ onlyAvailable: available }),

  getAvailableSlots: (station) => {
    return station.chargers.filter(c => c.status === 'Available').length;
  },

  getFilteredStations: () => {
    const { stations, activeFilter, selectedConnector, onlyAvailable } = get();
    return stations.filter((station) => {
      // 1. 타입 필터링 (급속/완속)
      const typeMatch = activeFilter === 'All' || station.chargers.some(c => c.charger_type === activeFilter);
      
      // 2. 커넥터 필터링 (DC Combo/Chademo 등)
      const connectorMatch = selectedConnector === 'All' || station.chargers.some(c => c.connector_type.includes(selectedConnector));
      
      // 3. 이용 가능 여부 필터링
      const availableCount = station.chargers.filter(c => c.status === 'Available').length;
      const availableMatch = !onlyAvailable || availableCount > 0;
      
      return typeMatch && connectorMatch && availableMatch;
    });
  },
}));
