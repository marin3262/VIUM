import { useState, useEffect, useMemo } from 'react';
import { MapPin, Coins, Search, ShieldCheck, MessageSquare, ArrowRight, X, Maximize2, Minimize2, Plus } from 'lucide-react';

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
import { StationMap } from './components/station/StationMap';

// --- Stores & Hooks ---
import { useStationStore } from './store/stationStore';
import { useUserStore } from './store/userStore';
import { useMileage } from './hooks/useMileage';
import { useNotificationStore } from './store/notificationStore';

function App() {
  const { user, fetchUser, pendingReviewStation, setPendingReview } = useUserStore();
  const { stations = [], getFilteredStations, fetchStations, isLoading: isStationsLoading } = useStationStore();
  const { rewardToast, isCounting, triggerRewardAnimation } = useMileage();
  const { addNotification } = useNotificationStore();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  
  const [visibleCount, setVisibleCount] = useState(6);

  // --- 반응형 데이터 추출 ---
  const selectedStation = useMemo(() => 
    selectedStationId ? (stations.find(s => s.station_id === selectedStationId) || null) : null, 
  [stations, selectedStationId]);

  const reportTarget = useMemo(() => 
    reportTargetId ? (stations.find(s => s.station_id === reportTargetId) || null) : null, 
  [stations, reportTargetId]);

  const chargingTarget = useMemo(() => 
    chargingTargetId ? (stations.find(s => s.station_id === chargingTargetId) || null) : null, 
  [stations, chargingTargetId]);

  // --- 서버 데이터 Polling ---
  useEffect(() => {
    fetchUser();
    fetchStations();
    const interval = setInterval(() => {
      fetchStations();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchUser, fetchStations]);

  // 전역 브릿지 함수 (ID 기반으로 변경하여 안정성 확보)
  useEffect(() => {
    (window as any).openStationDetail = (stationId: string) => {
      if (stationId) setSelectedStationId(stationId);
    };
    (window as any).openReportModal = (stationId: string) => {
      if (stationId) {
        setSelectedStationId(null);
        setReportTargetId(stationId);
      }
    };
    return () => {
      delete (window as any).openStationDetail;
      delete (window as any).openReportModal;
    };
  }, []);

  const handleStartChargingFlow = () => {
    if (selectedStationId) {
      const targetId = selectedStationId;
      setSelectedStationId(null);
      setChargingTargetId(targetId);
    }
  };

  const handleChargingComplete = async (amount: number) => {
    const finishedStationId = chargingTargetId;
    if (!finishedStationId) return;
    setChargingTargetId(null);
    const { completeCharging } = useUserStore.getState();
    const success = await completeCharging(finishedStationId);
    if (success) {
      triggerRewardAnimation(amount, "충전 완료 보상");
      fetchStations();
    }
  };

  const filteredStations = getFilteredStations() || [];
  const pagedStations = useMemo(() => filteredStations.slice(0, visibleCount), [filteredStations, visibleCount]);
  const hasMore = filteredStations.length > visibleCount;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      
      {selectedStation && (
        <StationModal station={selectedStation} onClose={() => setSelectedStationId(null)} onStartCharging={handleStartChargingFlow} />
      )}
      {reportTarget && (
        <ReportModal station={reportTarget} onClose={() => setReportTargetId(null)} />
      )}
      {chargingTarget && (
        <ChargingFlowModal station={chargingTarget} onClose={() => setChargingTargetId(null)} onComplete={handleChargingComplete} />
      )}
      
      {isReviewModalOpen && pendingReviewStation && (
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
          <div className="flex flex-col gap-8">
            <div className={`grid grid-cols-1 ${isMapExpanded ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-8 transition-all duration-500`}>
              
              <div className="lg:col-span-1 space-y-6">
                <div className={`bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden transition-all duration-300 ${isCounting ? 'scale-105 ring-4 ring-blue-300' : ''}`}>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <p className="text-blue-100 text-sm font-medium italic">{user?.level || '에코 드라이버'}</p>
                      <Coins size={24} className="opacity-80" />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-black leading-none">{(user?.mileage_balance || 0).toLocaleString()}</span>
                      <span className="text-xl font-medium opacity-80">P</span>
                    </div>
                    <div className="mt-6 flex items-center justify-between bg-black/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-green-400" />
                        <span className="text-xs font-bold text-blue-50">커뮤니티 신뢰도</span>
                      </div>
                      <span className="text-sm font-black text-white">{user?.trust_score || 100}점</span>
                    </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="hidden lg:block bg-white rounded-3xl p-6 border border-gray-100 shadow-sm h-[320px] overflow-y-auto no-scrollbar">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm"><Search size={16} className="text-blue-500" />최근 활동</h3>
                  <div className="space-y-4">
                    {user?.mileage_logs?.map((log) => (
                      <div key={log.log_id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                        <div>
                          <p className="text-xs font-bold text-gray-700 leading-tight">{log.description}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(log.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-xs font-black ${log.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${isMapExpanded ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6 transition-all duration-500`}>
                <div className={`bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden relative group z-0 transition-all duration-500 ${isMapExpanded ? 'h-[600px]' : 'h-64 md:h-80'}`}>
                  <div className="absolute inset-0 z-0">
                    <StationMap 
                      stations={filteredStations} 
                      onMarkerClick={(s) => setSelectedStationId(s.station_id)} 
                      isLoading={isStationsLoading} 
                    />
                  </div>
                  
                  <div className="absolute top-4 left-4 z-10">
                    <button 
                      onClick={() => setIsMapExpanded(!isMapExpanded)}
                      className="bg-white/95 backdrop-blur shadow-2xl border border-gray-200 p-3 rounded-2xl text-gray-700 hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-2 group/btn"
                    >
                      {isMapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      <span className="text-[10px] font-black uppercase tracking-wider hidden group-hover/btn:block">{isMapExpanded ? '기본 크기' : '지도 크게보기'}</span>
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg flex items-center justify-between z-10 pointer-events-none border border-white/50">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 p-2 rounded-xl text-red-600">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">Current Monitoring Area</span>
                        <p className="text-sm font-black text-gray-800">양주시 행정구역 전역</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col items-start gap-6 px-8 py-8 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="text-left">
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">충전소 탐색</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Yangju Real-time Network ({filteredStations.length})</p>
                      </div>
                    </div>
                    <div className="w-full">
                      <PillFilter />
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 ${isMapExpanded ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 transition-all duration-500`}>
                    {pagedStations.map((station) => (
                      <StationCard key={station.station_id} station={station} onClick={(s) => setSelectedStationId(s.station_id)} />
                    ))}
                    {!isStationsLoading && filteredStations.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-3 text-gray-400 font-medium bg-white rounded-[40px] border-2 border-dashed border-gray-100">
                        <Search size={48} className="mx-auto text-gray-200 mb-3" />
                        조건에 맞는 충전소가 없습니다.
                      </div>
                    )}
                  </div>

                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <button 
                        onClick={() => setVisibleCount(prev => prev + 12)}
                        className="flex items-center gap-2 bg-white border-2 border-gray-100 px-8 py-4 rounded-3xl text-sm font-black text-gray-600 hover:bg-gray-50 hover:border-blue-200 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                      >
                        <Plus size={18} /> 충전소 더보기 ({filteredStations.length - visibleCount})
                      </button>
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
