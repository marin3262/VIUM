import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle2, MessageSquare, Camera, Loader2, Check } from 'lucide-react';
import { ChargingStation } from '../../types';
import { stationService } from '../../services/stationService';
import { useNotificationStore } from '../../store/notificationStore';

interface ReportModalProps {
  station: ChargingStation | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ station, onClose }) => {
  const { addNotification } = useNotificationStore();
  const [issueType, setIssueType] = useState('ConnectorBroken');
  const [content, setContent] = useState('');
  const [isPhotoAttached, setIsPhotoAttached] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!station) return null;

  const isValid = content.trim().length >= 10;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await stationService.submitReport({
        stationId: station.id,
        issueType,
        content: content.trim()
      });

      if (response.success) {
        // [중요] 관리자용 알림 즉시 생성
        addNotification({
          role: 'ADMIN',
          type: 'ERROR',
          title: '신규 고장 제보 접수 🚨',
          message: `${station.name}: ${content.substring(0, 20)}...`
        });

        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          onClose();
          setContent('');
          setIsPhotoAttached(false);
          setIssueType('ConnectorBroken');
        }, 2500);
      }
    } catch (error) {
      console.error('제보 제출 중 오류 발생:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const issues = [
    { id: 'ConnectorBroken', label: '충전 커넥터 파손' },
    { id: 'ScreenOff', label: '화면 꺼짐/먹통' },
    { id: 'PaymentError', label: '결제 오류' },
    { id: 'ParkingBlocked', label: '일반차 점유' },
    { id: 'Other', label: '기타 불편사항' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8">
        {!isSubmitted ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900">현장 고장 제보</h3>
                <p className="text-red-500 text-xs font-bold mt-1">{station.name}</p>
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
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">어떤 문제가 있나요?</p>
                <div className="grid grid-cols-2 gap-2">
                  {issues.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => setIssueType(issue.id)}
                      className={`py-3 px-4 rounded-2xl text-xs font-bold border transition-all ${
                        issueType === issue.id 
                          ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                          : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-red-100'
                      }`}
                    >
                      {issue.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {content.trim().length > 0 && content.trim().length < 10 
                    ? `최소 10자 이상 입력해주세요 (${content.trim().length}/10)` 
                    : '상세 내용'}
                </p>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="현장 상황을 자세히 알려주시면 큰 도움이 됩니다."
                  disabled={isSubmitting}
                  className="w-full h-32 bg-gray-50 border border-gray-100 rounded-[24px] p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none disabled:opacity-50"
                ></textarea>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPhotoAttached(!isPhotoAttached)}
                  className={`flex-1 py-4 rounded-3xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                    isPhotoAttached 
                      ? 'bg-green-50 text-green-600 border border-green-200' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {isPhotoAttached ? (
                    <><Check size={18} /> 사진 첨부됨</>
                  ) : (
                    <><Camera size={18} /> 사진 첨부</>
                  )}
                </button>
                <button 
                  disabled={!isValid || isSubmitting}
                  onClick={handleSubmit}
                  className="flex-[2] bg-red-600 disabled:bg-gray-200 text-white py-4 rounded-3xl text-sm font-black shadow-xl shadow-red-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      전송 중...
                    </>
                  ) : (
                    '제보 등록하기'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center text-center animate-in zoom-in">
            <div className="bg-green-100 p-6 rounded-full text-green-600 mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">제보 접수 완료!</h3>
            <p className="text-gray-400 text-sm">신속히 확인하여 조치하겠습니다.<br />확인 완료 시 보상이 지급됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
