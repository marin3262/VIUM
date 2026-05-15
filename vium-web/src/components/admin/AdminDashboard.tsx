import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, 
  MapPin, XCircle,
  Activity, X, Wrench, MessageSquare, EyeOff, RotateCcw,
  Image as ImageIcon
} from 'lucide-react';
import { useStationStore } from '../../store/stationStore';
import { useUserStore } from '../../store/userStore';
import { stationService } from '../../services/stationService';
import { useNotificationStore } from '../../store/notificationStore';
import type { Review } from '../../types';

const SERVER_ROOT = 'http://localhost:8000'; // 이미지 호스팅 서버 주소

export const AdminDashboard: React.FC = () => {
  const { stations, fetchStations } = useStationStore();
  const { fetchUser } = useUserStore();
  const { addNotification } = useNotificationStore();
  
  const [reports, setReports] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'MAINTENANCE' | 'REVIEWS'>('REPORTS');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const loadAdminData = async () => {
    
    try {
      const [reportsRes, reviewsRes] = await Promise.all([
        stationService.getReports(),
        stationService.getAllReviews()
      ]);
      
      if (reportsRes.success && reportsRes.data) setReports(reportsRes.data);
      if (reviewsRes.success && reviewsRes.data) setAllReviews(reviewsRes.data);
      
      await fetchStations();
      await fetchUser();
    } catch (error) {
      console.error('관리자 데이터 로드 실패:', error);
    } finally {
      
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleProcessReport = async (reportId: number, status: 'APPROVED' | 'REJECTED') => {
    if (processingId) return;
    setProcessingId(reportId);
    try {
      const response = await stationService.updateReportStatus(reportId, status);
      if (response.success) {
        addNotification({
          role: 'USER',
          type: status === 'APPROVED' ? 'SUCCESS' : 'INFO',
          title: status === 'APPROVED' ? '제보 승인 완료! 🎉' : '제보 반려 안내 ℹ️',
          message: status === 'APPROVED' ? `제보가 승인되어 보상이 지급되었습니다.` : `제보가 반려되었습니다.`
        });
        await loadAdminData();
      }
    } catch (error) {
      console.error('제보 처리 중 오류 발생:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRepairComplete = async (chargerId: string) => {
    if (processingId) return;
    setProcessingId(chargerId);
    try {
      const response = await stationService.updateChargerStatus(chargerId, 'Available');
      if (response.success) {
        addNotification({
          role: 'ADMIN',
          type: 'SUCCESS',
          title: '점검 완료 및 서비스 재개 🛠️',
          message: `${chargerId}번 충전기가 정상 가동 상태로 변경되었습니다.`
        });
        await loadAdminData();
      } else {
        addNotification({
          role: 'ADMIN',
          type: 'ERROR',
          title: '상태 변경 실패 ❌',
          message: response.error || '서버 응답 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      console.error('수리 완료 처리 중 오류:', error);
      addNotification({
        role: 'ADMIN',
        type: 'ERROR',
        title: '시스템 오류 ⚠️',
        message: '통신 중 예상치 못한 오류가 발생했습니다.'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleReviewStatus = async (reviewId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE';
    const actionText = nextStatus === 'HIDDEN' ? '숨김 처리하고 패널티를 부여' : '다시 노출하고 점수를 복구';
    
    if (processingId || !window.confirm(`해당 리뷰를 ${actionText}하시겠습니까?`)) return;
    
    setProcessingId(`review_${reviewId}`);
    try {
      const response = await stationService.updateReviewStatus(reviewId, nextStatus);
      if (response.success) {
        addNotification({
          role: 'ADMIN',
          type: 'SUCCESS',
          title: nextStatus === 'HIDDEN' ? '리뷰 차단 완료 🛡️' : '리뷰 복구 완료 ✅',
          message: nextStatus === 'HIDDEN' ? '부적절한 리뷰가 가려졌습니다.' : '리뷰가 다시 유저들에게 공개되었습니다.'
        });
        await loadAdminData();
      }
    } catch (error) {
      console.error('리뷰 상태 변경 실패:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getStationByChargerId = (chargerId: string) => {
    return stations.find(s => s.chargers.some(c => c.charger_id === chargerId));
  };
  
  const getStationByStationId = (stationId: string) => {
    return stations.find(s => s.station_id === stationId);
  };

  const faultyChargersList = stations.flatMap(s => 
    s.chargers.filter(c => c.status === 'Faulty').map(c => ({ ...c, station_name: s.station_name }))
  );

  const totalFaulty = faultyChargersList.length;
  const pendingReports = reports.filter(r => r.status === 'PENDING').length;
  const visibleReviewsCount = allReviews.filter(r => r.status === 'VISIBLE').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* 사진 크게 보기 오버레이 */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in duration-300" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <img src={`${SERVER_ROOT}${selectedImage}`} alt="Full Report Proof" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" />
            <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-black text-sm hover:text-red-400 transition-colors">
              <X size={24} /> 닫기
            </button>
          </div>
        </div>
      )}

      {/* 상단 통계 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '전체 충전소', value: stations.length, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '점검 중 충전기', value: totalFaulty, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
          { label: '대기 중 제보', value: pendingReports, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '정상 노출 리뷰', value: visibleReviewsCount, icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}><stat.icon size={24} /></div>
            <p className="text-gray-400 text-[10px] font-black uppercase mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-2 bg-gray-50/50 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('REPORTS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}>
            제보 승인 대기 ({pendingReports})
          </button>
          <button onClick={() => setActiveTab('MAINTENANCE')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'MAINTENANCE' ? 'bg-white shadow-md text-red-600' : 'text-gray-400'}`}>
            고장 충전기 관리 ({totalFaulty})
          </button>
          <button onClick={() => setActiveTab('REVIEWS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REVIEWS' ? 'bg-white shadow-md text-purple-600' : 'text-gray-400'}`}>
            UGC 리뷰 관제실 ({allReviews.length})
          </button>
        </div>

        <div className="p-2 md:p-6 min-h-[400px]">
          {activeTab === 'REPORTS' && (
            <div className="divide-y divide-gray-50">
              {reports.length > 0 ? reports.map((report) => (
                <div key={report.report_id} className="p-6 hover:bg-gray-50 transition-colors flex items-start gap-4">
                  <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${report.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : report.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {report.status === 'PENDING' ? <Clock size={18} /> : report.status === 'APPROVED' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{getStationByChargerId(report.charger_id)?.station_name || '알 수 없는 곳'}</h4>
                      <span className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-blue-600 font-bold mb-2">{report.charger_id}번 충전기 - {report.keyword}</p>
                    <p className="text-sm text-gray-600 mb-4">{report.content}</p>
                    
                    {report.image_url && (
                      <div className="mb-4 group relative w-32 h-32">
                        <img 
                          src={`${SERVER_ROOT}${report.image_url}`} 
                          alt="Report Proof" 
                          className="w-32 h-32 object-cover rounded-2xl border border-gray-100 cursor-pointer shadow-sm group-hover:scale-105 transition-transform"
                          onClick={() => setSelectedImage(report.image_url)}
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center pointer-events-none transition-opacity">
                          <ImageIcon className="text-white" size={20} />
                        </div>
                      </div>
                    )}

                    {report.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleProcessReport(report.report_id, 'APPROVED')} className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100">승인 (+5점 회복)</button>
                        <button onClick={() => handleProcessReport(report.report_id, 'REJECTED')} className="px-6 py-2 bg-white border border-gray-200 text-gray-400 rounded-xl text-xs font-bold">반려 (신뢰도 -5)</button>
                      </div>
                    )}
                  </div>
                </div>
              )) : <div className="p-20 text-center text-gray-400 italic text-sm">접수된 제보가 없습니다.</div>}
            </div>
          )}

          {activeTab === 'MAINTENANCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {faultyChargersList.length > 0 ? faultyChargersList.map((charger) => (
                <div key={charger.charger_id} className="bg-red-50 border border-red-100 p-6 rounded-[32px] flex flex-col justify-between gap-4">
                  <div>
                    <div className="bg-red-100 text-red-600 w-10 h-10 rounded-xl flex items-center justify-center mb-3"><Wrench size={20} /></div>
                    <h4 className="font-black text-red-900">{charger.station_name}</h4>
                    <p className="text-xs font-bold text-red-600 mt-1">{charger.charger_id}번 충전기 ({charger.charger_type})</p>
                  </div>
                  <button 
                    onClick={() => handleRepairComplete(charger.charger_id)}
                    disabled={processingId === charger.charger_id}
                    className="w-full bg-white text-red-600 py-3 rounded-2xl text-xs font-black shadow-sm border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    {processingId === charger.charger_id ? <Activity size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    점검 완료 및 복구하기
                  </button>
                </div>
              )) : <div className="col-span-full p-20 text-center text-gray-400 italic text-sm">현재 점검 중인 충전기가 없습니다.</div>}
            </div>
          )}

          {activeTab === 'REVIEWS' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {allReviews.map((review) => {
                  const isHidden = review.status === 'HIDDEN';
                  return (
                    <div key={review.id} className={`p-5 rounded-3xl border transition-all flex flex-col sm:flex-row gap-4 justify-between ${isHidden ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className={isHidden ? 'opacity-50' : ''}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isHidden ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                            {isHidden ? '숨김 처리됨' : '정상 노출'}
                          </span>
                          <span className="text-xs font-bold text-gray-400">{getStationByStationId(review.station_id)?.station_name || review.station_id}</span>
                        </div>
                        <p className="text-sm text-gray-900 mb-2">{review.content}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="font-bold">작성자: {review.user_name}</span>
                          <span>{new Date(review.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => handleToggleReviewStatus(review.id, review.status || "VISIBLE")}
                        disabled={processingId === `review_${review.id}`}
                        className={`shrink-0 self-start sm:self-center px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border ${
                          isHidden 
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100' 
                            : 'bg-white text-red-500 border-red-100 hover:bg-red-50'
                        }`}
                      >
                        {processingId === `review_${review.id}` ? <Activity size={14} className="animate-spin" /> : isHidden ? <RotateCcw size={14} /> : <EyeOff size={14} />}
                        {isHidden ? '다시 공개하기' : '리뷰 숨기기'}
                      </button>
                    </div>
                  );
                })}
                {allReviews.length === 0 && <div className="p-10 text-center text-gray-400 italic text-sm">작성된 리뷰가 없습니다.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
