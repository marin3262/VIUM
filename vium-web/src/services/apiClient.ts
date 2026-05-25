/**
 * VIUM API Client (Full Implementation)
 * 실제 백엔드 서버(FastAPI)와 통신하기 위한 기저 설정입니다.
 */

// [중요] KT Cloud 공인 IP로 설정 (ERR_CONNECTION_REFUSED 해결)
const BASE_URL = 'http://211.253.31.143:8000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  points_added?: number; // 보상 정보 포함을 위해 추가
  total_balance?: number;
}

export const apiClient = {
  /**
   * 공통 헤더 생성 (인증 토큰 포함)
   */
  getHeaders: (isMultipart = false) => {
    const headers: any = {};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }
    
    const token = localStorage.getItem('vium_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  /**
   * GET 요청
   */
  get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        headers: apiClient.getHeaders()
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
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
        headers: apiClient.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
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
        headers: apiClient.getHeaders(true),
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
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
        headers: apiClient.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API PATCH Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  /**
   * DELETE 요청
   */
  delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: apiClient.getHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error(`API DELETE Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
};
