import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Maximize2, Minimize2, ArrowRight
} from 'lucide-react';

import { useStationStore } from './store/stationStore';
import { useUserStore } from './store/userStore';
import { useNotificationStore } from './store/notificationStore';
import { useMileage } from './hooks/useMileage';
import { usePushNotification } from './hooks/usePushNotification';

import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { StationCard } from './components/station/StationCard';
import { StationModal } from './components/station/StationModal';
import { StationMap } from './components/station/StationMap';
import { PillFilter } from './components/station/PillFilter';
import { ReportModal } from './components/station/ReportModal';
import { ReviewModal } from './components/station/ReviewModal';
import { AuthModal } from './components/layout/AuthModal';
import { MyPage } from './components/user/MyPage';
import { RewardToast } from './components/reward/RewardToast';
import { NotificationOverlay } from './components/reward/NotificationOverlay';
import { StationSummaryOverlay } from './components/station/StationSummaryOverlay';
import { ChargingFlowModal } from './components/station/ChargingFlowModal';
import { GuestChargePage } from './components/guest/GuestChargePage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import type { ChargingStation } from './types';

function App() {
  const store = useStationStore();
  const { 
    stations, 
    fetchStations, 
    selectedStationId,
    setSelectedStationId,
    reportTargetId,
    setReportTargetId,
    summaryStationId,
    setSummaryStationId,
    isLoading: isStationsLoading
  } = store;

  const { 
    user, 
    isAuthenticated, 
    fetchUser, 
    pendingReviewStation,
    setPendingReview 
  } = useUserStore();

  const { addNotification } = useNotificationStore();
  const { rewardToast, triggerRewardAnimation } = useMileage();
  usePushNotification();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          const { title, body, type, role, tag, session_id, user_id } = event.data.payload;
          
          // [격리 로직 강화]: 본인의 알림인지 엄격하게 확인
          const currentGuestOrderId = sessionStorage.getItem('vium_guest_active_order_id');
          
          const isMyUserNoti = user_id && user && Number(user_id) === Number(user.user_id);
          const isMyGuestNoti = session_id && currentGuestOrderId && session_id === currentGuestOrderId;

          if (isMyUserNoti || isMyGuestNoti) {
            console.log("📥 [App] Push message matched and added to store.");
            addNotification({
              id: tag, 
              role: role || 'USER',
              type: type || 'INFO',
              title: title || '⚡ VIUM 알림',
              message: body || '새로운 소식이 도착했습니다.'
            });
          } else {
            console.log("🛡️ [App] Push message ignored (Ownership mismatch).");
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [addNotification, user, isAuthenticated]);

  const [visibleCount, setVisibleCount] = useState(12);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [chargingInitialStep, setChargingInitialStep] = useState<'CONNECTION_PROMPT' | 'BILLING'>('CONNECTION_PROMPT');
  const [guestChargerId, setGuestChargerId] = useState<string | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  const selectedStation = useMemo(() => 
    selectedStationId ? stations.find(s => s.station_id === selectedStationId) : null
  , [selectedStationId, stations]);

  const reportTarget = useMemo(() => 
    reportTargetId ? stations.find(s => s.station_id === reportTargetId) : null
  , [reportTargetId, stations]);

  const summaryStation = useMemo(() => 
    summaryStationId ? stations.find(s => s.station_id === summaryStationId) : null
  , [summaryStationId, stations]);

  const filteredStations = useMemo(() => {
    return store.getFilteredStations() || [];
  }, [stations, store]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestId = params.get('guest_charger_id');
    if (guestId) setGuestChargerId(guestId);

    if (params.get('payment_success') === 'true') {
      const lastStationId = sessionStorage.getItem('vium_last_charging_id');
      if (lastStationId) {
        setChargingTargetId(lastStationId);
        setChargingInitialStep('BILLING');
      }
    }
  }, []);

  const chargingTarget = useMemo(() => 
    chargingTargetId ? stations.find(s => s.station_id === chargingTargetId) : null
  , [chargingTargetId, stations]);

  useEffect(() => {
    fetchStations();
    if (isAuthenticated) fetchUser();
    const interval = setInterval(() => fetchStations(), 3000);
    return () => clearInterval(interval);
  }, [fetchStations, fetchUser, isAuthenticated]);

  const prevStationsRef = useRef(stations);
  useEffect(() => {
    const currentGuestOrderId = sessionStorage.getItem('vium_guest_active_order_id');

    if (!chargingTargetId) {
      stations.forEach(station => {
        const prevStation = prevStationsRef.current.find(ps => ps.station_id === station.station_id);
        if (!prevStation) return;
        station.chargers.forEach(charger => {
          const prevCharger = prevStation.chargers.find(pc => pc.charger_id === charger.charger_id);
          
          if (prevCharger && prevCharger.status !== 'Charging' && charger.status === 'Charging') {
            const isMyUserCharge = isAuthenticated && user && charger.active_user_id === user.user_id;
            const isMyGuestCharge = !isAuthenticated && currentGuestOrderId && charger.active_session_id === currentGuestOrderId;

            if (isMyUserCharge || isMyGuestCharge) {
              setChargingTargetId(station.station_id);
              setChargingInitialStep('CONNECTION_PROMPT');
            }
          }
        });
      });
    }
    prevStationsRef.current = stations;
  }, [stations, isAuthenticated, user, chargingTargetId]);

  const handleStationCardClick = useCallback((station: ChargingStation) => {
    setSelectedStationId(station.station_id);
  }, [setSelectedStationId]);

  const handleMarkerClick = useCallback((station: ChargingStation) => {
    setSummaryStationId(station.station_id);
  }, [setSummaryStationId]);

  const handleMapClick = useCallback(() => {
    setSummaryStationId(null);
  }, [setSummaryStationId]);

  const handleShowOnMap = (id: string) => {
    setSelectedStationId(null);
    setSummaryStationId(id); 
    setIsMapExpanded(true);
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        if (window.focusStationOnMap) window.focusStationOnMap(id);
      }, 400); 
    }
  };

  useEffect(() => {
    (window as any).openReportModal = (id: string) => setReportTargetId(id);
    (window as any).openAuthModal = () => setIsAuthModalOpen(true);
    return () => { 
      delete (window as any).openReportModal;
      delete (window as any).openAuthModal;
    };
  }, [setReportTargetId]);

  const handleChargingComplete = async (amount: number) => {
    const finishedStationId = chargingTargetId;
    if (!finishedStationId) return;
    const finishedStation = stations.find(s => s.station_id === finishedStationId);
    setChargingTargetId(null);
    setChargingInitialStep('CONNECTION_PROMPT');
    if (!isAuthenticated) return;
    const success = await useUserStore.getState().completeCharging(finishedStationId, amount);
    if (success) {
      triggerRewardAnimation(amount);
      if (finishedStation) setPendingReview(finishedStation);
      fetchStations();
    }
  };

  const pagedStations = useMemo(() => {
    return filteredStations.slice(0, visibleCount);
  }, [filteredStations, visibleCount]);

  const hasMore = filteredStations.length > visibleCount;

  useEffect(() => {
    if (isAdminMode && (!user || !user.is_admin)) {
      setIsAdminMode(false);
    }
  }, [isAdminMode, user]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isMyPageOpen && <MyPage onClose={() => setIsMyPageOpen(false)} />}
      
      {guestChargerId ? (
        <GuestChargePage chargerId={guestChargerId} />
      ) : (
        <>
          {selectedStation && (
            <StationModal 
              station={selectedStation} 
              onClose={() => setSelectedStationId(null)} 
              onShowOnMap={() => handleShowOnMap(selectedStation.station_id)}
              onReport={() => setReportTargetId(selectedStation.station_id)}
            />
          )}
          {reportTarget && <ReportModal station={reportTarget} onClose={() => setReportTargetId(null)} />}
          {chargingTarget && (
            <ChargingFlowModal 
              station={chargingTarget} 
              onClose={() => { setChargingTargetId(null); setChargingInitialStep('CONNECTION_PROMPT'); }} 
              onComplete={handleChargingComplete} 
              initialStep={chargingInitialStep} 
            />
          )}
          {isReviewModalOpen && pendingReviewStation && (
            <ReviewModal 
              station={pendingReviewStation} 
              onClose={() => { setIsReviewModalOpen(false); setPendingReview(null); }} 
            />
          )}
          
          <Header 
            isAdmin={isAdminMode} 
            onToggleAdmin={() => setIsAdminMode(!isAdminMode)} 
            onOpenAuth={() => setIsAuthModalOpen(true)} 
            onOpenMyPage={() => setIsMyPageOpen(true)} 
          />
          
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            {isAdminMode && user?.is_admin ? <AdminDashboard /> : (
              <div className="flex flex-col gap-8">
                <div className="space-y-6">
                  <div ref={mapSectionRef} className={`bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden relative z-0 transition-all duration-500 ${isMapExpanded ? 'h-[600px]' : 'h-64 md:h-80'}`}>
                    <div className="absolute inset-0 z-0"><StationMap stations={filteredStations} onMarkerClick={handleMarkerClick} onMapClick={handleMapClick} isLoading={isStationsLoading} /></div>
                    {summaryStation && <StationSummaryOverlay station={summaryStation} onClose={() => setSummaryStationId(null)} onViewDetail={() => { setSummaryStationId(null); setSelectedStationId(summaryStation.station_id); }} />}
                    <div className="absolute top-4 left-4 z-10"><button onClick={() => setIsMapExpanded(!isMapExpanded)} className="bg-white/95 backdrop-blur shadow-2xl border border-gray-200 p-3 rounded-2xl text-gray-700 hover:bg-gray-50 flex items-center gap-2">{isMapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div>
                    {!isAuthenticated && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-10">
                        <button onClick={() => setIsAuthModalOpen(true)} className="bg-gray-900/90 backdrop-blur-xl text-white rounded-[32px] p-6 shadow-2xl w-full flex items-center justify-between group hover:bg-black transition-all">
                          <div className="text-left"><p className="font-black text-sm">지금 가입하고 마일리지 받기 🎉</p><p className="text-[10px] text-gray-400 mt-1 font-bold">1,000P 지급 및 실시간 충전 연동</p></div>
                          <div className="bg-blue-600 p-3 rounded-2xl group-hover:scale-110 transition-transform"><ArrowRight size={20} /></div>
                        </button>
                      </div>
                    )}
                    {isAuthenticated && pendingReviewStation && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-10">
                        <button onClick={() => setIsReviewModalOpen(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-[32px] p-6 shadow-2xl w-full flex items-center justify-between group transition-all">
                          <div className="text-left"><p className="font-black text-sm italic">리뷰 퀘스트 진행 중 🎁</p><p className="text-[10px] text-white/70 mt-1 font-bold">{pendingReviewStation.station_name} 리뷰 남기기</p></div>
                          <div className="bg-white/20 p-3 rounded-2xl"><ArrowRight size={20} /></div>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="flex flex-col items-start gap-6 px-8 py-8 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                      <div><h3 className="text-2xl font-black text-gray-900 tracking-tight">충전소 탐색</h3><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Yangju Network ({filteredStations.length})</p></div>
                      <div className="w-full"><PillFilter /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{pagedStations.map((station) => (<StationCard key={station.station_id} station={station} onClick={handleStationCardClick} />))}</div>
                    {hasMore && (<div className="flex justify-center pt-4"><button onClick={() => setVisibleCount(prev => prev + 12)} className="bg-white border-2 border-gray-100 px-8 py-4 rounded-3xl text-sm font-black text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">더보기</button></div>)}
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}
      <MobileNav onOpenMyPage={() => setIsMyPageOpen(true)} />
    </div>
  );
}

export default App;
