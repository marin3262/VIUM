import { create } from 'zustand';
import type { UserProfile, ChargingStation } from '../types';
import { stationService } from '../services/stationService';

interface UserState {
  user: UserProfile | null;
  isLoading: boolean;
  pendingReviewStation: ChargingStation | null; // 신규: 리뷰 대기 중인 충전소 정보
  
  // Actions
  fetchUser: () => Promise<void>;
  updateUser: (user: Partial<UserProfile>) => void;
  completeCharging: (stationId: string) => Promise<boolean>;
  setPendingReview: (station: ChargingStation | null) => void; // 신규: 상태 설정 액션
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  isLoading: false,
  pendingReviewStation: null,

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.getUserMe();
      if (response.success && response.data) {
        set({ user: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      set({ isLoading: false });
    }
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
