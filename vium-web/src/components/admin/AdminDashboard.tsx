import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Users, AlertCircle, CheckCircle2, Clock, 
  MapPin, ShieldCheck, TrendingUp, Search, XCircle,
  Activity, Zap, Info, Check, X
} from 'lucide-react';
import { useStationStore } from '../../store/stationStore';
import { useUserStore } from '../../store/userStore'; // 추가
import { stationService } from '../../services/stationService';
import { useNotificationStore } from '../../store/notificationStore';

export const AdminDashboard: React.FC = () => {
  const { stations, fetchStations } = useStationStore();
  const { fetchUser } = useUserStore(); // 추가: 유저 정보 갱신 액션
  const { addNotification } = useNotificationStore();
  
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const response = await stationService.getReports();
      if (response.success && response.data) {
        setReports(response.data);
      }
      await fetchStations();
    } catch (error) {
      console.error('관리자 데이터 로드 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleProcessReport = async (reportId: string, status: 'APPROVED' | 'REJECTED') => {
    if (processingId) return;
    
    const report = reports.find(r => r.id === reportId);
    const station = stations.find(s => s.id === report?.stationId);
    
    setProcessingId(reportId);
    try {
      const response = await stationService.updateReportStatus(reportId, status);
      if (response.success) {
        // 1. 사용자에게 처리 결과 알림 전송
        if (status === 'APPROVED') {
          addNotification({
            role: 'USER',
            type: 'SUCCESS',
            title: '제보 승인 완료! 🎉',
            message: `${station?.name || '충전소'} 제보가 승인되어 500P가 적립되었습니다.`
          });
        } else {
          addNotification({
            role: 'USER',
            type: 'INFO',
            title: '제보 반려 안내 ℹ️',
            message: `${station?.name || '충전소'} 제보가 검토 결과 반려되었습니다.`
          });
        }

        // [핵심] 2. 사용자 마일리지 및 활동 내역 실시간 갱신
        // 서버 DB가 바뀌었으므로, 프론트엔드의 userStore도 최신 정보를 다시 가져옵니다.
        await fetchUser();

        // 3. 관리자 목록 및 통계 데이터 갱신
        await loadAdminData();
      }
    } catch (error) {
      console.error('제보 처리 중 오류 발생:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const totalFaulty = stations.filter(s => s.status === 'Faulty').length;
  const pendingReports = reports.filter(r => r.status === 'PENDING').length;
  const avgPrice = Math.round(stations.reduce((acc, s) => acc + s.price, 0) / (stations.length || 1));

  const stats = [
    { label: '전체 충전소', value: stations.length, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '현재 고장/점검', value: totalFaulty, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: '대기 중인 제보', value: pendingReports, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: '평균 충전 단가', value: `${avgPrice}원`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
            <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
              <stat.icon size={24} />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900">최근 고장/불편 제보</h3>
                <p className="text-gray-400 text-xs mt-1">실시간 사용자 제보 현황입니다.</p>
              </div>
              <button onClick={loadAdminData} className="p-2 hover:bg-gray-50 rounded-xl transition-colors">
                <Activity size={20} className={isLoading ? 'animate-spin text-blue-500' : 'text-gray-400'} />
              </button>
            </div>
            
            <div className="divide-y divide-gray-50">
              {isLoading && reports.length === 0 ? (
                <div className="p-20 text-center text-gray-400 italic">데이터 로딩 중...</div>
              ) : reports.length > 0 ? (
                reports.map((report) => {
                  const station = stations.find(s => s.id === report.stationId);
                  return (
                    <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors flex items-start gap-4 group">
                      <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        report.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                        report.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {report.status === 'PENDING' ? <Clock size={18} /> : 
                         report.status === 'APPROVED' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 truncate">{station?.name || '알 수 없는 충전소'}</h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(report.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{report.content}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{report.issueType}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              report.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 
                              report.status === 'APPROVED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {report.status === 'PENDING' ? '승인 대기' : 
                               report.status === 'APPROVED' ? '승인 완료 (+500P)' : '반려됨'}
                            </span>
                          </div>
                          
                          {report.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleProcessReport(report.id, 'APPROVED')}
                                disabled={!!processingId}
                                className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 active:scale-90"
                              >
                                <Check size={16} />
                              </button>
                              <button 
                                onClick={() => handleProcessReport(report.id, 'REJECTED')}
                                disabled={!!processingId}
                                className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-90"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-20 text-center text-gray-400 italic">접수된 제보가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-600 rounded-[40px] p-8 text-white shadow-xl shadow-blue-100">
            <h3 className="text-lg font-black mb-6 flex items-center gap-2"><Activity size={20} /> 시스템 가동 현황</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2"><p>정상 작동률</p><p>{Math.round((stations.filter(s=>s.status!=='Faulty').length/(stations.length || 1))*100)}%</p></div>
                <div className="h-2 bg-blue-400/30 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: `${(stations.filter(s=>s.status!=='Faulty').length/(stations.length || 1))*100}%` }}></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 p-4 rounded-2xl"><p className="text-[10px] font-bold opacity-60 mb-1">고장 충전소</p><p className="text-xl font-black">{totalFaulty}개</p></div>
                <div className="bg-white/10 p-4 rounded-2xl"><p className="text-[10px] font-bold opacity-60 mb-1">대기 제보</p><p className="text-xl font-black">{pendingReports}건</p></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-[40px] p-8 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Zap size={18} className="text-blue-500" /> 관리자 안내</h3>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-xs text-blue-800 font-bold leading-relaxed">
                제보 승인 시 유저에게 <span className="underline">500P</span>가 즉시 지급되며, 해당 충전소는 자동으로 <span className="text-red-600">'점검 중'</span> 상태로 변경됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
