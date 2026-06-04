import { create } from 'zustand';
import type { ChargingStation, ChargerType } from '../types';
import { stationService } from '../services/stationService';
import { FILTER_CONNECTOR_MAP } from '../types/constants';

interface StationState {
  stations: ChargingStation[];
  activeFilter: ChargerType | 'All';
  selectedConnector: string | 'All';
  onlyAvailable: boolean;
  searchQuery: string;
  isLoading: boolean;
  
  // Selection States
  selectedStationId: string | null;
  reportTargetId: string | null;
  summaryStationId: string | null;
  
  // GPS & Routing
  userLocation: { lat: number; lng: number } | null;
  routePath: [number, number][]; 
  routeSummary: { distance: number; duration: number; destinationName?: string } | null;
  
  // Actions
  fetchStations: () => Promise<void>;
  setActiveFilter: (filter: ChargerType | 'All') => void;
  setSelectedConnector: (connector: string | 'All') => void;
  setOnlyAvailable: (available: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  setSelectedStationId: (id: string | null) => void;
  setReportTargetId: (id: string | null) => void;
  setSummaryStationId: (id: string | null) => void;
  
  fetchRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, destName?: string) => Promise<void>;
  clearRoute: () => void;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
  
  // Helpers
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

  selectedStationId: null,
  reportTargetId: null,
  summaryStationId: null,

  userLocation: null,
  routePath: [],
  routeSummary: null,

  fetchStations: async () => {
    const isInitialLoad = get().stations.length === 0;
    if (isInitialLoad) set({ isLoading: true });
    
    try {
      const response = await stationService.getStations();
      if (response.success && response.data) {
        set({ stations: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      if (isInitialLoad) set({ isLoading: false });
    }
  },

  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setSelectedConnector: (connector) => set({ selectedConnector: connector }),
  setOnlyAvailable: (available) => set({ onlyAvailable: available }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedStationId: (id) => set({ selectedStationId: id }),
  setReportTargetId: (id) => set({ reportTargetId: id }),
  setSummaryStationId: (id) => set({ summaryStationId: id }),

  fetchRoute: async (origin, destination, destName) => {
    set({ isLoading: true });
    try {
      const originStr = `${origin.lng},${origin.lat}`;
      const destStr = `${destination.lng},${destination.lat}`;
      const response = await stationService.getDirections(originStr, destStr);
      if (response.success && response.data) {
        set({ 
          routePath: response.data.path,
          routeSummary: { ...response.data.summary, destinationName: destName }
        });
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  clearRoute: () => set({ routePath: [], routeSummary: null }),
  setUserLocation: (location) => set({ userLocation: location }),

  getAvailableSlots: (station) => {
    if (!station || !Array.isArray(station.chargers)) return 0;
    return station.chargers.filter(c => c && c.status === 'Available').length;
  },

  getFilteredStations: () => {
    const { stations, activeFilter, selectedConnector, onlyAvailable, searchQuery } = get();
    if (!Array.isArray(stations)) return [];

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = stations.filter((station) => {
      const typeMatch = activeFilter === 'All' || station.chargers.some(c => c.charger_type === activeFilter);
      const connectorMatch = selectedConnector === 'All' || station.chargers.some(c => {
        const allowed = FILTER_CONNECTOR_MAP[selectedConnector] || [];
        return allowed.includes(c.connector_type);
      });
      const availableMatch = !onlyAvailable || station.chargers.some(c => c.status === 'Available');

      if (!(typeMatch && connectorMatch && availableMatch)) return false;
      if (normalizedQuery === '') return true;

      return station.station_name.toLowerCase().includes(normalizedQuery) || 
             station.address.toLowerCase().includes(normalizedQuery);
    });

    if (normalizedQuery === '') return filtered;
    return [...filtered].sort((a, b) => {
      const aMatch = a.station_name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
      const bMatch = b.station_name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
      return bMatch - aMatch;
    });
  },
}));
