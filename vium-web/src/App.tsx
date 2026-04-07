import { useState, useEffect, useMemo } from 'react';
import { MapPin, Coins, Search, ShieldCheck, MessageSquare, ArrowRight, X } from 'lucide-react';

// --- Types ---
import type { ChargingStation } from './types';

// --- Components ---
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { StationCard } from './components/station/StationCard';
import { StationModal } from './components/station/StationModal';
import { ReportModal } from './components/station/ReportModal';
import { ChargingFlowModal } from './components/station/ChargingFlowModal';
import { ReviewModal } from './components/station/ReviewModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { RewardToast } from './components/reward/RewardToast';
import { NotificationOverlay } from './components/reward/NotificationOverlay';
import { PillFilter } from './components/station/PillFilter';

// --- Stores & Hooks ---
import { useStationStore } from './store/stationStore';
import { useUserStore } from './store/userStore';
import { useMileage } from './hooks/useMileage';
import { useNotificationStore } from './store/notificationStore';

function App() {
  const { user, fetchUser, pendingReviewStation, setPendingReview } = useUserStore();
  const { stations, getFilteredStations, fetchStations, isLoading: isStationsLoading } = useStationStore();
  const { rewardToast, isCounting, triggerRewardAnimation } = useMileage();
  const { addNotification } = useNotificationStore();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // --- 반응형 데이터 추출 (ID 기반) ---
  const selectedStation = useMemo(() => stations.find(s => s.station_id === selectedStationId) || null, [stations, selectedStationId]);
  const reportTarget = useMemo(() => stations.find(s => s.station_id === reportTargetId) || null, [stations, reportTargetId]);
  const chargingTarget = useMemo(() => stations.find(s => s.station_id === chargingTargetId) || null, [stations, chargingTargetId]);

  // --- 서버 데이터 초기화 ---
  useEffect(() => {
    fetchUser();
    fetchStations();
  }, [fetchUser, fetchStations]);

  // 전역 윈도우 객체에 모달 오픈 함수 등록
  (window as any).openReportModal = (s: ChargingStation) => setReportTargetId(s.station_id);

  const handleStartChargingFlow = () => {
    const targetId = selectedStationId;
    setSelectedStationId(null);
    setChargingTargetId(targetId);
  };

  const handleChargingComplete = async (amount: number) => {
    const finishedStationId = chargingTargetId;
    if (!finishedStationId) return;

    setChargingTargetId(null);
    
    const { completeCharging } = useUserStore.getState();
    const success = await completeCharging(finishedStationId);

    if (success) {
      triggerRewardAnimation(amount, "충전 및 에코 서약 보상");
      fetchStations();
      
      // [사용자 아이디어 반영] 즉시 리뷰 대신 알림 제공 및 대기 상태 전환
      const targetStation = stations.find(s => s.station_id === finishedStationId);
      if (targetStation) {
        setPendingReview(targetStation);
        addNotification({
          role: 'USER',
          type: 'SUCCESS',
          title: '충전 보상 적립 완료! ⚡',
          message: '리뷰를 작성하시면 100P 보너스를 더 드려요!'
        });
      }
    } else {
      alert('보상 지급 중 오류가 발생했습니다.');
    }
  };

  const filteredStations = getFilteredStations();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      
      <StationModal station={selectedStation} onClose={() => setSelectedStationId(null)} onStartCharging={handleStartChargingFlow} />
      <ReportModal station={reportTarget} onClose={() => setReportTargetId(null)} />
      <ChargingFlowModal station={chargingTarget} onClose={() => setChargingTargetId(null)} onComplete={handleChargingComplete} />
      
      {/* [수리] 리뷰 모달: 사용자가 배너의 버튼을 눌렀을 때만(isReviewModalOpen) 노출됩니다. */}
      {isReviewModalOpen && (
        <ReviewModal 
          station={pendingReviewStation} 
          onClose={() => {
            setIsReviewModalOpen(false);
            setPendingReview(null); 
          }} 
        />
      )}

      <Header isAdmin={isAdminMode} onToggleAdmin={() => setIsAdminMode(!isAdminMode)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {isAdminMode ? (
          <AdminDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              {/* 유저 프로필 카드 */}
              <div className={`bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden transition-all duration-300 ${isCounting ? 'scale-105 ring-4 ring-blue-300' : ''}`}>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-blue-100 text-sm font-medium italic">{user?.level || '로딩 중...'}</p>
                    <Coins size={24} className="opacity-80" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black leading-none">{(user?.mileage_balance || 0).toLocaleString()}</span>
                    <span className="text-xl font-medium opacity-80">P</span>
                  </div>
                  
                  <div className="mt-6 flex items-center justify-between bg-black/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className={user?.trust_score && user.trust_score >= 90 ? 'text-green-400' : 'text-orange-400'} />
                      <span className="text-xs font-bold text-blue-50">내 커뮤니티 신뢰도</span>
                    </div>
                    <span className="text-sm font-black text-white">{user?.trust_score || 100}점</span>
                  </div>
                  
                  <button className="mt-4 w-full bg-white text-blue-600 py-3 rounded-2xl text-sm font-bold shadow-lg active:scale-95 transition-transform">마일리지 사용하기</button>
                </div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </div>

              {/* [신규] 비동기 리뷰 작성 유도 배너 (사용자 아이디어 반영) */}
              {pendingReviewStation && (
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-purple-100 animate-in slide-in-from-left duration-500 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 text-purple-100">
                      <MessageSquare size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Pending Reward</span>
                    </div>
                    <h4 className="font-bold text-sm leading-tight mb-4">
                      방금 이용하신 <br/>
                      <span className="text-lg font-black text-yellow-300">{pendingReviewStation.station_name}</span><br/>
                      리뷰를 남기고 100P 받아가세요!
                    </h4>
                    <button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="flex items-center gap-2 bg-white text-purple-600 px-4 py-2 rounded-xl text-xs font-black group-hover:gap-3 transition-all"
                    >
                      지금 바로 작성하기 <ArrowRight size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setPendingReview(null)}
                    className="absolute top-4 right-4 p-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                </div>
              )}
              
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Search size={18} className="text-blue-500" />최근 활동 내역</h3>
                <div className="space-y-4">
                  {user?.mileage_logs?.map((log) => (
                    <div key={log.log_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                      <div>
                        <p className="text-sm font-bold text-gray-700">{log.description}</p>
                        <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-sm font-bold ${log.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()} P
                      </span>
                    </div>
                  ))}
                  {(!user?.mileage_logs || user.mileage_logs.length === 0) && (
                    <p className="text-center py-4 text-gray-400 text-xs italic">활동 내역이 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-64 md:h-80 relative group">
                <div className="absolute inset-0 bg-blue-50 flex items-center justify-center text-blue-400 font-medium italic tracking-wide uppercase">
                  {isStationsLoading ? 'LOADING STATIONS...' : 'MAP INTERFACE READY'}
                </div>
                <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg flex items-center justify-between">
                  <div className="flex items-center gap-3"><MapPin className="text-red-500" /><span className="text-sm font-bold">강남구 역삼동 주변</span></div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="px-1">
                  <h3 className="text-xl font-bold text-gray-800 tracking-tight mb-4">맞춤형 충전소 탐색</h3>
                  <PillFilter />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStations.map((station) => (
                    <StationCard key={station.station_id} station={station} onClick={(s) => setSelectedStationId(s.station_id)} />
                  ))}
                  {!isStationsLoading && filteredStations.length === 0 && (
                    <div className="col-span-full py-20 text-center space-y-3 text-gray-400 font-medium">
                      <Search size={48} className="mx-auto text-gray-300 mb-3" />
                      조건에 맞는 충전소가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <MobileNav />
    </div>
  );
}

export default App;
