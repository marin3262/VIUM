import { create } from 'zustand';
import type { ChargingStation, ChargerType, Review } from '../types';
import { stationService } from '../services/stationService';

interface StationState {
  stations: ChargingStation[];
  activeFilter: ChargerType | 'All';
  selectedConnector: string | 'All';
  onlyAvailable: boolean;
  searchQuery: string;
  isLoading: boolean;
  
  // Actions
  fetchStations: () => Promise<void>;
  setActiveFilter: (filter: ChargerType | 'All') => void;
  setSelectedConnector: (connector: string | 'All') => void;
  setOnlyAvailable: (available: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  // Computed (Helper functions)
  getAvailableSlots: (station: ChargingStation) => number;
  getFilteredStations: () => ChargingStation[];
}

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
  activeFilter: 'All',
  selectedConnector: 'All',
  onlyAvailable: false,
  searchQuery: '',
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
  setSearchQuery: (query) => set({ searchQuery: query }),

  getAvailableSlots: (station) => {
    if (!station || !Array.isArray(station.chargers)) return 0;
    return station.chargers.filter(c => c && c.status === 'Available').length;
  },

  getFilteredStations: () => {
    try {
      const { stations = [], activeFilter, selectedConnector, onlyAvailable, searchQuery } = get();
      
      if (!Array.isArray(stations)) return [];

      const normalizedQuery = searchQuery.trim().toLowerCase();

      // 1. 기본 필터링
      const filtered = stations.filter((station) => {
        if (!station || !Array.isArray(station.chargers)) return false;

        const typeMatch = activeFilter === 'All' || station.chargers.some(c => c?.charger_type === activeFilter);
        const connectorMatch = selectedConnector === 'All' || station.chargers.some(c => (c?.connector_type || '').includes(selectedConnector));
        const availableCount = station.chargers.filter(c => c?.status === 'Available').length;
        const availableMatch = !onlyAvailable || availableCount > 0;

        if (!(typeMatch && connectorMatch && availableMatch)) return false;

        if (normalizedQuery === '') return true;

        const nameMatch = station.station_name?.toLowerCase().includes(normalizedQuery);
        const addressMatch = station.address?.toLowerCase().includes(normalizedQuery);

        return nameMatch || addressMatch;
      });

      // 2. 지능형 정렬: 이름 매칭 항목을 최상단으로 (Sorting Relevance)
      if (normalizedQuery === '') return filtered;

      return [...filtered].sort((a, b) => {
        const aNameMatch = a.station_name?.toLowerCase().includes(normalizedQuery) ? 10 : 0;
        const bNameMatch = b.station_name?.toLowerCase().includes(normalizedQuery) ? 10 : 0;
        return bNameMatch - aNameMatch;
      });
    } catch (err) {
      console.error("[StationStore] filtering crash prevented:", err);
      return [];
    }
  },
}));
