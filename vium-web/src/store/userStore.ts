import { create } from 'zustand';
import type { UserProfile, ChargingStation } from '../types';
import { stationService } from '../services/stationService';

interface UserState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingReviewStation: ChargingStation | null;
  
  // Actions
  fetchUser: () => Promise<void>;
  login: (credentials: FormData) => Promise<boolean>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  completeCharging: (stationId: string) => Promise<boolean>;
  setPendingReview: (station: ChargingStation | null) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  token: localStorage.getItem('vium_token'),
  isAuthenticated: !!localStorage.getItem('vium_token'),
  isLoading: false,
  pendingReviewStation: null,

  fetchUser: async () => {
    if (!get().token) return;
    
    set({ isLoading: true });
    try {
      const response = await stationService.getUserMe();
      if (response.success && response.data) {
        set({ user: response.data, isAuthenticated: true });
      } else {
        // 토큰이 유효하지 않은 경우 로그아웃 처리
        get().logout();
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      get().logout();
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials: FormData) => {
    set({ isLoading: true });
    try {
      const response = await stationService.login(credentials);
      if (response.success && response.data) {
        const token = response.data.access_token;
        localStorage.setItem('vium_token', token);
        set({ token, isAuthenticated: true });
        await get().fetchUser();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (userData: any): Promise<{ success: boolean; error?: string }> => {
    set({ isLoading: true });
    try {
      const response = await stationService.signup(userData);
      return { 
        success: response.success, 
        error: response.error 
      };
    } catch (error) {
      return { 
        success: false, 
        error: '서버와 통신하는 도중 오류가 발생했습니다.' 
      };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('vium_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (partialUser) => set((state) => {
    if (!state.user) return state;
    return {
      user: { ...state.user, ...partialUser }
    };
  }),

  setPendingReview: (station) => set({ pendingReviewStation: station }),

  completeCharging: async (stationId: string) => {
    try {
      const response = await stationService.completeCharging(stationId);
      if (response.success) {
        await get().fetchUser();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to complete charging:', error);
      return false;
    }
  }
}));
