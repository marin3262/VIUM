import type { ChargingStation, Review } from '../types';
import { apiClient } from './apiClient';
import type { ApiResponse } from './apiClient';

/**
 * 충전소 관련 데이터 통신을 전담하는 서비스입니다.
 */
export const stationService = {
  getStations: async (): Promise<ApiResponse<ChargingStation[]>> => {
    return await apiClient.get<ChargingStation[]>('/stations');
  },

  getUserMe: async (): Promise<ApiResponse<any>> => {
    return await apiClient.get<any>('/users/me');
  },

  submitReview: async (
    stationId: string, 
    review: Omit<Review, 'id' | 'created_at' | 'user_name' | 'status'>
  ): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>(`/stations/${stationId}/reviews`, review);
  },

  /**
   * [신규] 관리자 전용: 전체 리뷰(숨김 포함) 조회
   */
  getAllReviews: async (): Promise<ApiResponse<Review[]>> => {
    return await apiClient.get<Review[]>('/admin/reviews');
  },

  /**
   * [신규] 관리자 전용: 리뷰 상태(숨김/노출) 변경
   */
  updateReviewStatus: async (reviewId: number, status: 'VISIBLE' | 'HIDDEN'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/admin/reviews/${reviewId}/status`, { status });
  },

  submitReport: async (reportData: {
    charger_id: string;
    keyword: string;
    content: string;
    image?: File;
  }): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('charger_id', reportData.charger_id);
    formData.append('keyword', reportData.keyword);
    formData.append('content', reportData.content);
    if (reportData.image) {
      formData.append('image', reportData.image);
    }
    
    return await apiClient.postMultipart<any>('/reports', formData);
  },

  getReports: async (): Promise<ApiResponse<any[]>> => {
    return await apiClient.get<any[]>('/reports');
  },

  updateReportStatus: async (reportId: number, status: 'APPROVED' | 'REJECTED'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/reports/${reportId}`, { status });
  },

  updateChargerStatus: async (chargerId: string, status: 'Available' | 'Faulty' | 'Charging'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/chargers/${chargerId}/status?status=${status}`, {});
  },

  completeCharging: async (stationId: string): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>(`/stations/${stationId}/complete-charging`, {});
  }
};
