import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, Coins, Search } from 'lucide-react';

// --- Types & Mock Data ---
import { ChargingStation } from './types';

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

function App() {
  const { user, fetchUser } = useUserStore();
  const { stations, getFilteredStations, fetchStations, isLoading: isStationsLoading } = useStationStore();
  const { points, rewardToast, isCounting, triggerRewardAnimation } = useMileage();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);

  // --- 반응형 데이터 추출 (ID를 기반으로 항상 최신 데이터를 store에서 가져옴) ---
  const selectedStation = useMemo(() => stations.find(s => s.id === selectedStationId) || null, [stations, selectedStationId]);
  const reportTarget = useMemo(() => stations.find(s => s.id === reportTargetId) || null, [stations, reportTargetId]);
  const chargingTarget = useMemo(() => stations.find(s => s.id === chargingTargetId) || null, [stations, chargingTargetId]);
  const reviewTarget = useMemo(() => stations.find(s => s.id === reviewTargetId) || null, [stations, reviewTargetId]);

  // --- 서버 데이터 초기화 ---
  useEffect(() => {
    fetchUser();
    fetchStations();
  }, [fetchUser, fetchStations]);

  (window as any).openReportModal = (s: ChargingStation) => setReportTargetId(s.id);

  const handleStartChargingFlow = () => {
    const targetId = selectedStationId;
    setSelectedStationId(null);
    setChargingTargetId(targetId);
  };

  const handleChargingComplete = (amount: number) => {
    const finishedStationId = chargingTargetId;
    setChargingTargetId(null);
    
    // triggerRewardAnimation이 내부적으로 포인트 가산 및 로그 기록을 수행함 (중복 방지)
    triggerRewardAnimation(amount, "충전 및 에코 서약 보상");
    
    // 충전 완료 후 1.5초 뒤에 리뷰 모달 띄우기
    setTimeout(() => {
      setReviewTargetId(finishedStationId);
    }, 1500);
  };

  const filteredStations = getFilteredStations();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      
      <StationModal station={selectedStation} onClose={() => setSelectedStationId(null)} onStartCharging={handleStartChargingFlow} />
      <ReportModal station={reportTarget} onClose={() => setReportTargetId(null)} />
      <ChargingFlowModal station={chargingTarget} onClose={() => setChargingTargetId(null)} onComplete={handleChargingComplete} />
      <ReviewModal station={reviewTarget} onClose={() => setReviewTargetId(null)} />

      <Header isAdmin={isAdminMode} onToggleAdmin={() => setIsAdminMode(!isAdminMode)} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {isAdminMode ? (
          <AdminDashboard />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className={`bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden transition-all duration-300 ${isCounting ? 'scale-105 ring-4 ring-blue-300' : ''}`}>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4"><p className="text-blue-100 text-sm font-medium italic">{user.level}</p><Coins size={24} className="opacity-80" /></div>
                  <div className="flex items-baseline gap-2"><span className="text-4xl font-black leading-none">{points.toLocaleString()}</span><span className="text-xl font-medium opacity-80">P</span></div>
                  <button className="mt-8 w-full bg-white text-blue-600 py-3 rounded-2xl text-sm font-bold shadow-lg">마일리지 사용하기</button>
                </div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Search size={18} className="text-blue-500" />최근 활동 내역</h3>
                <div className="space-y-4">
                  {user.recentActivity?.map((act) => (
                    <div key={act.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                      <div><p className="text-sm font-bold text-gray-700">{act.type}</p><p className="text-xs text-gray-400">{act.date}</p></div>
                      <span className="text-sm font-bold text-blue-600">{act.amount}</span>
                    </div>
                  ))}
                  {(!user.recentActivity || user.recentActivity.length === 0) && (
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
                <div className="px-1"><h3 className="text-xl font-bold text-gray-800 tracking-tight mb-4">맞춤형 충전소 탐색</h3><PillFilter /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStations.map((station) => (
                    <StationCard key={station.id} station={station} onClick={(s) => setSelectedStationId(s.id)} />
                  ))}
                  {!isStationsLoading && filteredStations.length === 0 && <div className="col-span-full py-20 text-center space-y-3 text-gray-400 font-medium"><Search size={48} className="mx-auto text-gray-300 mb-3" />조건에 맞는 충전소가 없습니다.</div>}
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
