import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Zap, AlertCircle, CheckCircle2, Timer, Coins, BatteryFull, Info, Loader2, Car } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useNotificationStore } from '../../store/notificationStore';

interface ChargingFlowModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onComplete: (amount: number) => void;
}

type FlowStep = 'SAFETY' | 'PLEDGE' | 'CHARGING' | 'WAITING_EXIT' | 'SUCCESS';

export const ChargingFlowModal: React.FC<ChargingFlowModalProps> = ({ station, onClose, onComplete }) => {
  const { addNotification } = useNotificationStore();
  const [step, setStep] = useState<FlowStep>('SAFETY');
  const [safetyChecks, setSafetyChecks] = useState({ connector: false, cable: false });
  const [currentSoc, setCurrentSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);
  const [progress, setProgress] = useState(30);
  const [exitTimer, setExitTimer] = useState(300);
  
  const isCompletedRef = useRef(false);

  const deltaSoc = targetSoc - currentSoc;
  const reward = (() => {
    const base = 300;
    if (deltaSoc < 20) return { total: base, bonus: 0, type: 'MIN', label: '기본 보상', desc: '최소 20% 이상 충전 시 보너스가 지급됩니다.' };
    if (targetSoc === 100) return { total: base, bonus: 0, type: 'FULL', label: '완충 모드', desc: '🔋 100% 완충 완료! 장거리 주행을 응원합니다.' };
    if (targetSoc === 80) return { total: base + 500, bonus: 500, type: 'ECO', label: '최고 보상', desc: '🌱 80% 에코 서약 보너스 적립 완료!' };
    return { total: base + 200, bonus: 200, type: 'EFF', label: '효율 보상', desc: '✨ 조기 출차 효율 보너스 적립 완료!' };
  })();

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

  const handleChargingComplete = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([500, 200, 500]);
    
    // 사용자용 알림
    addNotification({
      role: 'USER',
      type: 'SUCCESS',
      title: '목표 충전 도달 🔋',
      message: `${targetSoc}% 충전이 완료되었습니다. 5분 내 출차 시 보너스가 확정됩니다.`
    });

    // 관리자용 알림 (관제)
    addNotification({
      role: 'ADMIN',
      type: 'INFO',
      title: '충전 완료 감지 📡',
      message: `${station?.station_name}의 충전이 끝났습니다. 차량 이탈 감지 모드로 전환합니다.`
    });
    
    setStep('WAITING_EXIT');
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let hwTimeout: ReturnType<typeof setTimeout>;
    if (step === 'WAITING_EXIT') {
      interval = setInterval(() => setExitTimer(prev => (prev > 0 ? prev - 1 : 0)), 1000);
      hwTimeout = setTimeout(() => {
        // 사용자용 알림
        addNotification({
          role: 'USER',
          type: 'SUCCESS',
          title: '출차 확인 성공 ✅',
          message: '차량 이탈이 정상 감지되었습니다. 보너스가 지급됩니다.'
        });
        // 관리자용 알림
        addNotification({
          role: 'ADMIN',
          type: 'SUCCESS',
          title: '공간 비워짐 확인 🚗💨',
          message: `${station?.station_name}의 차량 이탈을 확인했습니다. 유령 데이터가 갱신됩니다.`
        });
        setStep('SUCCESS');
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); if (hwTimeout) clearTimeout(hwTimeout); };
  }, [step]);

  if (!station) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-blue-900/90 backdrop-blur-xl" onClick={step === 'SUCCESS' ? undefined : onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden">
        
        {step === 'SAFETY' && (
          <div className="p-8 space-y-6">
            <h3 className="text-xl font-black text-gray-900">안전 점검</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl border-2 border-transparent has-[:checked]:border-blue-600 cursor-pointer">
                <input type="checkbox" checked={safetyChecks.connector} onChange={(e) => setSafetyChecks({...safetyChecks, connector: e.target.checked})} className="w-6 h-6 rounded-lg text-blue-600" />
                <span className="text-sm font-bold text-gray-700">커넥터 상태 확인</span>
              </label>
              <label className="flex items-center gap-4 p-5 bg-gray-50 rounded-3xl border-2 border-transparent has-[:checked]:border-blue-600 cursor-pointer">
                <input type="checkbox" checked={safetyChecks.cable} onChange={(e) => setSafetyChecks({...safetyChecks, cable: e.target.checked})} className="w-6 h-6 rounded-lg text-blue-600" />
                <span className="text-sm font-bold text-gray-700">케이블 상태 확인</span>
              </label>
            </div>
            <button disabled={!safetyChecks.connector || !safetyChecks.cable} onClick={() => setStep('PLEDGE')} className="w-full bg-blue-600 disabled:bg-gray-200 text-white py-5 rounded-3xl text-lg font-black transition-all active:scale-95">다음 단계로</button>
          </div>
        )}

        {step === 'PLEDGE' && (
          <div className="p-8 space-y-6">
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
          <div className="p-10 flex flex-col items-center text-center space-y-8">
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
          <div className="p-10 flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in">
            <div className="relative"><div className="bg-blue-50 w-32 h-32 rounded-full flex items-center justify-center text-blue-600 relative z-10"><Car size={64} className="animate-bounce" /></div><div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div></div>
            <h3 className="text-2xl font-black text-gray-900 mb-2 italic uppercase">Waiting for Exit...</h3>
            <p className="text-sm text-gray-400 leading-relaxed"><span className="text-blue-600 font-bold">{formatTime(exitTimer)}</span> 이내에 이동해야 보너스가 지급됩니다.</p>
            <div className="w-full bg-blue-50 p-5 rounded-3xl flex items-center gap-4 font-black text-blue-900 uppercase text-xs tracking-tighter"><Loader2 className="animate-spin" size={20} /> H/W SENSOR LIVE MONITORING</div>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in">
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
