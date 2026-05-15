import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Coins, Search, ShieldCheck, ArrowRight, Maximize2, Minimize2, Plus, Star } from 'lucide-react';

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
    searchQuery
  } = useStationStore();
  const { rewardToast, isCounting, triggerRewardAnimation } = useMileage();
  const { addNotification } = useNotificationStore();

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [summaryStationId, setSummaryStationId] = useState<string | null>(null);
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  
  const [visibleCount, setVisibleCount] = useState(6);

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

  // --- 핸들러 메모이제이션 (지도 컴포넌트 최적화용) ---
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

  // --- 서버 데이터 로드 (게스트/회원 공통) ---
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
      
      // 하드웨어 연결이 감지되면 자동으로 충전 플로우 모달을 띄웁니다.
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

  // 전역 브릿지 함수 고도화
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
      triggerRewardAnimation(amount, "충전 완료 보상");
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
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {isAdminMode && user?.is_admin ? (
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

                {pendingReviewStation && (
                  <button 
                    onClick={() => {
                      if (isAuthenticated) {
                        setIsReviewModalOpen(true);
                      } else {
                        addNotification({
                          role: 'USER',
                          type: 'INFO',
                          title: '로그인이 필요합니다 🔐',
                          message: '리뷰를 남기고 포인트를 받으시려면 먼저 로그인해 주세요.'
                        });
                        setIsAuthModalOpen(true);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-purple-100 flex flex-col gap-4 group transition-all active:scale-95 animate-in slide-in-from-left-5 duration-500"
                  >
                    <div className="flex justify-between items-start">
                      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <Star size={20} className="text-yellow-300 fill-yellow-300" />
                      </div>
                      <div className="bg-black/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">Special Quest</div>
                    </div>
                    <div className="text-left">
                      <h4 className="font-black text-sm leading-tight italic">방금 이용하신 충전소는 어떠셨나요?</h4>
                      <p className="text-[11px] text-purple-100 mt-1 font-medium">{pendingReviewStation.station_name} 리뷰 남기고 100P 받기</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black bg-white/10 w-fit px-4 py-2 rounded-xl group-hover:bg-white/20 transition-colors">
                      리뷰 작성하기 <ArrowRight size={12} />
                    </div>
                  </button>
                )}

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
                    {!user?.mileage_logs?.length && (
                      <div className="text-center py-10 text-gray-400 text-xs">활동 내역이 없습니다.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`${isMapExpanded ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-6 transition-all duration-500`}>
                <div className={`bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden relative group z-0 transition-[height,width] duration-500 ease-in-out ${isMapExpanded ? 'h-[600px]' : 'h-64 md:h-80'}`} style={{ willChange: 'height, width' }}>
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
      <MobileNav />
    </div>
  );
}

export default App;
