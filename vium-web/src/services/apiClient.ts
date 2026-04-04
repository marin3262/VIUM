/**
 * VIUM API Client (Full Implementation)
 * 실제 백엔드 서버(FastAPI)와 통신하기 위한 기저 설정입니다.
 */

const BASE_URL = 'http://localhost:8000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const apiClient = {
  /**
   * GET 요청
   */
  get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API GET Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * POST 요청
   */
  post: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API POST Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * PATCH 요청 (제보 승인/반려 등에 사용)
   */
  patch: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API PATCH Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
};
