import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, 
  MapPin, XCircle,
  Activity, X, Wrench, MessageSquare, EyeOff, RotateCcw,
  Image as ImageIcon, Video, VideoOff, User, Star
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
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'MAINTENANCE' | 'REVIEWS' | 'CCTV_MONITOR'>('REPORTS');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 💡 라즈베리파이 CCTV 스트리밍 도메인 (팀원 가이드 반영)
  const [cctvUrl] = useState<string>("https://vium-camera.ngrok.app/video"); 
  const [cctvKey, setCctvKey] = useState<number>(Date.now()); // 캐시 무효화용 키
  const [isCctvOnline, setIsCctvOnline] = useState<boolean>(true);

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
          <button onClick={() => setActiveTab('CCTV_MONITOR')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'CCTV_MONITOR' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Video size={16} className={activeTab === 'CCTV_MONITOR' ? 'text-red-500 animate-pulse' : ''} />
            CCTV 실시간 관제
          </button>
          <button onClick={() => setActiveTab('REPORTS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            제보 승인 대기 ({pendingReports})
          </button>
          <button onClick={() => setActiveTab('MAINTENANCE')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'MAINTENANCE' ? 'bg-white shadow-md text-red-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            고장 충전기 관리 ({totalFaulty})
          </button>
          <button onClick={() => setActiveTab('REVIEWS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REVIEWS' ? 'bg-white shadow-md text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            UGC 리뷰 관제실 ({allReviews.length})
          </button>
        </div>

        <div className="p-2 md:p-6 min-h-[400px]">
          {activeTab === 'CCTV_MONITOR' && (
            <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">실시간 CCTV 관제</h3>
                  <p className="text-sm text-gray-500 mt-1 font-medium">현장 라즈베리파이 비전 센서 스트리밍 화면입니다.</p>
                </div>
                <div className="bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 flex items-center gap-2">
                  <MapPin size={14} className="text-red-500" /> 양주시 신도8차 아파트 1호기
                </div>
              </div>
              
              {/* 실시간 영상 모니터 프레임 (Double Masking 구조로 모서리 튀어나옴 방지) */}
              <div className="relative w-full max-w-4xl mx-auto aspect-video bg-gray-950 rounded-[40px] p-3 shadow-2xl ring-1 ring-white/10 group">
                <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-black shadow-inner">
                  {isCctvOnline && cctvUrl ? (
                    <img 
                      key={cctvKey}
                      src={`${cctvUrl}${cctvUrl.includes('?') ? '&' : '?'}t=${cctvKey}`} 
                      alt="실시간 관제 CCTV" 
                      onError={() => setIsCctvOnline(false)}
                      className="w-full h-full object-cover animate-in fade-in duration-1000"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/40 backdrop-blur-sm">
                      <VideoOff size={48} className="mb-4 opacity-50 text-red-500" />
                      <p className="font-black text-xl text-gray-300">CCTV 연결 오프라인</p>
                      <p className="text-sm mt-2 text-gray-400 font-medium px-6 text-center">라즈베리파이 스트리밍 주소가 올바르지 않거나<br/>네트워크 연결이 끊겼습니다.</p>
                      <button 
                        onClick={() => {
                          setCctvKey(Date.now());
                          setIsCctvOnline(true);
                        }} 
                        className="mt-8 px-8 py-3 bg-gray-800 border border-gray-700 rounded-2xl hover:bg-gray-700 text-white text-sm font-black transition-all active:scale-95 flex items-center gap-2 shadow-xl"
                      >
                        <RotateCcw size={16} /> 영상 재연결 시도
                      </button>
                    </div>
                  )}

                  {/* LIVE 뱃지 (글래스모피즘 효과 적용) */}
                  <div className="absolute top-6 left-6 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2.5 border border-white/10 shadow-lg select-none">
                    <span className={`w-2.5 h-2.5 rounded-full ${isCctvOnline && cctvUrl ? 'bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'bg-gray-500'}`}></span>
                    <span className="text-white text-[10px] font-black tracking-[0.2em] uppercase">LIVE CCTV</span>
                  </div>

                  {/* 스캔라인 효과 (실감나는 모니터 연출) */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] opacity-20"></div>
                </div>
              </div>

              <div className="max-w-4xl mx-auto bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
                <div className="bg-white text-blue-600 p-3 rounded-2xl shrink-0 shadow-sm"><Wrench size={20} /></div>
                <div className="pt-1">
                  <p className="text-sm font-black text-blue-900 mb-2">도메인 설정 및 연동 안내</p>
                  <p className="text-xs text-blue-700/80 leading-relaxed font-medium">
                    1. 라즈베리파이에서 영상 스트리밍 서버를 구동합니다.<br/>
                    2. 현재 코드 파일(<code className="bg-white px-1.5 py-0.5 rounded text-blue-600 mx-1 border border-blue-100">src/components/admin/AdminDashboard.tsx</code>)을 엽니다.<br/>
                    3. <code className="bg-white px-1.5 py-0.5 rounded text-blue-600 mx-1 border border-blue-100">cctvUrl</code> 상태 변수의 빈 문자열 <code className="bg-white px-1.5 py-0.5 rounded text-blue-600 mx-1 border border-blue-100">""</code> 안에 라즈베리파이의 스트리밍 주소(예: <code className="bg-white px-1.5 py-0.5 rounded text-blue-600 mx-1 border border-blue-100">http://[IP]:[포트]/video_feed</code>)를 입력하고 저장하면 즉시 영상이 송출됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REPORTS' && (
            <div className="divide-y divide-gray-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                        <button onClick={() => handleProcessReport(report.report_id, 'APPROVED')} className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all">승인 (+5점 회복)</button>
                        <button onClick={() => handleProcessReport(report.report_id, 'REJECTED')} className="px-6 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 active:scale-95 transition-all">반려 (신뢰도 -5)</button>
                      </div>
                    )}
                  </div>
                </div>
              )) : <div className="p-20 text-center text-gray-400 italic text-sm">접수된 제보가 없습니다.</div>}
            </div>
          )}

          {activeTab === 'MAINTENANCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                    className="w-full bg-white text-red-600 py-3 rounded-2xl text-xs font-black shadow-sm border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    {processingId === charger.charger_id ? <Activity size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    점검 완료 및 복구하기
                  </button>
                </div>
              )) : <div className="col-span-full p-20 text-center text-gray-400 italic text-sm">현재 점검 중인 충전기가 없습니다.</div>}
            </div>
          )}

          {activeTab === 'REVIEWS' && (
            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 gap-6">
                {allReviews.map((review) => {
                  const isHidden = review.status === 'HIDDEN';
                  const isDeleted = review.status === 'DELETED';
                  const targetStation = getStationByStationId(review.station_id);
                  
                  const isEdited = review.updated_at && 
                    (new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 2000);

                  return (
                    <div key={review.id} className={`group rounded-[32px] border transition-all overflow-hidden flex flex-col ${
                      isDeleted ? 'bg-red-50/20 border-red-100' :
                      isHidden ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                    }`}>
                      {/* 카드 상단: 충전소 정보 바 */}
                      <div className={`px-6 py-3 flex justify-between items-center border-b ${
                        isDeleted ? 'bg-red-50/50 border-red-100' :
                        isHidden ? 'bg-gray-100/50 border-gray-200' : 'bg-blue-50/30 border-blue-50'
                      }`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-white p-1.5 rounded-lg shadow-sm">
                            <MapPin size={14} className="text-blue-600" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-gray-900 truncate">
                              {review.station_name || targetStation?.station_name || review.station_id}
                            </span>
                            <span className="text-[10px] text-gray-400 truncate">
                              {review.station_address || targetStation?.address || '주소 정보 없음'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isDeleted ? (
                            <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">Deleted</span>
                          ) : isHidden ? (
                            <span className="bg-gray-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">Hidden</span>
                          ) : (
                            <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">Live</span>
                          )}
                        </div>
                      </div>

                      {/* 카드 본문: 리뷰 및 작성자 정보 */}
                      <div className="p-6 flex flex-col md:flex-row gap-6">
                        {/* 작성자 프로필 영역 */}
                        <div className="md:w-32 shrink-0 flex flex-col items-center text-center gap-2 border-r border-gray-50 pr-6 md:border-r">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center text-gray-500 shadow-inner">
                            <User size={24} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-gray-900 truncate w-24">@{review.user_name}</p>
                            <div className="flex justify-center mt-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} size={10} className={i < review.rating ? "text-yellow-400 fill-current" : "text-gray-100"} />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 리뷰 내용 영역 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3">
                            {isEdited && !isDeleted && (
                              <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-100">
                                <RotateCcw size={10} className="rotate-180" /> 수정됨
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 font-bold">
                              작성일: {new Date(review.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="relative">
                            {isDeleted && <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px] z-10 flex items-center justify-center font-black text-red-500/20 text-4xl select-none rotate-[-5deg]">DELETED</div>}
                            <p className={`text-sm leading-relaxed ${isDeleted ? 'text-gray-300 italic line-through' : 'text-gray-700 font-medium'}`}>
                              {review.content}
                            </p>
                          </div>

                          {isEdited && !isDeleted && (
                            <p className="mt-4 text-[10px] text-indigo-400 font-bold">
                              최종 수정 시각: {new Date(review.updated_at!).toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* 관리 액션 영역 */}
                        {!isDeleted && (
                          <div className="shrink-0 flex items-center">
                            <button 
                              onClick={() => handleToggleReviewStatus(review.id, review.status || "VISIBLE")}
                              disabled={processingId === `review_${review.id}`}
                              className={`w-full md:w-auto px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border active:scale-95 ${
                                isHidden 
                                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100' 
                                  : 'bg-white text-red-500 border-red-100 hover:bg-red-50'
                              }`}
                            >
                              {processingId === `review_${review.id}` ? <Activity size={14} className="animate-spin" /> : isHidden ? <RotateCcw size={14} /> : <EyeOff size={14} />}
                              {isHidden ? '다시 공개하기' : '리뷰 차단하기'}
                            </button>
                          </div>
                        )}
                      </div>
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
