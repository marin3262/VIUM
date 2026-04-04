import { create } from 'zustand';
import { UserProfile } from '../types';
import { MOCK_USER } from '../mockData';
import { stationService } from '../services/stationService';

interface UserState {
  user: UserProfile;
  points: number;
  isLoading: boolean;
  
  // Actions
  fetchUser: () => Promise<void>;
  setPoints: (points: number) => void;
  addPoints: (amount: number, reason: string) => void; // 즉시 가산 및 로그 (관리자/단순 작업용)
  addActivity: (amount: number, reason: string) => void; // 로그만 기록 (애니메이션 동반 작업용)
  updateUser: (user: Partial<UserProfile>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: MOCK_USER,
  points: MOCK_USER.points,
  isLoading: false,

  fetchUser: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.getUserMe();
      if (response.success && response.data) {
        set({ 
          user: response.data,
          points: response.data.points 
        });
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setPoints: (points) => set({ points }),

  addPoints: (amount, reason) => set((state) => ({
    points: state.points + amount,
    user: {
      ...state.user,
      recentActivity: [
        {
          id: `act-${Date.now()}`,
          type: reason,
          date: new Date().toLocaleDateString(),
          amount: `+${amount.toLocaleString()} P`
        },
        ...state.user.recentActivity
      ]
    }
  })),

  addActivity: (amount, reason) => set((state) => ({
    user: {
      ...state.user,
      recentActivity: [
        {
          id: `act-${Date.now()}`,
          type: reason,
          date: new Date().toLocaleDateString(),
          amount: `+${amount.toLocaleString()} P`
        },
        ...state.user.recentActivity
      ]
    }
  })),
  
  updateUser: (partialUser) => set((state) => ({
    user: { ...state.user, ...partialUser }
  })),
}));
