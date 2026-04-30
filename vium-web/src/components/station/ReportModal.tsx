import React, { useState, useRef } from 'react';
import { X, Camera, Loader2, Check, CheckCircle2, Zap } from 'lucide-react';
import type { ChargingStation } from '../../types';
import { stationService } from '../../services/stationService';
import { useNotificationStore } from '../../store/notificationStore';

interface ReportModalProps {
  station: ChargingStation | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ station, onClose }) => {
  const { addNotification } = useNotificationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState('ConnectorBroken');
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!station) return null;

  const isValid = selectedChargerId && content.trim().length >= 10;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await stationService.submitReport({
        charger_id: selectedChargerId!,
        keyword: issueType,
        content: content.trim(),
        image: selectedFile || undefined
      });

      if (response.success) {
        addNotification({
          role: 'ADMIN',
          type: 'ERROR',
          title: '신규 고장 제보 접수 🚨',
          message: `${station.station_name}: ${selectedChargerId}번 충전기 고장 제보`
        });

        setIsSubmitted(true);
        setTimeout(() => {
          setIsSubmitted(false);
          onClose();
          setContent('');
          setSelectedChargerId(null);
          removePhoto();
        }, 2500);
      }
    } catch (error) {
      console.error('제보 제출 중 오류 발생:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const issues = [
    { id: 'ConnectorBroken', label: '커넥터 파손' },
    { id: 'ScreenOff', label: '화면 먹통' },
    { id: 'PaymentError', label: '결제 오류' },
    { id: 'Other', label: '기타 불편' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8 max-h-[90vh] overflow-y-auto no-scrollbar">
        {!isSubmitted ? (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900">현장 고장 제보</h3>
                <p className="text-red-500 text-xs font-bold mt-1">{station.station_name}</p>
              </div>
              <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500 transition-colors" disabled={isSubmitting}><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {/* 1. 충전기 선택 */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">몇 번 충전기인가요?</p>
                <div className="grid grid-cols-3 gap-2">
                  {station.chargers?.map((charger) => {
                    if (!charger?.charger_id) return null;
                    
                    const displayId = charger.charger_id.includes('_') 
                      ? charger.charger_id.split('_').pop() 
                      : charger.charger_id;

                    return (
                      <button
                        key={charger.charger_id}
                        onClick={() => setSelectedChargerId(charger.charger_id)}
                        className={`py-3 rounded-2xl text-[11px] font-black border transition-all flex flex-col items-center gap-1 ${
                          selectedChargerId === charger.charger_id 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                            : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-blue-200'
                        }`}
                      >
                        <Zap size={14} className={selectedChargerId === charger.charger_id ? 'text-blue-200' : 'text-blue-500'} />
                        {displayId}호기
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 문제 유형 선택 */}
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

              {/* 3. 상세 내용 및 사진 미리보기 */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">상세 내용 (10자 이상)</p>
                
                {previewUrl && (
                  <div className="relative w-full h-40 rounded-3xl overflow-hidden border border-gray-100 mb-2 group">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={removePhoto}
                      className="absolute top-3 right-3 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="현장 상황을 자세히 알려주세요."
                  disabled={isSubmitting}
                  className="w-full h-24 bg-gray-50 border border-gray-100 rounded-[24px] p-4 text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none"
                ></textarea>
              </div>

              <div className="flex gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className={`flex-1 py-4 rounded-3xl text-sm font-black flex items-center justify-center gap-2 transition-all ${selectedFile ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {selectedFile ? <><Check size={18} /> 완료</> : <><Camera size={18} /> 사진</>}
                </button>
                <button 
                  disabled={!isValid || isSubmitting}
                  onClick={handleSubmit}
                  className="flex-[2] bg-red-600 disabled:bg-gray-200 text-white py-4 rounded-3xl text-sm font-black shadow-xl transition-all active:scale-95"
                >
                  {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> 전송 중</> : '제보 등록하기'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center text-center animate-in zoom-in">
            <div className="bg-green-100 p-6 rounded-full text-green-600 mb-6"><CheckCircle2 size={48} /></div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">제보 접수 완료!</h3>
            <p className="text-gray-400 text-sm">신속히 확인하여 조치하겠습니다.<br />보상은 관리자 승인 후 지급됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};
