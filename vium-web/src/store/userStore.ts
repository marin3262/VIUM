import { create } from 'zustand';
import type { UserProfile, ChargingStation } from '../types';
import { stationService } from '../services/stationService';

interface UserState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingReviewStation: ChargingStation | null;
  
  fetchUser: () => Promise<void>;
  login: (credentials: FormData) => Promise<boolean>;
  sendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  checkNickname: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  withdrawAccount: () => Promise<{ success: boolean; error?: string }>;
  updateReview: (reviewId: number, rating: number, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteReview: (reviewId: number) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  completeCharging: (stationId: string, points: number) => Promise<boolean>;
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
        get().logout();
      }
    } catch (error) {
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

  sendVerificationEmail: async (email: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.sendVerificationEmail(email);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '인증 메일 발송에 실패했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmailCode: async (email: string, code: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.verifyEmailCode(email, code);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '코드 검증에 실패했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

  checkNickname: async (nickname: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.checkNickname(nickname);
      return response.success ? { success: true } : { success: false, error: response.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (userData: any) => {
    set({ isLoading: true });
    try {
      const response = await stationService.signup(userData);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '서버 통신 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  withdrawAccount: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.withdrawAccount();
      if (response.success) {
        get().logout();
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error: any) {
      return { success: false, error: error.message };
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
    return { user: { ...state.user, ...partialUser } };
  }),

  setPendingReview: (station) => set({ pendingReviewStation: station }),

  updateReview: async (reviewId, rating, content) => {
    set({ isLoading: true });
    try {
      const response = await stationService.updateReview(reviewId, rating, content);
      if (response.success) await get().fetchUser();
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 수정 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteReview: async (reviewId) => {
    set({ isLoading: true });
    try {
      const response = await stationService.deleteReview(reviewId);
      if (response.success) await get().fetchUser();
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 삭제 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  completeCharging: async (stationId: string, points: number) => {
    try {
      const response = await stationService.completeCharging(stationId, points);
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
