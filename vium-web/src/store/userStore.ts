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
  sendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  checkNickname: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  withdrawAccount: () => Promise<{ success: boolean; error?: string }>;
  updateReview: (reviewId: number, rating: number, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteReview: (reviewId: number) => Promise<{ success: boolean; error?: string }>;
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
      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error || '이미 사용 중인 닉네임입니다.' };
      }
    } catch (error: any) {
      // apiClient가 던진 상세 에러 메시지 활용
      return { success: false, error: error.message || '닉네임 중복 확인에 실패했습니다.' };
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

  withdrawAccount: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.withdrawAccount();
      if (response.success) {
        get().logout();
        return { success: true };
      }
      // 백엔드에서 온 에러 메시지를 우선 사용 (사유: ... 가 포함된 메시지)
      return { success: false, error: response.error };
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      return { success: false, error: error.message || '탈퇴 처리 중 예상치 못한 오류가 발생했습니다.' };
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

  updateReview: async (reviewId, rating, content) => {
    set({ isLoading: true });
    try {
      const response = await stationService.updateReview(reviewId, rating, content);
      if (response.success) {
        await get().fetchUser(); // 변경된 리뷰 내용 반영을 위해 유저 정보 갱신
      }
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 수정 중 오류가 발생했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

  deleteReview: async (reviewId) => {
    set({ isLoading: true });
    try {
      const response = await stationService.deleteReview(reviewId);
      if (response.success) {
        await get().fetchUser(); // 마일리지 회수 및 리스트 갱신을 위해 유저 정보 전수 갱신
      }
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 삭제 중 오류가 발생했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

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
