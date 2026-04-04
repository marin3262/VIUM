import React, { useState } from 'react';
import { Star, X, CheckCircle2, ThumbsUp, Loader2 } from 'lucide-react';
import { ChargingStation } from '../../types';
import { useStationStore } from '../../store/stationStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useMileage } from '../../hooks/useMileage';
import { stationService } from '../../services/stationService';

interface ReviewModalProps {
  station: ChargingStation | null;
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ station, onClose }) => {
  const { addReview } = useStationStore();
  const { addNotification } = useNotificationStore();
  const { triggerRewardAnimation } = useMileage();
  
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!station) return null;

  const isValid = content.trim().length >= 5;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 1. 서버에 리뷰 제출
      const response = await stationService.submitReview(station.id, {
        rating,
        content: content.trim()
      });

      if (response.success && response.data && response.data.review) {
        // [핵심] 서버가 생성한 '진짜 리뷰 객체'를 그대로 스토어에 전달
        // 이 객체 안에는 서버의 user_name(최정환)과 실제 content가 들어있음
        addReview(station.id, response.data.review);

        // 2. 보상 애니메이션 실행
        triggerRewardAnimation(100, `리뷰 작성 보상: ${station.name}`);
        
        // 3. 시스템 알림
        addNotification({
          role: 'USER',
          type: 'SUCCESS',
          title: '리뷰 보너스 적립! 🎁',
          message: '소중한 리뷰 감사합니다. 100P가 적립되었습니다.'
        });

        setIsSubmitted(true);
        setTimeout(() => { 
          setIsSubmitted(false); 
          onClose(); 
          setContent('');
          setRating(5);
        }, 2500);
      } else {
        console.error('서버 응답 형식이 올바르지 않습니다.', response);
      }
    } catch (error) {
      console.error('리뷰 제출 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8">
        {!isSubmitted ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900">현장 리뷰 남기기</h3>
                <p className="text-gray-400 text-xs mt-1">{station.name}</p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-gray-300 hover:text-gray-500 transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => !isSubmitting && setRating(star)} 
                    className="transition-transform active:scale-90"
                    disabled={isSubmitting}
                  >
                    <Star 
                      size={36} 
                      className={star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-200'} 
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="예: 주차가 편해요, 주변에 카페가 있어요 등"
                  disabled={isSubmitting}
                  className="w-full h-32 bg-gray-50 border border-gray-100 rounded-[24px] p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none disabled:opacity-50"
                ></textarea>
              </div>

              <button 
                disabled={!isValid || isSubmitting}
                onClick={handleSubmit}
                className="w-full bg-blue-600 disabled:bg-gray-200 text-white py-5 rounded-3xl text-lg font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    리뷰 등록 중...
                  </>
                ) : (
                  '리뷰 등록 및 보상 받기'
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center text-center animate-in zoom-in">
            <div className="bg-green-100 p-6 rounded-full text-green-600 mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">리뷰 등록 완료!</h3>
            <p className="text-gray-400 text-sm">소중한 피드백 감사합니다.<br />마일리지가 지급되었습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
