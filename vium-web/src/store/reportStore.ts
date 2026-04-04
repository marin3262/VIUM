import { create } from 'zustand';
import { Report, ReportIssueType } from '../types';

interface ReportState {
  reports: Report[];
  
  // Actions
  addReport: (report: Omit<Report, 'id' | 'status' | 'timestamp'>) => void;
  updateReportStatus: (id: string, status: Report['status']) => void;
  
  // 관리자용: 대기 중인 제보만 가져오기
  getPendingReports: () => Report[];
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],

  addReport: (newReport) => {
    const report: Report = {
      ...newReport,
      id: `rep-${Date.now()}`,
      status: 'PENDING',
      timestamp: new Date().toLocaleString(),
    };
    set((state) => ({ reports: [report, ...state.reports] }));
  },

  updateReportStatus: (id, status) => set((state) => ({
    reports: state.reports.map((r) => r.id === id ? { ...r, status } : r)
  })),

  getPendingReports: () => {
    return get().reports.filter((r) => r.status === 'PENDING');
  },
}));
