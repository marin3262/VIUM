import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Loader2, Car, Plug2, BatteryFull, CreditCard, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { stationService } from '../../services/stationService';
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { ChargingStation } from '../../types';

const TOSS_CLIENT_KEY = "test_ck_DnyRpQWGrNlgeqqGLm5L3Kwv1M9E";

type FlowStep = 'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'CHARGING' | 'BILLING' | 'WAITING_EXIT' | 'SUCCESS';

interface ChargingFlowModalProps {
  station: ChargingStation;
  onClose: () => void;
  onComplete: (amount: number) => void;
  initialStep?: 'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'BILLING';
}

export const ChargingFlowModal: React.FC<ChargingFlowModalProps> = ({ 
  station, 
  onClose, 
  onComplete,
  initialStep = 'CONNECTION_PROMPT'
}) => {
  const { user, fetchUser } = useUserStore();
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [currentSoc, setCurrentSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);
  const [progress, setProgress] = useState(30);
  const [usedMileage, setUsedMileage] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    return sessionStorage.getItem('vium_last_order_id');
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isConnectorDisconnected, setIsConnectorDisconnected] = useState(false);
  
  const isConfirmingRef = useRef(false);
  const hasSyncedInitialBattery = useRef(false);
  const chargerIdRef = useRef<string | null>(null);

  // 0. 초기 충전기 ID 식별 (매핑 추적용)
  useEffect(() => {
    const myCharger = station.chargers.find(c => 
      (c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id)) ||
      (c.active_session_id && c.active_session_id === activeOrderId)
    );
    if (myCharger) {
      chargerIdRef.current = myCharger.charger_id;
    }
  }, [station, user, activeOrderId]);

  // 1. 하드웨어 연결 감시
  useEffect(() => {
    if (step !== 'CONNECTION_PROMPT') return;

    const interval = setInterval(async () => {
      try {
        const response = await stationService.getStations();
        if (response.success && response.data) {
          const currentStation = response.data.find(s => s.station_id === station.station_id);
          if (currentStation) {
            // [정밀 수술]: Number()를 사용하여 회원 ID 매핑 무결성 확보
            const charger = currentStation.chargers.find(c => 
              c.active_user_id && user?.user_id && 
              Number(c.active_user_id) === Number(user.user_id)
            );
            
            if (charger?.status === 'Charging' && !hasSyncedInitialBattery.current) {
              if (currentStation.current_battery !== undefined) {
                const initialSoc = Math.round(currentStation.current_battery);
                setCurrentSoc(initialSoc);
                setTargetSoc(Math.min(100, Math.max(initialSoc + 10, 80)));
                setProgress(initialSoc);
                hasSyncedInitialBattery.current = true;
              }
              setStep('CONFIRM_CHARGE');
              console.log("🔋 [Modal] Connection detected. Syncing Battery:", currentStation.current_battery);
            }
          }
        }
      } catch (e) {
        console.error("Hardware monitoring failed", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [station, user, step]);

  // 2. 실시간 배터리 동기화 (CHARGING 중 서버 데이터 덮어쓰기 방지)
  useEffect(() => {
    if (step === 'CHARGING' || step === 'BILLING' || step === 'WAITING_EXIT' || step === 'SUCCESS') return;
    if (station.current_battery !== undefined && !hasSyncedInitialBattery.current) {
      const val = Math.round(station.current_battery);
      setCurrentSoc(val);
      setProgress(val);
    }
  }, [station.current_battery, step]);

  // 3. 충전 시뮬레이션
  useEffect(() => {
    if (step === 'CHARGING') {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= targetSoc) {
            clearInterval(interval);
            
            if (Notification.permission === "granted") {
                new Notification(`✅ 목표 충전(${targetSoc}%) 도달`, {
                    body: `${user?.nickname || '회원'}님, 설정하신 목표치까지 충전이 완료되었습니다.`,
                    icon: '/favicon.svg'
                });
            }

            const chargedPercent = targetSoc - Math.round(currentSoc);
            const calculatedPrice = Math.max(0, chargedPercent * 340);
            setTotalPrice(calculatedPrice);
            setStep('BILLING');
            return targetSoc;
          }
          return p + 0.5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step, targetSoc, currentSoc, user]);

  // 4. 결제 완료 후 대기 상태 모니터링 (출차 감지)
  useEffect(() => {
    if (step !== 'WAITING_EXIT') return;

    const interval = setInterval(async () => {
      const response = await stationService.getStations();
      if (response.success && response.data) {
        const currentStation = response.data.find(s => s.station_id === station.station_id);
        if (currentStation) {
          // [중요 수술]: 세션 ID가 삭제될 수 있으므로 호기 ID로 직접 추적
          const charger = currentStation.chargers.find(c => c.charger_id === chargerIdRef.current);
          if (charger) {
            if (charger.status === 'Occupied' && !isConnectorDisconnected) {
              setIsConnectorDisconnected(true);
            }
            if (charger.status === 'Available') {
              setStep('SUCCESS');
              clearInterval(interval);
              
              // [UX 개선]: 출차가 확인되면 3초 후 자동으로 모달을 닫고 정산 완료
              setTimeout(() => {
                const finalReward = (targetSoc - Math.round(currentSoc)) * 10 + (targetSoc <= 80 ? 200 : 0) + 1000;
                onComplete(finalReward);
                onClose();
              }, 4000);
            }
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, station.station_id, targetSoc, currentSoc, onComplete, onClose, isConnectorDisconnected]);

  // 5. 결제 리다이렉트 복구 및 최종 승인
  useEffect(() => {
    if (initialStep === 'BILLING' && step === 'BILLING') {
      const params = new URLSearchParams(window.location.search);
      const paymentKey = params.get('paymentKey');
      const orderId = params.get('orderId');
      const amount = params.get('amount');

      if (paymentKey && orderId && amount) {
        if (isConfirmingRef.current) return;
        
        const confirmedKey = `vium_confirmed_${orderId}`;
        if (sessionStorage.getItem(confirmedKey)) {
            setStep('WAITING_EXIT');
            return;
        }

        isConfirmingRef.current = true;
        
        (async () => {
          setIsProcessingPayment(true);
          try {
            const res = await stationService.confirmPayment({
              paymentKey, orderId, amount: parseInt(amount)
            });
            if (res.success) {
              sessionStorage.setItem(confirmedKey, 'true');
              await fetchUser(); 
              setStep('WAITING_EXIT');
              window.history.replaceState({}, '', '/');
            }
          } catch (e) {
            console.error("Payment confirmation failed", e);
          } finally {
            setIsProcessingPayment(false);
          }
        })();
      }
    }
  }, [initialStep, step, fetchUser]);

  const handleStartChargingFlow = async () => {
    try {
      const myCharger = station.chargers.find(c => c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id));
      const response = await stationService.createPaymentSession({
        station_id: station.station_id,
        charger_id: myCharger?.charger_id || '',
        total_price: 0,
        used_mileage: 0,
        final_amount: 0,
        target_soc: targetSoc
      });

      if (response.success && response.data) {
        const orderId = response.data.order_id;
        setActiveOrderId(orderId);
        sessionStorage.setItem('vium_last_order_id', orderId);
        sessionStorage.setItem('vium_last_charging_id', station.station_id);
        setStep('CHARGING');
      }
    } catch (e) {
      console.error("Session creation failed", e);
      setStep('CHARGING');
    }
  };

  const handlePayment = async () => {
    if (!activeOrderId) return;
    setIsProcessingPayment(true);
    try {
      const chargedPercent = targetSoc - Math.round(currentSoc);
      const calculatedPrice = Math.max(0, chargedPercent * 340);
      const finalAmount = Math.max(0, calculatedPrice - usedMileage);

      const myCharger = station.chargers.find(c => c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id));

      await stationService.updatePaymentSession(activeOrderId, {
        station_id: station.station_id,
        charger_id: myCharger?.charger_id || '',
        total_price: calculatedPrice,
        used_mileage: usedMileage,
        final_amount: finalAmount,
        target_soc: targetSoc
      });

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: user?.email || "anonymous" });
      
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: finalAmount },
        orderId: activeOrderId,
        orderName: `${station.station_name} 충전 요금`,
        successUrl: window.location.origin + "/?payment_success=true",
        failUrl: window.location.origin + "/?payment_fail=true",
      });
    } catch (e) {
      console.error("Payment request failed", e);
      setIsProcessingPayment(false);
    }
  };

  const reward = useMemo(() => {
    const charged = Math.max(0, targetSoc - Math.round(currentSoc));
    const base = charged * 10;
    const eco = targetSoc <= 80 ? 200 : 0;
    const manner = 1000;
    return {
      base, eco, manner,
      total: base + eco + manner
    };
  }, [targetSoc, currentSoc]);

  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
        <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-blue-200 rotate-3">
          <Car size={48} className="text-white -rotate-3" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase mb-2">Goodbye!</h2>
        <p className="text-gray-500 font-bold mb-12 leading-relaxed">
          안전하게 출차가 확인되었습니다.<br/>
          오늘도 VIUM과 함께 쾌적한 드라이빙 되세요.
        </p>

        <div className="w-full max-w-sm bg-gray-50 rounded-[40px] border border-gray-100 p-8 mb-12 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-bold uppercase tracking-widest">기본 보상</span>
            <span className="font-black text-gray-900">+{reward.base}P</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-bold uppercase tracking-widest">에코 보너스</span>
            <span className="font-black text-indigo-600">+{reward.eco}P</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400 font-bold uppercase tracking-widest">매너 출차 보너스</span>
            <span className="font-black text-blue-600">+{reward.manner}P</span>
          </div>
          <div className="h-px bg-gray-200 my-4"></div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xl font-black text-gray-900 italic">적립 마일리지</span>
            <span className="text-3xl font-black text-blue-600">{reward.total.toLocaleString()} P</span>
          </div>
          <p className="text-[10px] text-gray-400 font-bold leading-relaxed text-left border-t border-gray-200 pt-3 px-1">
            * 기본 보상 및 매너 출차 보너스가<br/>포함된 금액입니다.
          </p>
        </div>

        <button 
          onClick={() => { onComplete(reward.total); onClose(); }}
          className="w-full max-w-sm py-6 bg-blue-600 text-white rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all hover:bg-blue-700"
        >
          완료
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-500 overflow-hidden lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[450px] lg:h-[90vh] lg:rounded-[40px] lg:shadow-2xl lg:border lg:border-gray-100">
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10">
        
        {step === 'CONNECTION_PROMPT' && (
          <div className="space-y-10 text-center animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mx-auto relative z-10 animate-bounce">
                <Plug2 size={64} className="text-blue-500" />
              </div>
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-10"></div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">커넥터를 연결해 주세요</h2>
              <p className="text-gray-500 font-bold leading-relaxed px-4">차량에 충전 커넥터를 연결하면<br/>자동으로 충전 설정을 시작합니다.</p>
            </div>
            <div className="pt-4">
              <button onClick={onClose} className="text-gray-400 font-black text-sm uppercase tracking-widest hover:text-gray-600 transition-colors">Cancel Connection</button>
            </div>
          </div>
        )}

        {step === 'CONFIRM_CHARGE' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center space-y-2">
              <BatteryFull size={48} className="text-indigo-500 mx-auto mb-4" />
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">차량 연결 확인됨</h2>
              <p className="text-gray-500 font-bold">충전 목표를 설정하고 시작 버튼을 눌러주세요.</p>
            </div>

            <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 space-y-8">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black uppercase text-xs tracking-widest">현재 배터리</span>
                <span className="text-2xl font-black text-indigo-600 italic">{Math.round(currentSoc)}%</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-xs tracking-widest">목표 충전량</span>
                  <span className="text-3xl font-black text-gray-900 italic">{targetSoc}%</span>
                </div>
                <input 
                  type="range" 
                  min={Math.max(Math.round(currentSoc), 10)} 
                  max="100" 
                  step="1"
                  value={targetSoc} 
                  onChange={(e) => setTargetSoc(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-black uppercase tracking-tighter px-1">
                  <span>{Math.max(Math.round(currentSoc), 10)}%</span>
                  <span>100% Full</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">예상 보상</span>
                  <span className="text-lg font-black text-blue-600">+{reward.total}P</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleStartChargingFlow}
              className="w-full py-6 bg-indigo-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Zap size={24} fill="currentColor" /> 충전 시작하기
            </button>
          </div>
        )}

        {step === 'CHARGING' && (
          <div className="space-y-12 text-center animate-in zoom-in-95 duration-500">
            <div className="relative w-64 h-64 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="128" cy="128" r="110" className="stroke-gray-100" strokeWidth="20" fill="none" />
                <circle cx="128" cy="128" r="110" className="stroke-blue-500 transition-all duration-300 ease-out" strokeWidth="20" fill="none" strokeDasharray="691.15" strokeDashoffset={691.15 * (1 - progress / 100)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Zap className="text-blue-500 mb-2 animate-pulse" size={32} />
                <span className="text-6xl font-black text-gray-900 tracking-tighter italic">{Math.round(progress)}%</span>
              </div>
            </div>
            
            <div className="bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 space-y-2">
              <p className="text-blue-600 text-sm font-black uppercase italic animate-pulse tracking-widest">Charging in progress...</p>
              <p className="text-gray-500 font-bold text-xs leading-relaxed break-keep">실시간 하드웨어 센서가 차량의 전압과 배터리 상태를 모니터링 중입니다.</p>
            </div>
          </div>
        )}

        {step === 'BILLING' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center space-y-1">
              <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">Billing</h3>
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Transaction Summary</p>
            </div>

            <div className="bg-gray-50 p-8 rounded-[40px] border-2 border-dashed border-gray-200 space-y-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-black uppercase tracking-widest">충전 진행</span>
                <span className="font-black text-gray-900 italic">{Math.round(currentSoc)}% ➔ {targetSoc}%</span>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-xs tracking-widest">마일리지 사용</span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={usedMileage}
                      onChange={(e) => setUsedMileage(Math.max(0, Math.min(user?.mileage_balance || 0, Number(e.target.value))))}
                      className="w-24 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-right font-black text-blue-600"
                    />
                    <span className="text-xs font-bold text-gray-400">P</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] font-bold text-gray-400">보유 잔액: {user?.mileage_balance.toLocaleString()}P</span>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-end">
                  <span className="text-gray-900 font-black text-xl uppercase italic">최종 결제 금액</span>
                  <span className="text-4xl font-black text-blue-600 tracking-tighter">{(totalPrice - usedMileage).toLocaleString()}원</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handlePayment} 
                disabled={isProcessingPayment}
                className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-gray-300"
              >
                {isProcessingPayment ? <Loader2 className="animate-spin" size={24} /> : <><CreditCard size={24} /> 결제 및 정산하기</>}
              </button>
              <p className="text-[10px] text-gray-400 text-center font-bold">결제 버튼 클릭 시 토스페이먼츠 안전 결제창으로 이동합니다.</p>
            </div>
          </div>
        )}

        {step === 'WAITING_EXIT' && (
          <div className="space-y-12 text-center animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mx-auto relative z-10 border border-green-100">
                <ShieldCheck size={64} className="text-green-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-10"></div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">결제 승인 완료!</h3>
              <div className={`p-6 rounded-[32px] border transition-all ${!isConnectorDisconnected ? 'bg-orange-50 border-orange-200 animate-pulse' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`font-black text-sm uppercase flex items-center justify-center gap-2 ${!isConnectorDisconnected ? 'text-orange-600' : 'text-blue-600'}`}>
                  {!isConnectorDisconnected ? <><Plug2 size={20} /> 차량에서 커넥터를 분리해 주세요</> : <><Car size={20} /> 안전하게 출차해 주세요</>}
                </p>
              </div>
            </div>
            
            <div className="w-full bg-gray-50 p-5 rounded-[24px] flex items-center justify-center gap-3 font-black text-gray-300 uppercase text-xs tracking-widest border border-gray-100 italic">
              <Loader2 className="animate-spin" size={14} /> H/W Sensor Live Monitoring
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
