import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapPin, Coins, Search, ShieldCheck, ArrowRight, Maximize2, Minimize2, Plus, Star, User as UserIcon } from 'lucide-react';

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
import { MyPage } from './components/user/MyPage';
import { RewardToast } from './components/reward/RewardToast';
import { NotificationOverlay } from './components/reward/NotificationOverlay';
import { PillFilter } from './components/station/PillFilter';
import { StationMap } from './components/station/StationMap';
import { StationSummaryOverlay } from './components/station/StationSummaryOverlay';
import { AuthModal } from './components/layout/AuthModal';

// --- Stores & Hooks ---
import { useStationStore } from './store/stationStore';
import { useUserStore } from './store/userStore';
import { useMileage } from './hooks/useMileage';
import { useNotificationStore } from './store/notificationStore';

function App() {
  const { user, fetchUser, pendingReviewStation, setPendingReview, isAuthenticated, token } = useUserStore();
  const { 
    stations = [], 
    getFilteredStations, 
    fetchStations, 
    isLoading: isStationsLoading,
    activeFilter,
    selectedConnector,
    onlyAvailable,
    searchQuery,
    routeSummary // 길찾기 상태 추가
  } = useStationStore();
  const { rewardToast, isCounting, triggerRewardAnimation } = useMileage();
  const { addNotification } = useNotificationStore();

  const mapSectionRef = useRef<HTMLDivElement>(null); // 지도 영역 참조 추가
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [summaryStationId, setSummaryStationId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(!localStorage.getItem('vium_token')); // 토큰이 없으면(비회원 예상) 확장 상태로 시작
  
  const [visibleCount, setVisibleCount] = useState(6);

  // --- 화면 스크롤 핸들러 ---
  const scrollToMap = useCallback(() => {
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  // --- 반응형 데이터 추출 (메모이제이션 강화) ---
  const filteredStations = useMemo(() => getFilteredStations() || [], [stations, activeFilter, selectedConnector, onlyAvailable, searchQuery, getFilteredStations]);
  
  const selectedStation = useMemo(() => 
    selectedStationId ? (stations.find(s => s.station_id === selectedStationId) || null) : null, 
  [stations, selectedStationId]);

  const summaryStation = useMemo(() => 
    summaryStationId ? (stations.find(s => s.station_id === summaryStationId) || null) : null, 
  [stations, summaryStationId]);

  const reportTarget = useMemo(() => 
    reportTargetId ? (stations.find(s => s.station_id === reportTargetId) || null) : null, 
  [stations, reportTargetId]);

  const chargingTarget = useMemo(() => 
    chargingTargetId ? (stations.find(s => s.station_id === chargingTargetId) || null) : null, 
  [stations, chargingTargetId]);

  // --- 핸들러 메모이제이션 ---
  const handleMarkerClick = useCallback((s: ChargingStation) => {
    setSelectedStationId(null);
    setSummaryStationId(s.station_id);
  }, []);

  const handleMapClick = useCallback(() => {
    setSummaryStationId(null);
  }, []);

  const handleStationCardClick = useCallback((s: ChargingStation) => {
    setSelectedStationId(s.station_id);
  }, []);

  // --- 서버 데이터 로드 ---
  useEffect(() => {
    fetchUser();
    fetchStations();
    const interval = setInterval(() => {
      fetchStations();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchUser, fetchStations, token]);

  // --- 하드웨어 자동 충전 감지 브릿지 로직 ---
  const [prevStations, setPrevStations] = useState<ChargingStation[]>([]);
  useEffect(() => {
    if (prevStations.length > 0 && stations.length > 0) {
      let newConnectionStationId: string | null = null;
      for (const station of stations) {
        const prevStation = prevStations.find(s => s.station_id === station.station_id);
        if (prevStation) {
          for (const charger of station.chargers) {
            const prevCharger = prevStation.chargers.find(c => c.charger_id === charger.charger_id);
            if (prevCharger && prevCharger.status !== 'Charging' && charger.status === 'Charging') {
              newConnectionStationId = station.station_id;
              break;
            }
          }
        }
        if (newConnectionStationId) break;
      }
      
      if (newConnectionStationId) {
        setChargingTargetId(prev => {
          if (!prev) {
            console.log(`🔌 [IoT] Auto-detected connection. Starting flow for: ${newConnectionStationId}`);
            return newConnectionStationId;
          }
          return prev;
        });
      }
    }
    setPrevStations(stations);
  }, [stations]);

  // 전역 브릿지 함수
  useEffect(() => {
    (window as any).openStationDetail = (stationId: string) => {
      if (stationId) setSelectedStationId(stationId);
    };
    (window as any).openReportModal = (stationId: string) => {
      if (!isAuthenticated) {
        addNotification({
          role: 'USER',
          type: 'WARNING',
          title: '회원 전용 기능 🔐',
          message: '허위 제보 방지를 위해 고장 제보는 로그인한 회원만 가능합니다.'
        });
        setIsAuthModalOpen(true);
        return;
      }
      if (stationId) {
        setSelectedStationId(null);
        setReportTargetId(stationId);
      }
    };
    return () => {
      delete (window as any).openStationDetail;
      delete (window as any).openReportModal;
    };
  }, [isAuthenticated, addNotification]);

  const handleShowOnMap = () => {
    if (selectedStationId) {
      const id = selectedStationId;
      setSelectedStationId(null);
      setSummaryStationId(id);
      setIsMapExpanded(true);
      
      // 화면 이동 및 지도 포커스 연출
      scrollToMap();
      
      setTimeout(() => {
        if (window.focusStationOnMap) {
          window.focusStationOnMap(id);
        }
      }, 400); 
    }
  };

  const handleChargingComplete = async (amount: number) => {
    const finishedStationId = chargingTargetId;
    if (!finishedStationId) return;

    const finishedStation = stations.find(s => s.station_id === finishedStationId);
    setChargingTargetId(null);

    if (!isAuthenticated) {
      addNotification({
        role: 'USER',
        type: 'INFO',
        title: '포인트 적립 안내 🎁',
        message: '로그인하시면 방금 완료하신 충전 보상을 받으실 수 있습니다!'
      });
      return;
    }

    const success = await useUserStore.getState().completeCharging(finishedStationId);
    if (success) {
      triggerRewardAnimation(amount);
      if (finishedStation) {
        setPendingReview(finishedStation);
      }
      fetchStations();
    }
  };

  const pagedStations = useMemo(() => filteredStations.slice(0, visibleCount), [filteredStations, visibleCount]);
  const hasMore = filteredStations.length > visibleCount;

  // 관리자 모드 진입 보안 가드
  useEffect(() => {
    if (isAdminMode && (!user || !user.is_admin)) {
      setIsAdminMode(false);
      addNotification({
        role: 'USER',
        type: 'ERROR',
        title: '접근 차단 🚫',
        message: '관리자 권한이 없습니다.'
      });
    }
  }, [isAdminMode, user, addNotification]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isMyPageOpen && <MyPage onClose={() => setIsMyPageOpen(false)} />}
      
      {selectedStation && (
        <StationModal 
          station={selectedStation} 
          onClose={() => setSelectedStationId(null)} 
          onShowOnMap={handleShowOnMap}
        />
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

      <Header 
        isAdmin={isAdminMode} 
        onToggleAdmin={() => setIsAdminMode(!isAdminMode)} 
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenMyPage={() => setIsMyPageOpen(true)}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {isAdminMode && user?.is_admin ? (
          <AdminDashboard />
        ) : (
          <div className="flex flex-col gap-8">
            <div className="transition-all duration-500">
              
              {/* Main Content Area (Full Width for everyone) */}
              <div className="space-y-6">
                <div 
                  ref={mapSectionRef}
                  className={`bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden relative group z-0 transition-[height,width] duration-500 ease-in-out ${isMapExpanded ? 'h-[600px]' : 'h-64 md:h-80'}`} 
                  style={{ willChange: 'height, width' }}
                >
                  <div className="absolute inset-0 z-0">
                    <StationMap 
                      stations={filteredStations} 
                      onMarkerClick={handleMarkerClick}
                      onMapClick={handleMapClick}
                      isLoading={isStationsLoading} 
                    />
                  </div>
                  
                  {summaryStation && (
                    <StationSummaryOverlay 
                      station={summaryStation} 
                      onClose={() => setSummaryStationId(null)}
                      onViewDetail={() => {
                        setSummaryStationId(null);
                        setSelectedStationId(summaryStation.station_id);
                      }}
                    />
                  )}
                  
                  <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                    <button 
                      onClick={() => setIsMapExpanded(!isMapExpanded)}
                      className="bg-white/95 backdrop-blur shadow-2xl border border-gray-200 p-3 rounded-2xl text-gray-700 hover:bg-gray-50 transition-all active:scale-95 flex items-center gap-2 group/btn"
                    >
                      {isMapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      <span className="text-[10px] font-black uppercase tracking-wider hidden group-hover/btn:block">{isMapExpanded ? '기본 크기' : '지도 크게보기'}</span>
                    </button>
                  </div>

                  {/* Guest Login Banner */}
                  {!isAuthenticated && (
                    <div className={`absolute left-1/2 -translate-x-1/2 z-10 transition-all duration-700 ease-in-out ${
                      routeSummary 
                        ? 'top-6 w-auto max-w-[90%]' 
                        : 'bottom-6 w-full max-w-sm px-4'
                    } animate-in slide-in-from-bottom-5`}>
                      <button 
                        onClick={() => setIsAuthModalOpen(true)}
                        className={`bg-gray-900/90 backdrop-blur-xl text-white rounded-[32px] shadow-2xl border border-white/10 flex items-center justify-between group hover:bg-black transition-all whitespace-pre-line ${
                          routeSummary ? 'px-5 py-3 rounded-full' : 'p-6'
                        }`}
                      >
                        <div className="text-left flex items-center gap-3">
                          <p className={`font-black leading-tight italic break-keep ${routeSummary ? 'text-xs' : 'text-sm'}`}>
                            {routeSummary ? '가입하고 마일리지 받기 ✨' : '지금 가입하고\n첫 마일리지를 받으세요! 🎉'}
                          </p>
                          {!routeSummary && (
                            <p className="text-[10px] text-gray-400 mt-1 font-bold break-keep">회원가입 즉시 1,000P 지급 및 실시간 충전 연동</p>
                          )}
                        </div>
                        <div className={`${routeSummary ? 'ml-3' : 'bg-blue-600 p-3 rounded-2xl group-hover:scale-110'} transition-transform`}>
                          <ArrowRight size={routeSummary ? 14 : 20} />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Member Review Quest Banner (Relocated) */}
                  {isAuthenticated && pendingReviewStation && (
                    <div className={`absolute left-1/2 -translate-x-1/2 z-10 transition-all duration-700 ease-in-out ${
                      routeSummary 
                        ? 'top-6 w-auto max-w-[90%]' 
                        : 'bottom-6 w-full max-w-sm px-4'
                    } animate-in slide-in-from-bottom-5`}>
                      <button 
                        onClick={() => setIsReviewModalOpen(true)}
                        className={`bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-2xl border border-white/10 flex items-center justify-between group hover:shadow-purple-200 transition-all active:scale-95 whitespace-pre-line ${
                          routeSummary ? 'px-5 py-3 rounded-full' : 'p-6 rounded-[32px]'
                        }`}
                      >
                        <div className="text-left flex items-center gap-3">
                          <div className={`flex items-center gap-2 ${routeSummary ? '' : 'mb-1'}`}>
                            <Star size={routeSummary ? 12 : 14} className="text-yellow-300 fill-yellow-300" />
                            {!routeSummary && <span className="bg-black/20 px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest uppercase">Special Quest</span>}
                          </div>
                          <p className={`font-black leading-tight italic break-keep ${routeSummary ? 'text-xs' : 'text-sm'}`}>
                            {routeSummary ? '리뷰 퀘스트 진행 중 🎁' : `방금 충전한\n${pendingReviewStation.station_name}은 어떠셨나요?`}
                          </p>
                        </div>
                        <div className={`${routeSummary ? 'ml-3' : 'bg-white/20 p-3 rounded-2xl group-hover:bg-white/30'} transition-colors`}>
                          <ArrowRight size={routeSummary ? 14 : 20} />
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg flex items-center gap-3 z-10 pointer-events-none border border-white/50">
                    <div className="bg-red-100 p-2 rounded-xl text-red-600">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase tracking-tighter">Current Area</span>
                      <p className="text-sm font-black text-gray-800">양주시 행정구역 전역</p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-all duration-500">
                    {pagedStations.map((station) => (
                      <StationCard key={station.station_id} station={station} onClick={handleStationCardClick} />
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
      <MobileNav onOpenMyPage={() => setIsMyPageOpen(true)} />
    </div>
  );
}

export default App;
