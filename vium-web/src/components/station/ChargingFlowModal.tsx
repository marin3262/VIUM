import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, CheckCircle2, Coins, BatteryFull, Loader2, Car, ShieldAlert, Eye, Cable, Plug2 } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useNotificationStore } from '../../store/notificationStore';

interface ChargingFlowModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onComplete: (amount: number) => void;
  initialStep?: FlowStep;
}

type FlowStep = 'CONNECTION_PROMPT' | 'SAFETY' | 'PLEDGE' | 'CHARGING' | 'WAITING_EXIT' | 'SUCCESS';

export const ChargingFlowModal: React.FC<ChargingFlowModalProps> = ({ station, onClose, onComplete, initialStep = 'CONNECTION_PROMPT' }) => {
  const { addNotification } = useNotificationStore();
  const [step, setStep] = useState<FlowStep>(initialStep);
  
  // 안전 점검 세분화 상태
  const [safetyStep, setSafetyStep] = useState(0); 
  const [safetyChecks, setSafetyChecks] = useState({ 
    surroundings: false, 
    cable: false, 
    connector: false 
  });

  const [currentSoc, setCurrentSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);
  const [progress, setProgress] = useState(30);
  const [exitTimer, setExitTimer] = useState(600); // 10분 타이머 (600초)
  const [isConnectorDisconnected, setIsConnectorDisconnected] = useState(false);
  
  const isCompletedRef = useRef(false);
  const targetChargerIdRef = useRef<string | null>(null);

  // 실시간 하드웨어 배터리 잔량 동기화
  useEffect(() => {
    if (station?.current_battery !== undefined && station.current_battery !== null) {
      const hwBattery = Math.floor(station.current_battery);
      setCurrentSoc(hwBattery);
      setProgress(hwBattery);
      
      // 만약 목표 충전량이 현재 배터리보다 낮다면 자동으로 조정
      if (targetSoc <= hwBattery) {
        setTargetSoc(Math.min(100, hwBattery + 10));
      }
    }
  }, [station?.current_battery, targetSoc]);

  // 목표 충전기 ID 획득 (모달 진입 시점의 충전기 추적)
  useEffect(() => {
    if (station && !targetChargerIdRef.current) {
      const active = station.chargers.find(c => c.status === 'Charging' || c.status === 'Occupied');
      if (active) {
        targetChargerIdRef.current = active.charger_id;
      }
    }
  }, [station]);

  // 단계별 이탈 방어 로직 (Smart Exit)
  const attemptClose = () => {
    if (step === 'CHARGING') {
      if (window.confirm("충전을 중단하고 메인으로 돌아가시겠습니까?")) {
        addNotification({
          role: 'USER',
          type: 'INFO',
          title: '충전 중단 🛑',
          message: '사용자 요청으로 충전 세션이 종료되었습니다.'
        });
        addNotification({
          role: 'ADMIN',
          type: 'WARNING',
          title: '충전 강제 중단 감지 🚨',
          message: `${station?.station_name} 구역에서 사용자가 충전을 중단했습니다.`
        });
        onClose();
      }
    } else if (step === 'WAITING_EXIT') {
      if (window.confirm("지금 종료하시면 '조기 출차 보너스'를 받으실 수 없습니다. 그래도 종료하시겠습니까?")) {
        addNotification({
          role: 'USER',
          type: 'WARNING',
          title: '보너스 포기 ⚠️',
          message: '출차 확인 전 세션이 종료되어 추가 보너스가 지급되지 않았습니다.'
        });
        addNotification({
          role: 'ADMIN',
          type: 'INFO',
          title: '출차 확인 전 이탈 🚗',
          message: `${station?.station_name} 사용자가 보너스 정산 없이 세션을 종료했습니다.`
        });
        onClose();
      }
    } else if (step === 'SUCCESS') {
      onComplete(reward.total);
      onClose();
    } else {
      onClose();
    }
  };

  // 안전 점검 항목 정의
  const safetyItems = [
    { 
      id: 'surroundings', 
      title: '주변 환경 점검', 
      desc: '바닥에 물기나 가연성 물질이 없는지 확인해 주세요.',
      icon: <Eye className="text-blue-500" size={32} />,
      color: 'blue'
    },
    { 
      id: 'cable', 
      title: '케이블 상태 확인', 
      desc: '충전 케이블의 피복이 벗겨지거나 꼬여있지 않나요?',
      icon: <Cable className="text-orange-500" size={32} />,
      color: 'orange'
    },
    { 
      id: 'connector', 
      title: '커넥터 체결 준비', 
      desc: '커넥터 내부에 이물질이 없는지 육안으로 확인하세요.',
      icon: <Plug2 className="text-green-500" size={32} />,
      color: 'green'
    }
  ];

  const deltaSoc = targetSoc - currentSoc;
  const reward = (() => {
    const base = 300;
    let total = base;
    let bonus = 0;
    let type = 'MIN';
    let label = '기본 보상';
    let desc = '최소 20% 이상 충전 시 보너스가 지급됩니다.';

    if (deltaSoc < 20) {
      // 기본값 유지
    } else if (targetSoc === 100) {
      type = 'FULL'; label = '완충 모드'; desc = '🔋 100% 완충 완료! 장거리 주행을 응원합니다.';
    } else if (targetSoc === 80) {
      total = base + 500; bonus = 500; type = 'ECO'; label = '최고 보상'; desc = '🌱 80% 에코 서약 보너스 적립 완료!';
    } else {
      total = base + 200; bonus = 200; type = 'EFF'; label = '효율 보상'; desc = '✨ 조기 출차 효율 보너스 적립 완료!';
    }

    // 매너 출차 보너스 추가 (10분 이내 성공적 출차 시)
    if (step === 'SUCCESS' && exitTimer > 0) {
      total += 500;
      bonus += 500;
      desc += ' (매너 출차 보너스 500P 추가 지급!)';
    }

    return { total, bonus, type, label, desc };
  })();

  const handleChargingComplete = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([500, 200, 500]);
    
    addNotification({
      role: 'USER',
      type: 'SUCCESS',
      title: '목표 충전 도달 🔋',
      message: `${targetSoc}% 충전이 완료되었습니다. 10분 내 출차 시 보너스가 지급됩니다.`
    });

    addNotification({
      role: 'ADMIN',
      type: 'INFO',
      title: '충전 완료 감지 📡',
      message: `${station?.station_name}의 충전이 끝났습니다. 차량 이탈 감지 모드로 전환합니다.`
    });
    
    setStep('WAITING_EXIT');
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (step === 'CHARGING' && station) {
      isCompletedRef.current = false;
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= targetSoc) {
            clearInterval(timer);
            return targetSoc;
          }
          return prev + 1;
        });
      }, 100);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [step, station, targetSoc]);

  useEffect(() => {
    if (step === 'CHARGING' && progress >= targetSoc && !isCompletedRef.current) {
      isCompletedRef.current = true;
      handleChargingComplete();
    }
  }, [progress, targetSoc, step]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 'WAITING_EXIT') {
      interval = setInterval(() => setExitTimer(prev => (prev > 0 ? prev - 1 : 0)), 1000);
      
      // 하드웨어 실시간 신호 감지 로직 (Polling 연동)
      if (station && targetChargerIdRef.current) {
        const targetCharger = station.chargers.find(c => c.charger_id === targetChargerIdRef.current);
        if (targetCharger) {
          // 1. 차량 퇴거 감지 (Available 상태로 전이 시)
          if (targetCharger.status === 'Available') {
            addNotification({
              role: 'USER',
              type: 'SUCCESS',
              title: '출차 확인 성공 ✅',
              message: '차량 이탈이 정상 감지되었습니다. 이용해주셔서 감사합니다.'
            });
            addNotification({
              role: 'ADMIN',
              type: 'SUCCESS',
              title: '공간 비워짐 확인 🚗💨',
              message: `${station.station_name}의 차량 이탈을 확인했습니다. 유령 데이터가 갱신됩니다.`
            });
            setStep('SUCCESS');
          } 
          // 2. 커넥터 해제 감지 (Charging -> Occupied 상태로 전이 시)
          else if (targetCharger.status === 'Occupied' && !isConnectorDisconnected) {
            setIsConnectorDisconnected(true);
            addNotification({
              role: 'USER',
              type: 'INFO',
              title: '커넥터 분리 확인 🔌',
              message: '커넥터가 분리되었습니다. 제자리에 돌려주시고 출차해 주세요.'
            });
            addNotification({
              role: 'ADMIN',
              type: 'INFO',
              title: '커넥터 해제 감지 🔌',
              message: `${station.station_name} 사용자가 커넥터를 분리했습니다.`
            });
          }
        }
      }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [step, station, isConnectorDisconnected, addNotification]);

  if (!station) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSafetyConfirm = () => {
    const currentItem = safetyItems[safetyStep];
    setSafetyChecks({ ...safetyChecks, [currentItem.id]: true });
    
    if (safetyStep < safetyItems.length - 1) {
      setSafetyStep(prev => prev + 1);
    } else {
      setStep('PLEDGE');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* 백드롭 클릭 시에도 Smart Exit 로직 적용 */}
      <div className="absolute inset-0 bg-blue-900/90 backdrop-blur-xl" onClick={attemptClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col transition-all duration-500">
        
        {/* 상단 통합 헤더 (X 버튼 추가) */}
        <div className="flex justify-between items-center px-8 pt-8 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{step} Session</span>
          </div>
          <button 
            onClick={attemptClose}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        {step === 'CONNECTION_PROMPT' && (
          <div className="p-8 pt-4 flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
              <Cable className="text-blue-600" size={48} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-gray-900 leading-tight">충전기 연결 감지</h3>
              <p className="text-sm text-gray-500 font-medium break-keep">
                차량과 충전기가 성공적으로 연결되었습니다.<br />충전을 시작하시겠습니까?
              </p>
            </div>
            {station?.current_battery !== undefined && station.current_battery !== null && (
              <div className="w-full bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 flex items-center justify-center gap-3">
                <BatteryFull className="text-blue-500" size={24} />
                <span className="text-base font-black text-blue-700">현재 배터리: {Math.floor(station.current_battery)}%</span>
              </div>
            )}
            <div className="w-full flex gap-3 pt-4">
              <button 
                onClick={attemptClose} 
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl font-black transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => setStep('SAFETY')} 
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                충전 진행하기
              </button>
            </div>
          </div>
        )}

        {step === 'SAFETY' && (
          <div className="p-8 pt-4 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900 leading-tight">안전 가디언 점검</h3>
                <p className="text-gray-400 text-xs mt-1">충전 전 3단계를 신중하게 확인해 주세요.</p>
              </div>
              <ShieldAlert className="text-red-500 animate-pulse" size={28} />
            </div>

            {/* 단계 진행 표시기 */}
            <div className="flex gap-2">
              {safetyItems.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= safetyStep ? 'bg-blue-600' : 'bg-gray-100'}`} />
              ))}
            </div>

            {/* 메인 안전 점검 카드 - 일관된 높이 확보 */}
            <div key={safetyStep} className="bg-gray-50 rounded-[40px] p-8 border border-gray-100 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right-10 duration-500 min-h-[300px]">
              <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-50 flex items-center justify-center shrink-0">
                {safetyItems[safetyStep].icon}
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-black text-gray-800">{safetyItems[safetyStep].title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed font-medium break-keep max-w-[240px]">
                  {safetyItems[safetyStep].desc}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleSafetyConfirm} 
                className="w-full bg-gray-900 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={20} className="text-blue-400" />
                {safetyStep === safetyItems.length - 1 ? '모든 점검 완료' : '확인했습니다'}
              </button>
              
              {safetyStep > 0 && (
                <button 
                  onClick={() => setSafetyStep(prev => prev - 1)}
                  className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors"
                >
                  이전 항목 다시 보기
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'PLEDGE' && (
          <div className="p-8 pt-4 space-y-6 flex-1 overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-start">
              <div><h3 className="text-xl font-black text-gray-900 leading-tight">충전 목표 설정</h3><p className="text-gray-400 text-xs mt-1">목표 수치에 따라 보상이 달라집니다.</p></div>
              <BatteryFull className="text-blue-600" size={32} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTargetSoc(80)} className={`flex-1 py-3 rounded-2xl text-xs font-black border-2 transition-all ${targetSoc === 80 ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>🌱 에코 80%</button>
              <button onClick={() => setTargetSoc(100)} className={`flex-1 py-3 rounded-2xl text-xs font-black border-2 transition-all ${targetSoc === 100 ? 'bg-gray-800 border-gray-800 text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>🔋 100% 완충</button>
            </div>
            <div className="bg-gray-50 p-6 rounded-[32px] space-y-6 border border-gray-100">
              <div className="space-y-2"><div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>현재</span><span className="text-blue-600">{currentSoc}%</span></div><input type="range" min="0" max={targetSoc-5} value={currentSoc} onChange={(e) => { const v = parseInt(e.target.value); setCurrentSoc(v); setProgress(v); }} className="w-full h-1 bg-gray-200 appearance-none accent-blue-600 cursor-pointer" /></div>
              <div className="space-y-2"><div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>목표</span><span className={targetSoc === 100 ? "text-gray-800" : "text-green-600"}>{targetSoc}%</span></div><input type="range" min={currentSoc+5} max="100" value={targetSoc} onChange={(e) => setTargetSoc(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 appearance-none accent-green-600 cursor-pointer" /></div>
            </div>
            <div className={`p-5 rounded-3xl border-2 transition-all ${reward.type === 'MIN' ? 'bg-red-50 border-red-100' : reward.type === 'ECO' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-gray-400 uppercase">{reward.label}</span><div className="flex items-center gap-1 font-black text-blue-600"><Coins size={14} />{reward.total}P</div></div>
              <p className="text-[10px] leading-relaxed font-bold text-gray-500">{reward.desc}</p>
            </div>
            <button onClick={() => {
              addNotification({ role: 'USER', type: 'INFO', title: '충전 시작 ⚡', message: `${station.station_name}에서 충전을 시작합니다.` });
              addNotification({ role: 'ADMIN', type: 'INFO', title: '충전 개시 모니터링 📡', message: `${station.station_name} 구역에서 충전 세션이 시작되었습니다.` });
              setStep('CHARGING');
            }} className="w-full bg-blue-600 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all">충전 시작하기</button>
          </div>
        )}

        {step === 'CHARGING' && (
          <div className="p-10 pt-4 flex flex-col items-center text-center space-y-8 animate-in zoom-in duration-500">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full"><circle cx="96" cy="96" r="88" stroke="#F3F4F6" strokeWidth="12" fill="transparent" /><circle cx="96" cy="96" r="88" stroke={targetSoc === 100 ? "#1F2937" : targetSoc === 80 ? "#10B981" : "#3B82F6"} strokeWidth="12" fill="transparent" strokeDasharray={552.92} strokeDashoffset={552.92 - (552.92 * progress) / 100} strokeLinecap="round" transform="rotate(-90 96 96)" className="transition-all duration-100 ease-linear" /></svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Zap size={36} className={`${targetSoc === 100 ? 'text-gray-800' : 'text-blue-600'} mb-2 animate-pulse`} fill="currentColor" />
                <span className="text-5xl font-black text-gray-900 tracking-tighter">{Math.floor(progress)}%</span>
              </div>
            </div>
            <h3 className="text-xl font-black text-gray-900 italic uppercase">Charging to {targetSoc}%</h3>
          </div>
        )}

        {step === 'WAITING_EXIT' && (
          <div className="p-10 pt-4 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center relative z-10 ${isConnectorDisconnected ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                {isConnectorDisconnected ? <Car size={64} className="animate-bounce" /> : <Plug2 size={64} className="animate-pulse" />}
              </div>
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isConnectorDisconnected ? 'bg-green-400' : 'bg-blue-400'}`}></div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 italic uppercase">
                {isConnectorDisconnected ? 'Waiting for Exit...' : 'Disconnect Connector'}
              </h3>
              {isConnectorDisconnected ? (
                <p className="text-sm text-green-600 font-bold leading-relaxed bg-green-50 px-4 py-2 rounded-xl">
                  커넥터가 안전하게 분리되었습니다!<br/>제자리에 돌려주시고 출차해 주세요.
                </p>
              ) : (
                <p className="text-sm text-gray-400 leading-relaxed">
                  차량에서 <strong className="text-blue-600">커넥터를 분리</strong>해 주세요.
                </p>
              )}
            </div>

            <p className="text-sm text-gray-400 leading-relaxed">
              <span className="text-blue-600 font-bold">{formatTime(exitTimer)}</span> 이내에 출차 시 보너스가 지급됩니다.
            </p>
            
            <div className="w-full bg-gray-50 p-5 rounded-3xl flex items-center justify-center gap-3 font-black text-gray-400 uppercase text-xs tracking-tighter border border-gray-100">
              <Loader2 className="animate-spin text-blue-500" size={18} /> 
              H/W SENSOR LIVE MONITORING
            </div>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
            <div className="bg-green-100 p-6 rounded-full text-green-600 animate-bounce"><CheckCircle2 size={64} /></div>
            <h3 className="text-2xl font-black text-gray-900">출차 확인 완료!</h3>
            <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 flex justify-between items-center"><span className="text-gray-900 font-black">적립 마일리지</span><span className="text-blue-600 font-black text-2xl">{reward.total} P</span></div>
            <button onClick={() => { onComplete(reward.total); onClose(); }} className="w-full bg-blue-600 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all">보상 받기</button>
          </div>
        )}
      </div>
    </div>
  );
};
