import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, CheckCircle2, Coins, BatteryFull, Loader2, Car, ShieldAlert, Eye, Cable, Plug2, ArrowLeft, Lock } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { useUserStore } from '../../store/userStore';
import { useNotificationStore } from '../../store/notificationStore';
import { stationService } from '../../services/stationService';
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = "test_ck_DnyRpQWGrNlgeqqGLm5L3Kwv1M9E";

interface ChargingFlowModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onComplete: (amount: number) => void;
  initialStep?: FlowStep;
}

type FlowStep = 'CONNECTION_PROMPT' | 'SAFETY' | 'PLEDGE' | 'CHARGING' | 'BILLING' | 'WAITING_EXIT' | 'SUCCESS';

export const ChargingFlowModal: React.FC<ChargingFlowModalProps> = ({ station, onClose, onComplete, initialStep = 'CONNECTION_PROMPT' }) => {
  const { user, fetchUser } = useUserStore();
  const { addNotification } = useNotificationStore();
  const [step, setStep] = useState<FlowStep>(initialStep);
  
  const [totalPrice, setTotalPrice] = useState(0);
  const [usedMileage, setUsedMileage] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [safetyStep, setSafetyStep] = useState(0); 
  const [currentSoc, setCurrentSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);
  const [progress, setProgress] = useState(30);
  const [exitTimer, setExitTimer] = useState(600);
  const [isConnectorDisconnected, setIsConnectorDisconnected] = useState(false);
  
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  
  const isCompletedRef = useRef(false);
  const isConfirmingRef = useRef(false); 
  const targetChargerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialStep === 'BILLING') {
      const savedContext = sessionStorage.getItem('vium_charging_context');
      if (savedContext) {
        try {
          const context = JSON.parse(savedContext);
          setTotalPrice(context.totalPrice);
          setUsedMileage(context.usedMileage);
          setCurrentSoc(context.currentSoc);
          setTargetSoc(context.targetSoc);
          setProgress(context.targetSoc); 
        } catch (e) {
          console.error("Failed to parse charging context", e);
        }
      }
    }
  }, [initialStep]);

  // 충전 시작 시 세션 선행 생성 (target_soc 알림을 위함)
  const handleStartCharging = async () => {
    if (!station || !targetChargerIdRef.current) return;
    
    try {
        console.log("⚡ [Charging] Pre-creating session for notifications...");
        const response = await stationService.createPaymentSession({
          station_id: station.station_id,
          charger_id: targetChargerIdRef.current,
          total_price: 0,
          used_mileage: 0,
          final_amount: 0,
          target_soc: targetSoc
        });

        if (response.success && response.data) {
            const orderId = response.data.order_id;
            setActiveOrderId(orderId);
            
            // [복구]: 충전 시작 로컬 알림
            addNotification({
              id: `start-${orderId}`,
              role: 'USER',
              type: 'INFO',
              title: '⚡ 충전 시작',
              message: `${user?.nickname || '고객'}님, ${station.station_name}에서 충전이 시작되었습니다. 안전하게 충전해 드릴게요!`
            });

            setStep('CHARGING');
        }
    } catch (e) {
        console.error("Failed to pre-create session", e);
        setStep('CHARGING'); // 실패해도 일단 진행 (UI 시뮬레이션 우선)
    }
  };

  const handlePayment = async () => {
    if (!station || !targetChargerIdRef.current || !activeOrderId) return;
    setIsProcessingPayment(true);
    try {
      const finalAmount = totalPrice - usedMileage;
      
      // 기존 세션 정보 업데이트 (금액 확정)
      await stationService.updatePaymentSession(activeOrderId, {
        station_id: station.station_id,
        charger_id: targetChargerIdRef.current,
        total_price: totalPrice,
        used_mileage: usedMileage,
        final_amount: finalAmount,
        target_soc: targetSoc
      });

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const customerKey = user 
        ? `USER_${user.user_id}_${Date.now()}`.replace(/[^a-zA-Z0-9-_]/g, '')
        : `GUEST_${Math.random().toString(36).substring(2, 12)}`;
      
      const payment = tossPayments.payment({ customerKey });

      sessionStorage.setItem('vium_last_charging_id', station.station_id);
      sessionStorage.setItem('vium_charging_context', JSON.stringify({
        totalPrice, usedMileage, currentSoc, targetSoc
      }));
      
      await payment.requestPayment({
        method: "CARD", 
        amount: { currency: "KRW", value: finalAmount },
        orderId: activeOrderId,
        orderName: `VIUM ${station.station_name} 충전 요금`,
        successUrl: window.location.origin + window.location.pathname + "?payment_success=true",
        failUrl: window.location.origin + window.location.pathname + "?payment_fail=true",
        customerEmail: user?.email || "",
        customerName: user?.nickname || "VIUM 유저",
      });
    } catch (error: any) {
      console.error("Payment Request Error:", error);
      setIsProcessingPayment(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    
    if (params.get('payment_success') === 'true' && orderId) {
      if (isConfirmingRef.current) return;
      isConfirmingRef.current = true;

      const processedKey = `vium_confirmed_${orderId}`;
      if (sessionStorage.getItem(processedKey)) {
        setStep('WAITING_EXIT');
        return;
      }

      (async () => {
        setIsProcessingPayment(true);
        try {
          const response = await stationService.confirmPayment({
            paymentKey: params.get('paymentKey')!,
            orderId: orderId,
            amount: parseInt(params.get('amount')!)
          });
          
          if (response.success) {
            // [복구]: 결제 승인 완료 로컬 알림
            addNotification({
              id: `paid-${orderId}`,
              role: 'USER',
              type: 'SUCCESS',
              title: '💳 결제 및 충전 승인 완료',
              message: '안전하게 충전이 완료되었습니다. 이용해 주셔서 감사합니다!'
            });

            sessionStorage.setItem(processedKey, 'true'); 
            if (fetchUser) await fetchUser(); 
            setStep('WAITING_EXIT');
            window.history.replaceState({}, '', window.location.pathname);
            sessionStorage.removeItem('vium_charging_context');
          } else throw new Error(response.error);
        } catch (error: any) {
          console.error("Payment Confirm Error:", error);
          setStep('BILLING');
        } finally { setIsProcessingPayment(false); }
      })();
    }
  }, [fetchUser]);

  useEffect(() => {
    if (step === 'CHARGING' || step === 'BILLING' || step === 'WAITING_EXIT' || step === 'SUCCESS') return;
    if (station?.current_battery !== undefined && station.current_battery !== null) {
      const hwBattery = Math.floor(station.current_battery);
      setCurrentSoc(hwBattery);
      setProgress(hwBattery);
      if (targetSoc <= hwBattery) setTargetSoc(Math.min(100, hwBattery + 10));
    }
  }, [station?.current_battery, targetSoc, step]);

  useEffect(() => {
    if (station && !targetChargerIdRef.current) {
      const active = station.chargers.find(c => c.status === 'Charging' || c.status === 'Occupied');
      if (active) targetChargerIdRef.current = active.charger_id;
    }
  }, [station]);

  const attemptClose = () => {
    if (step === 'CHARGING') { if (window.confirm("충전을 중단하시겠습니까?")) onClose(); }
    else if (step === 'BILLING') { if (window.confirm("결제를 중단하시겠습니까?")) onClose(); }
    else if (step === 'WAITING_EXIT') { if (window.confirm("출차 확인 전 종료하시겠습니까?")) onClose(); }
    else if (step === 'SUCCESS') { onComplete(reward.total); onClose(); }
    else onClose();
  };

  const safetyItems = [
    { id: 'surroundings', title: '주변 환경 점검', desc: '바닥에 물기나 가연성 물질이 없는지 확인해 주세요.', icon: <Eye className="text-blue-500" size={32} /> },
    { id: 'cable', title: '케이블 상태 확인', desc: '충전 케이블의 피복이 벗겨지거나 꼬여있지 않나요?', icon: <Cable className="text-orange-500" size={32} /> },
    { id: 'connector', title: '커넥터 체결 준비', desc: '커넥터 내부에 이물질이 없는지 육안으로 확인하세요.', icon: <Plug2 className="text-green-500" size={32} /> }
  ];

  const handleSafetyConfirm = () => {
    if (safetyStep < safetyItems.length - 1) setSafetyStep(prev => prev + 1);
    else setStep('PLEDGE');
  };

  const deltaSoc = targetSoc - currentSoc;
  const reward = (() => {
    const base = 300; let total = base;
    let bonus = 0;
    let type = 'MIN';
    let label = '기본 보상';
    let desc = '20% 이상 충전 시 보너스가 지급됩니다.';

    if (deltaSoc >= 20) {
      if (targetSoc === 100) {
        type = 'FULL'; label = '완충 모드'; desc = '🔋 100% 완충 완료! 장거리 주행을 응원합니다.';
        total = base + 300; bonus = 300;
      } else if (targetSoc === 80) {
        total = base + 500; bonus = 500; type = 'ECO'; label = '최고 보상'; desc = '🌱 80% 에코 서약 보너스 적립 완료!';
      } else {
        total = base + 200; bonus = 200; type = 'EFF'; label = '효율 보상'; desc = '✨ 조기 출차 효율 보너스 적립 완료!';
      }
    }
    if (step === 'SUCCESS' && exitTimer > 0) total += 500;
    return { total, bonus, type, label, desc };
  })();

  const triggerStepChangeToBilling = () => {
    const chargedPercent = targetSoc - currentSoc;
    setTotalPrice(Math.max(0, chargedPercent * 200));
    setStep('BILLING');
  };

  useEffect(() => {
    let timer: any;
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
    return () => clearInterval(timer);
  }, [step, station, targetSoc]);

  useEffect(() => {
    if (step === 'CHARGING' && progress >= targetSoc && !isCompletedRef.current) {
      isCompletedRef.current = true;
      
      // [신규]: 통합 알림 브릿지 가동
      // 프론트엔드 시뮬레이션이 끝나는 즉시 백엔드와 동일한 규격의 알림을 로컬 스토어에 추가합니다.
      // 이렇게 하면 백엔드 푸시가 지연되더라도 사용자는 즉시 '✅' 알림을 받게 되며,
      // 추후 도착하는 실제 푸시 알림은 tag(ID) 기반 중복 방지 로직에 의해 자동으로 걸러집니다.
      addNotification({
        id: activeOrderId ? `done-${activeOrderId}` : undefined,
        role: 'USER',
        type: 'SUCCESS',
        title: `✅ 목표 충전(${targetSoc}%) 도달`,
        message: `${user?.nickname || '고객'}님, 설정하신 ${targetSoc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요.`
      });

      triggerStepChangeToBilling();
    }
  }, [progress, targetSoc, step, user, activeOrderId, addNotification]);

  useEffect(() => {
    let interval: any;
    if (step === 'WAITING_EXIT') {
      interval = setInterval(() => setExitTimer(prev => (prev > 0 ? prev - 1 : 0)), 1000);
      if (station && targetChargerIdRef.current) {
        const targetCharger = station.chargers.find(c => c.charger_id === targetChargerIdRef.current);
        
        if (targetCharger?.status === 'Available') {
          setStep('SUCCESS');
          // [복구]: 출차 완료 로컬 알림
          addNotification({
            id: activeOrderId ? `exit-${activeOrderId}` : undefined,
            role: 'USER',
            type: 'SUCCESS',
            title: '🚗 출차 확인 완료',
            message: `${user?.nickname || '고객'}님, 안전하게 출차되었습니다. 오늘도 즐거운 드라이빙 되세요!`
          });
        }
        else if (targetCharger?.status === 'Occupied' && !isConnectorDisconnected) {
          setIsConnectorDisconnected(true);
          // [복구]: 커넥터 분리 로컬 알림
          addNotification({
            id: activeOrderId ? `disconnect-${activeOrderId}` : undefined,
            role: 'USER',
            type: 'INFO',
            title: '🔌 커넥터 분리 확인',
            message: `${user?.nickname || '고객'}님, 커넥터가 안전하게 분리되었습니다. 이제 출차해 주세요.`
          });
        }
      }
    }
    return () => clearInterval(interval);
  }, [step, station, isConnectorDisconnected, addNotification, user, activeOrderId]);

  if (!station) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-blue-900/90 backdrop-blur-xl" onClick={attemptClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col transition-all duration-500">
        
        <div className="flex justify-between items-center px-8 pt-8 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{step} Session</span>
          </div>
          <button onClick={attemptClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors active:scale-90"><X size={18} /></button>
        </div>

        {step === 'CONNECTION_PROMPT' && (
          <div className="p-8 pt-4 flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-bottom-5 duration-500">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto animate-pulse"><Cable className="text-blue-600" size={48} /></div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-gray-900 leading-tight">충전기 연결 감지</h3>
              <p className="text-sm text-gray-500 font-medium break-keep">차량과 충전기가 성공적으로 연결되었습니다.<br />충전을 시작하시겠습니까?</p>
            </div>
            
            <div className="w-full bg-blue-50/50 px-6 py-4 rounded-2xl border border-blue-100 flex items-center justify-center gap-3">
              <BatteryFull className="text-blue-500" size={24} />
              <span className="text-base font-black text-blue-700">현재 배터리: {Math.floor(currentSoc)}%</span>
            </div>

            <div className="w-full flex gap-3 pt-2">
              <button onClick={attemptClose} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-2xl font-black transition-colors">취소</button>
              <button onClick={() => setStep('SAFETY')} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all active:scale-95">충전 진행하기</button>
            </div>
          </div>
        )}

        {step === 'SAFETY' && (
          <div className="p-8 pt-4 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center">
              <div><h3 className="text-xl font-black text-gray-900 leading-tight">안전 가디언 점검</h3><p className="text-gray-400 text-xs mt-1">충전 전 3단계를 신중하게 확인해 주세요.</p></div>
              <ShieldAlert className="text-red-500 animate-pulse" size={28} />
            </div>
            
            <div className="flex gap-2">
              {safetyItems.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= safetyStep ? 'bg-blue-600' : 'bg-gray-100'}`} />
              ))}
            </div>

            <div key={safetyStep} className="bg-gray-50 rounded-[40px] p-8 border border-gray-100 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right-10 duration-500 min-h-[300px]">
              <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-50 flex items-center justify-center shrink-0">{safetyItems[safetyStep].icon}</div>
              <div className="space-y-3">
                <h4 className="text-xl font-black text-gray-800">{safetyItems[safetyStep].title}</h4>
                <p className="text-sm text-gray-500 font-medium break-keep max-w-[240px]">{safetyItems[safetyStep].desc}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <button onClick={handleSafetyConfirm} className="w-full bg-gray-900 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                <CheckCircle2 size={20} className="text-blue-400" />
                {safetyStep === safetyItems.length - 1 ? '모든 점검 완료' : '확인했습니다'}
              </button>
              
              {safetyStep > 0 && (
                <button 
                  onClick={() => setSafetyStep(prev => prev - 1)} 
                  className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> 이전 항목 다시 보기
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
            <div className="bg-gray-50 p-6 rounded-[32px] space-y-6 border border-gray-100">
              <div className="space-y-2"><div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>현재</span><span className="text-blue-600">{currentSoc}%</span></div><input type="range" min="0" max={targetSoc-5} value={currentSoc} onChange={(e) => { const v = parseInt(e.target.value); setCurrentSoc(v); setProgress(v); }} className="w-full h-1 bg-gray-200 appearance-none accent-blue-600 cursor-pointer" /></div>
              <div className="space-y-2"><div className="flex justify-between text-[10px] font-black text-gray-400 uppercase"><span>목표</span><span className="text-green-600">{targetSoc}%</span></div><input type="range" min={currentSoc+5} max="100" value={targetSoc} onChange={(e) => setTargetSoc(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 appearance-none accent-green-600 cursor-pointer" /></div>
            </div>

            <div className={`p-5 rounded-3xl border-2 transition-all ${reward.type === 'MIN' ? 'bg-red-50 border-red-100' : reward.type === 'ECO' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">{reward.label}</span>
                <div className="flex items-center gap-1 font-black text-blue-600"><Coins size={14} />{reward.total}P</div>
              </div>
              <p className="text-[10px] leading-relaxed font-bold text-gray-500">{reward.desc}</p>
            </div>

            <button onClick={handleStartCharging} className="w-full bg-blue-600 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all">충전 시작하기</button>
          </div>
        )}

        {step === 'CHARGING' && (
          <div className="p-10 pt-4 flex flex-col items-center text-center space-y-8 animate-in zoom-in duration-500">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" className="stroke-gray-100" strokeWidth="16" fill="none" />
                <circle cx="96" cy="96" r="88" className="stroke-blue-500 transition-all duration-300 ease-out" strokeWidth="16" fill="none" strokeDasharray="552.92" strokeDashoffset={552.92 * (1 - progress / 100)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><Zap size={36} className={` ${targetSoc === 100 ? 'text-gray-800' : 'text-blue-600'} mb-2 animate-pulse`} fill="currentColor" /><span className="text-5xl font-black text-gray-900 tracking-tighter">{Math.floor(progress)}%</span></div>
            </div>
            <h3 className="text-xl font-black text-gray-900 italic uppercase">Charging to {targetSoc}%</h3>
          </div>
        )}

        {step === 'BILLING' && (
          <div className="p-8 pt-4 space-y-6 animate-in slide-in-from-bottom-5 duration-500 overflow-y-auto no-scrollbar max-h-[70vh]">
            <div className="flex justify-between items-center"><h3 className="text-2xl font-black text-gray-900 italic uppercase">Billing</h3><div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-tighter">RECEIPT</div></div>
            
            <div className="bg-gray-50 rounded-3xl p-6 border-2 border-dashed border-gray-200 space-y-4">
              <div className="flex justify-between items-center text-sm"><span className="text-gray-500 font-bold">이용 요금 합계</span><span className="text-gray-900 font-black">{totalPrice.toLocaleString()}원</span></div>
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold text-sm">마일리지 할인</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={usedMileage || ''} 
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, user?.mileage_balance || 0, totalPrice));
                        setUsedMileage(val);
                      }} 
                      placeholder="0" 
                      className="w-24 px-3 py-1 text-right bg-white border border-gray-200 rounded-lg text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                    <span className="text-[10px] font-black text-gray-400">P</span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <span className="text-[10px] font-bold text-gray-400">보유: {(user?.mileage_balance || 0).toLocaleString()}P</span>
                  <button onClick={() => setUsedMileage(Math.min(user?.mileage_balance || 0, totalPrice))} className="text-[10px] font-black text-blue-600 underline underline-offset-2">전액 사용</button>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t-2 border-gray-900"><span className="text-lg font-black text-gray-900">최종 결제 금액</span><span className="text-2xl font-black text-blue-600">{(totalPrice - usedMileage).toLocaleString()}원</span></div>
            </div>

            <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-blue-600 font-black text-sm uppercase tracking-tighter">
                <Lock size={16} /> Secure Payment Ready
              </div>
              <p className="text-[10px] text-blue-700/60 font-medium text-center">결제하기 버튼을 누르면 토스페이먼츠 안전 결제창이 열립니다.</p>
            </div>

            <button onClick={handlePayment} disabled={isProcessingPayment} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-5 rounded-3xl text-lg font-black shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-3">
              {isProcessingPayment ? <><Loader2 size={24} className="animate-spin" /> 처리 중...</> : <><Zap size={20} fill="currentColor" /> 결제창 열기</>}
            </button>
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
              <h3 className="text-2xl font-black text-gray-900 italic uppercase">{isConnectorDisconnected ? '출차 대기 중' : '커넥터 분리 안내'}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {isConnectorDisconnected ? '커넥터 분리가 확인되었습니다. 출차해 주세요.' : '차량에서 커넥터를 분리해 주세요.'}
              </p>
            </div>
            <div className="w-full bg-gray-50 p-5 rounded-3xl flex items-center justify-center gap-3 font-black text-gray-400 uppercase text-xs tracking-tighter border border-gray-100"><Loader2 className="animate-spin text-blue-500" size={18} /> H/W SENSOR LIVE MONITORING</div>
          </div>
        )}

        {step === 'SUCCESS' && (
          <div className="p-10 flex flex-col items-center text-center space-y-6 animate-in zoom-in duration-500">
            <div className="bg-green-100 p-6 rounded-full text-green-600 animate-bounce"><CheckCircle2 size={64} /></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900">충전 및 결제 완료!</h3>
              <p className="text-sm text-gray-400 font-medium">안전하게 출차가 완료되었습니다.</p>
            </div>
            
            <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-4">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 uppercase tracking-tighter">
                <span>총 획득 보상</span>
                <Coins size={14} className="text-blue-500" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-black">적립 마일리지</span>
                <span className="text-blue-600 font-black text-2xl">{reward.total.toLocaleString()} P</span>
              </div>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed text-left border-t border-gray-100 pt-3">
                * 기본 보상 및 매너 출차 보너스가 포함된 금액입니다.
              </p>
            </div>

            <button onClick={() => { onComplete(reward.total); onClose(); }} className="w-full bg-blue-600 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all">완료</button>
          </div>
        )}
      </div>
    </div>
  );
};
