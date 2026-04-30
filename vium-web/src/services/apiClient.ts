/**
 * VIUM API Client (Full Implementation)
 * 실제 백엔드 서버(FastAPI)와 통신하기 위한 기저 설정입니다.
 */

const BASE_URL = 'http://localhost:8000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  points_added?: number; // 보상 정보 포함을 위해 추가
  total_balance?: number;
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
   * POST 요청 (JSON)
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
      // 보상 데이터가 최상위에 있을 경우 ApiResponse 구조에 맞게 매핑
      return { 
        success: true, 
        data,
        points_added: data.points_added,
        total_balance: data.total_balance
      };
    } catch (error) {
      console.error(`API POST Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * POST 요청 (Multipart/FormData - 사진 업로드용)
   */
  postMultipart: async <T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        // headers에 'Content-Type'을 설정하지 않아야 브라우저가 boundary를 자동으로 생성함
        body: formData,
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API Multipart Error [${endpoint}]:`, error);
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
