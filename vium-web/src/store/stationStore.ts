import { create } from 'zustand';
import { ChargingStation, StationType, ConnectorType, Review } from '../types';
import { stationService } from '../services/stationService';

interface StationState {
  stations: ChargingStation[];
  activeFilter: StationType;
  selectedConnector: ConnectorType | 'All';
  onlyAvailable: boolean;
  isLoading: boolean;
  
  // Actions
  fetchStations: () => Promise<void>;
  setActiveFilter: (filter: StationType) => void;
  setSelectedConnector: (connector: ConnectorType | 'All') => void;
  setOnlyAvailable: (available: boolean) => void;
  addReview: (stationId: string, review: Review) => void; 
  
  // Computed
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

  // [핵심 수정] 서버에서 받은 Review 객체를 그대로 stations 배열에 주입
  addReview: (stationId, newReview) => set((state) => ({
    stations: state.stations.map((s) => 
      s.id === stationId 
        ? { 
            ...s, 
            reviews: [newReview, ...(s.reviews || [])] 
          } 
        : s
    )
  })),

  getFilteredStations: () => {
    const { stations, activeFilter, selectedConnector, onlyAvailable } = get();
    return stations.filter((station) => {
      const typeMatch = activeFilter === 'All' || station.type === activeFilter;
      const connectorMatch = selectedConnector === 'All' || station.connectorTypes?.includes(selectedConnector as ConnectorType);
      const availableMatch = !onlyAvailable || station.status === 'Available';
      return typeMatch && connectorMatch && availableMatch;
    });
  },
}));
