import React, { useState, useEffect } from 'react';
import { MapPin, Zap, Coins, User, Bell, Search, ChevronRight, Filter, X, Star, Clock, MessageSquare, CheckCircle2, Loader2 } from 'lucide-react';
import { MOCK_STATIONS, MOCK_USER, ChargingStation } from './mockData';

function App() {
  const [stations] = useState<ChargingStation[]>(MOCK_STATIONS);
  
  // --- 상태 관리 ---
  const [points, setPoints] = useState(MOCK_USER.points); // 실시간 마일리지 점수
  const [activeFilter, setActiveFilter] = useState<'All' | 'Rapid' | 'Standard'>('All');
  const [selectedStation, setSelectedStation] = useState<ChargingStation | null>(null);
  
  // 시뮬레이션용 상태
  const [isProcessing, setIsProcessing] = useState(false); // 처리 중 (충전/출차 대기)
  const [rewardToast, setRewardToast] = useState<{show: boolean, amount: number}>({show: false, amount: 0});
  const [isCounting, setIsCounting] = useState(false); // 숫자 올라가는 중인지

  // --- 마일리지 적립 로직 (시뮬레이션) ---
  const handleStartCharging = () => {
    setSelectedStation(null); // 팝업 닫기
    setIsProcessing(true);    // "충전/출차 대기 중" 시작

    // 1. 하드웨어가 출차를 감지했다고 가정 (3초 뒤 보상 발생)
    setTimeout(() => {
      const rewardAmount = 500;
      setIsProcessing(false);
      setRewardToast({ show: true, amount: rewardAmount }); // 보상 팝업 띄우기
      setIsCounting(true); // 숫자 카운팅 시작

      // 2. 마일리지 숫자 스르륵 올리기
      let start = points;
      const end = points + rewardAmount;
      const duration = 1000; // 1초 동안
      const stepTime = 20;
      const steps = duration / stepTime;
      const increment = rewardAmount / steps;

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setPoints(end);
          clearInterval(timer);
          setIsCounting(false);
        } else {
          setPoints(Math.floor(start));
        }
      }, stepTime);

      // 3. 4초 뒤 보상 팝업 숨기기
      setTimeout(() => setRewardToast({ show: false, amount: 0 }), 4000);
    }, 3000);
  };

  const filteredStations = stations.filter(station => {
    if (activeFilter === 'All') return true;
    return station.type === activeFilter;
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      
      {/* --- 상단 보상 알림 (Toast Animation) --- */}
      {rewardToast.show && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in zoom-in slide-in-from-top-4 duration-500">
          <div className="bg-white rounded-3xl p-5 shadow-2xl border-2 border-green-500 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600 animate-bounce">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400">매너 출차 보상 완료!</p>
              <p className="text-xl font-black text-gray-800">
                <span className="text-green-600">+{rewardToast.amount} P</span> 가 적립되었습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* --- 충전 처리 중 오버레이 --- */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center">
          <Loader2 size={64} className="animate-spin mb-6 opacity-50" />
          <h2 className="text-3xl font-black mb-2 italic tracking-tighter uppercase">Waiting for Departure...</h2>
          <p className="text-blue-100 max-w-xs leading-relaxed">
            하드웨어 센서가 차량의 이동을 감지하고 있습니다. 충전 완료 후 즉시 이동하면 마일리지가 지급됩니다!
          </p>
          <div className="mt-10 w-48 h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white animate-progress"></div>
          </div>
        </div>
      )}

      {/* --- 상단 바 --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 font-black text-2xl tracking-tight text-blue-600">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Zap size={20} fill="currentColor" /></div>
            VIUM
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-blue-600 relative">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="hidden md:flex items-center gap-2 p-1 pr-3 hover:bg-gray-100 rounded-full transition-all cursor-pointer">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{MOCK_USER.name[0]}</div>
              <span className="text-sm font-medium">{MOCK_USER.name} 님</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 왼쪽 컬럼: 사용자 정보 */}
          <div className="lg:col-span-1 space-y-6">
            <div className={`bg-blue-600 rounded-3xl p-8 text-white shadow-xl shadow-blue-200 relative overflow-hidden transition-all duration-300 ${isCounting ? 'scale-105 ring-4 ring-blue-300' : ''}`}>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-blue-100 text-sm font-medium italic">{MOCK_USER.level}</p>
                  <Coins size={24} className={`opacity-80 ${isCounting ? 'animate-spin' : ''}`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black leading-none">{points.toLocaleString()}</span>
                  <span className="text-xl font-medium opacity-80">P</span>
                </div>
                <button className="mt-8 w-full bg-white text-blue-600 py-3 rounded-2xl text-sm font-bold shadow-lg hover:bg-blue-50 transition-all">
                  마일리지 사용하기
                </button>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Search size={18} className="text-blue-500" />최근 활동 내역</h3>
              <div className="space-y-4">
                {MOCK_USER.recentActivity.map((act) => (
                  <div key={act.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                    <div><p className="text-sm font-bold text-gray-700">{act.type}</p><p className="text-xs text-gray-400">{act.date}</p></div>
                    <span className="text-sm font-bold text-blue-600">{act.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 중앙/오른쪽 컬럼: 지도 및 목록 */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-64 md:h-80 relative group">
              <div className="absolute inset-0 bg-blue-50 flex items-center justify-center text-blue-400 font-medium italic tracking-wide">MAP INTERFACE READY</div>
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg flex items-center justify-between">
                <div className="flex items-center gap-3"><MapPin className="text-red-500" /><span className="text-sm font-bold">강남구 역삼동 주변</span></div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                <h3 className="text-xl font-bold text-gray-800 tracking-tight">추천 충전소 리스트</h3>
                <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                  {['All', 'Rapid', 'Standard'].map((f) => (
                    <button key={f} onClick={() => setActiveFilter(f as any)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                      {f === 'All' ? '전체' : f === 'Rapid' ? '급속' : '완속'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredStations.map((station) => (
                  <div key={station.id} onClick={() => setSelectedStation(station)}
                    className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-[0.98]">
                    <div className="flex justify-between items-start mb-3">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        station.status === 'Available' ? 'bg-green-100 text-green-600' :
                        station.status === 'Charging' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                      }`}>{station.status === 'Available' ? '이용 가능' : station.status === 'Charging' ? '충전 중' : '점검 중'}</div>
                      <span className="text-xs font-bold text-gray-400">{station.distance}</span>
                    </div>
                    <h4 className="font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{station.name}</h4>
                    <p className="text-xs text-gray-400 mb-4 line-clamp-1">{station.address}</p>
                    <div className="flex items-center justify-between border-t border-gray-50 pt-4 mt-2">
                      <div className="flex items-center gap-2"><Zap size={14} className="text-blue-500" /><span className="text-xs font-bold text-gray-600">빈 충전기 {station.availableSlots}/{station.totalSlots}</span></div>
                      <p className="text-sm font-black text-blue-600">{station.price}원</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- 상세 정보 팝업 (Modal) --- */}
      {selectedStation && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedStation(null)}></div>
          <div className="relative bg-white w-full max-w-xl rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2 sm:hidden"></div>
            <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div><h2 className="text-2xl font-black text-gray-900 leading-tight mb-2">{selectedStation.name}</h2><p className="text-gray-400 text-sm flex items-center gap-1"><MapPin size={14} /> {selectedStation.address}</p></div>
                <button onClick={() => setSelectedStation(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-500" /></button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-bold text-blue-400 uppercase mb-1">상태</p><p className="text-sm font-black text-blue-700">{selectedStation.status === 'Available' ? '이용가능' : '충전불가'}</p></div>
                <div className="bg-green-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-bold text-green-400 uppercase mb-1">잔여석</p><p className="text-sm font-black text-green-700">{selectedStation.availableSlots} / {selectedStation.totalSlots}</p></div>
                <div className="bg-yellow-50 p-4 rounded-3xl text-center"><p className="text-[10px] font-bold text-yellow-400 uppercase mb-1">가격</p><p className="text-sm font-black text-yellow-700">{selectedStation.price}원</p></div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare size={18} className="text-blue-500" />사용자 리뷰</h3><span className="text-sm text-blue-600 font-bold">리뷰 쓰기</span></div>
                <div className="space-y-3">
                  {selectedStation.reviews.map(review => (
                    <div key={review.id} className="bg-gray-50 p-4 rounded-2xl">
                      <div className="flex justify-between mb-2"><span className="text-sm font-bold text-gray-700">{review.user}</span><div className="flex items-center gap-1 text-yellow-400"><Star size={12} fill="currentColor" /><span className="text-xs font-bold">{review.rating}</span></div></div>
                      <p className="text-sm text-gray-600 mb-2 leading-relaxed">{review.content}</p>
                      <div className="flex items-center gap-1 text-gray-400"><Clock size={12} /><span className="text-[10px]">{review.date}</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <button onClick={handleStartCharging} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-3xl text-lg font-black shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 active:scale-95">
                  <Zap size={24} fill="currentColor" />
                  충전 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 하단바 */}
      <nav className="md:hidden bg-white/90 backdrop-blur-xl border-t border-gray-100 fixed bottom-0 w-full flex justify-around py-4 px-2 z-40">
        <button className="flex flex-col items-center gap-1 text-blue-600"><Zap size={22} fill="currentColor" /><span className="text-[10px] font-bold">홈</span></button>
        <button className="flex flex-col items-center gap-1 text-gray-300"><MapPin size={22} /><span className="text-[10px] font-bold">지도</span></button>
        <button className="flex flex-col items-center gap-1 text-gray-300"><Coins size={22} /><span className="text-[10px] font-bold">마일리지</span></button>
        <button className="flex flex-col items-center gap-1 text-gray-300"><User size={22} /><span className="text-[10px] font-bold">내정보</span></button>
      </nav>
    </div>
  );
}

export default App;
