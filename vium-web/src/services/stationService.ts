import { ChargingStation, Review } from '../types';
import { apiClient, ApiResponse } from './apiClient';

/**
 * 충전소 관련 데이터 통신을 전담하는 서비스입니다.
 * FastAPI 백엔드 엔드포인트와 통신합니다.
 */
export const stationService = {
  /**
   * 전체 충전소 목록을 가져옵니다.
   */
  getStations: async (): Promise<ApiResponse<ChargingStation[]>> => {
    return await apiClient.get<ChargingStation[]>('/stations');
  },

  /**
   * 현재 사용자 정보를 가져옵니다.
   */
  getUserMe: async (): Promise<ApiResponse<any>> => {
    return await apiClient.get<any>('/users/me');
  },

  /**
   * 특정 충전소에 대한 리뷰를 제출합니다.
   */
  submitReview: async (
    stationId: string, 
    review: Omit<Review, 'id' | 'date' | 'user_name'>
  ): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>(`/stations/${stationId}/reviews`, review);
  },

  /**
   * 충전소 고장 제보를 제출합니다.
   */
  submitReport: async (reportData: {
    stationId: string;
    issueType: string;
    content: string;
  }): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/reports', reportData);
  },

  /**
   * 모든 제보 내역을 가져옵니다 (관리자용).
   */
  getReports: async (): Promise<ApiResponse<any[]>> => {
    return await apiClient.get<any[]>('/reports');
  },

  /**
   * 제보 상태를 업데이트합니다 (승인/반려).
   */
  updateReportStatus: async (reportId: string, status: 'APPROVED' | 'REJECTED'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/reports/${reportId}`, { status });
  }
};
