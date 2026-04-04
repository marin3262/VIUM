import { useState, useCallback } from 'react';
import { useUserStore } from '../store/userStore';

export const useMileage = () => {
  const { points: globalPoints, setPoints, addActivity } = useUserStore();
  const [rewardToast, setRewardToast] = useState<{ show: boolean; amount: number }>({ show: false, amount: 0 });
  const [isCounting, setIsCounting] = useState(false);

  /**
   * 보상 애니메이션을 트리거합니다.
   * @param rewardAmount 적립할 마일리지 금액
   * @param reason (선택) 활동 로그에 기록될 이유. 제공 시 애니메이션 완료 후 로그가 기록됩니다.
   */
  const triggerRewardAnimation = useCallback((rewardAmount: number, reason?: string) => {
    setRewardToast({ show: true, amount: rewardAmount });
    setIsCounting(true);

    let current = globalPoints;
    const target = globalPoints + rewardAmount;
    const duration = 1000;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = rewardAmount / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setPoints(target);
        
        // 애니메이션 완료 시점에 활동 로그 기록 (중복 합산 방지)
        if (reason) {
          addActivity(rewardAmount, reason);
        }
        
        clearInterval(timer);
        setIsCounting(false);
      } else {
        setPoints(Math.floor(current));
      }
    }, stepTime);

    setTimeout(() => setRewardToast({ show: false, amount: 0 }), 4000);
  }, [globalPoints, setPoints, addActivity]);

  return {
    points: globalPoints,
    rewardToast,
    isCounting,
    triggerRewardAnimation
  };
};
