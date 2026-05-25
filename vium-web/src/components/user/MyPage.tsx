import React, { useState } from 'react';
import { 
  Coins, LogOut, Trash2, Clock, CheckCircle2, XCircle, Edit3
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { ReviewModal } from '../station/ReviewModal';
import type { Review } from '../../types';

interface MyPageProps {
  onClose: () => void;
}

type TabType = 'MILEAGE' | 'REPORTS' | 'REVIEWS';

export const MyPage: React.FC<MyPageProps> = ({ onClose }) => {
  const { user, withdrawAccount, logout, isLoading, deleteReview } = useUserStore();
  const [activeTab, setActiveTab] = useState<TabType>('MILEAGE');
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const handleWithdrawal = async () => {
    if (window.confirm('정말로 탈퇴하시겠습니까? 모든 활동 내역과 마일리지가 영구 삭제됩니다.')) {
      const result = await withdrawAccount();
      if (result.success) {
        alert('그동안 VIUM을 이용해 주셔서 감사합니다.');
        onClose();
      } else {
        alert(result.error || '탈퇴 처리 중 오류가 발생했습니다.');
      }
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (window.confirm('리뷰를 삭제하시겠습니까? 삭제 시 지급되었던 100P가 회수됩니다.')) {
      const result = await deleteReview(reviewId);
      if (result.success) {
        alert('리뷰가 삭제되었습니다.');
      } else {
        alert(result.error || '삭제 처리 중 오류가 발생했습니다.');
      }
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* 리뷰 수정 모달 */}
      {editingReview && (
        <ReviewModal 
          station={{ station_id: editingReview.station_id, station_name: editingReview.station_name || '나의 리뷰' } as any}
          editReview={editingReview}
          onClose={() => setEditingReview(null)}
        />
      )}

      <div className="relative bg-white w-full max-w-4xl h-full md:h-[85vh] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-500">
        
        {/* Header */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-3xl backdrop-blur-md flex items-center justify-center text-3xl font-black">
                {user.nickname[0]}
              </div>
              <div>
                <h2 className="text-2xl font-black">{user.nickname}님</h2>
                <p className="text-blue-100 text-sm font-medium opacity-80">{user.level}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <XCircle size={24} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Mileage</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black">{user.mileage_balance.toLocaleString()}</span>
                <span className="text-sm font-bold opacity-80">P</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Trust Score</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black">{user.trust_score || 100}</span>
                <span className="text-sm font-bold opacity-80">점</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-4 shrink-0 overflow-x-auto no-scrollbar">
          {(['MILEAGE', 'REPORTS', 'REVIEWS'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-xs font-black transition-all border-b-2 ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-600 bg-white' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'MILEAGE' && '마일리지 내역'}
              {tab === 'REPORTS' && `나의 제보 (${user.reports?.length || 0})`}
              {tab === 'REVIEWS' && `나의 리뷰 (${user.reviews?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
          {activeTab === 'MILEAGE' && (
            <div className="space-y-4">
              {user.mileage_logs?.length > 0 ? user.mileage_logs.map((log) => (
                <div key={log.log_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${log.amount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                      <Coins size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{log.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${log.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()} P
                  </span>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">마일리지 적립 내역이 없습니다.</div>
              )}
            </div>
          )}

          {activeTab === 'REPORTS' && (
            <div className="space-y-4">
              {user.reports?.length > 0 ? user.reports.map((report) => (
                <div key={report.report_id} className="p-5 border border-gray-100 rounded-3xl bg-white shadow-sm flex items-start gap-4">
                  <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    report.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                    report.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {report.status === 'PENDING' ? <Clock size={18} /> : 
                     report.status === 'APPROVED' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{report.station_name || '충전소'}</h4>
                      <span className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{report.content}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      report.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 
                      report.status === 'APPROVED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {report.status === 'PENDING' ? '처리 대기 중' : 
                       report.status === 'APPROVED' ? '제보 승인 완료' : '반려됨'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">신고한 제보 내역이 없습니다.</div>
              )}
            </div>
          )}

          {activeTab === 'REVIEWS' && (
            <div className="space-y-4">
              {user.reviews?.length > 0 ? user.reviews.map((review) => (
                <div key={review.id} className="p-5 border border-gray-100 rounded-3xl bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-xs ${i < review.rating ? 'fill-current' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setEditingReview(review)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="수정"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteReview(review.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mb-3 break-keep">{review.content}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                      review.status === 'VISIBLE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {review.status === 'VISIBLE' ? '정상 노출 중' : '관리자에 의해 숨김 처리됨'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">작성한 리뷰가 없습니다.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer Settings */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3 md:rounded-b-[40px]">
          <button 
            onClick={() => { logout(); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white border border-gray-200 text-gray-600 rounded-2xl text-xs font-black hover:bg-gray-100 transition-all active:scale-95"
          >
            <LogOut size={16} /> 로그아웃
          </button>
          <button 
            onClick={handleWithdrawal}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-50 text-red-500 rounded-2xl text-xs font-black hover:bg-red-100 transition-all active:scale-95 disabled:opacity-50"
          >
            <Trash2 size={16} /> 회원 탈퇴
          </button>
        </div>

      </div>
    </div>
  );
};
