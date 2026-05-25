import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useNotificationStore } from '../../store/notificationStore';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { login, signup, checkNickname, sendVerificationEmail, verifyEmailCode } = useUserStore();
  const { addNotification } = useNotificationStore();

  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [verificationCode, setVerificationCode] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);

  // 비밀번호 유효성 검사 (8자 이상, 영문/숫자/특수문자 포함)
  const isPasswordValid = password.length >= 8 && 
    /[A-Za-z]/.test(password) && 
    /[0-9]/.test(password) && 
    /[@$!%*#?&]/.test(password);

  const isPasswordMatch = mode === 'SIGNUP' ? password === passwordConfirm : true;

  // 이메일 타이머 로직
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timer]);

  const handleSendCode = async () => {
    if (!email.includes('@')) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsSendingCode(true);
    try {
      const result = await sendVerificationEmail(email);
      if (result.success) {
        setTimer(180); // 3분
        addNotification({ role: 'USER', type: 'INFO', title: '인증 메일 발송', message: '입력하신 메일로 인증 코드를 보냈습니다.' });
      } else {
        addNotification({ role: 'USER', type: 'ERROR', title: '발송 실패', message: result.error || '메일 발송에 실패했습니다.' });
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsVerifyingCode(true);
    try {
      const result = await verifyEmailCode(email, verificationCode);
      if (result.success) {
        setIsEmailVerified(true);
        setTimer(0);
        addNotification({ role: 'USER', type: 'SUCCESS', title: '이메일 인증 완료', message: '이메일 소유권이 확인되었습니다.' });
      } else {
        addNotification({ role: 'USER', type: 'ERROR', title: '인증 실패', message: result.error || '코드가 올바르지 않습니다.' });
      }
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleCheckNickname = async () => {
    if (nickname.length < 2) return;
    setIsCheckingNickname(true);
    try {
      const result = await checkNickname(nickname);
      if (result.success) {
        setIsNicknameChecked(true);
        addNotification({ role: 'USER', type: 'SUCCESS', title: '닉네임 확인', message: '사용 가능한 닉네임입니다.' });
      } else {
        addNotification({ role: 'USER', type: 'ERROR', title: '닉네임 중복', message: result.error || '이미 존재하는 닉네임입니다.' });
      }
    } finally {
      setIsCheckingNickname(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'LOGIN') {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);
        const success = await login(formData);
        if (success) {
          addNotification({
            role: 'USER',
            type: 'SUCCESS',
            title: '로그인 성공 🎉',
            message: '비움 스마트 관제 시스템에 오신 것을 환영합니다.'
          });
          onClose();
        } else {
          throw new Error('이메일 또는 비밀번호를 확인해주세요.');
        }
      } else {
        if (!isEmailVerified) throw new Error('이메일 인증이 필요합니다.');
        if (!isNicknameChecked) throw new Error('닉네임 중복 확인이 필요합니다.');
        if (!isPasswordValid) throw new Error('비밀번호 규칙을 확인해주세요.');
        if (!isPasswordMatch) throw new Error('비밀번호가 일치하지 않습니다.');

        const result = await signup({
          email,
          password,
          nickname,
          admin_invite_code: inviteCode || undefined
        });
        
        if (result.success) {
          addNotification({
            role: 'USER',
            type: 'SUCCESS',
            title: '회원가입 완료! ✨',
            message: '가입 축하 포인트 1,000P가 지급되었습니다.'
          });
          setMode('LOGIN');
        } else {
          throw new Error(result.error || '회원가입에 실패했습니다.');
        }
      }
    } catch (err: any) {
      addNotification({
        role: 'USER',
        type: 'ERROR',
        title: mode === 'LOGIN' ? '로그인 실패' : '가입 실패',
        message: err.message || '요청을 처리할 수 없습니다.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-8 md:p-10 space-y-8">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">
                {mode === 'LOGIN' ? 'Welcome Back' : 'Join Vium'}
              </h2>
              <p className="text-sm text-gray-400 font-bold">
                {mode === 'LOGIN' ? '회원 정보를 입력하여 로그인하세요.' : '새로운 미래 모빌리티 생태계에 참여하세요.'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 이메일 & 인증 영역 */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setIsEmailVerified(false); }}
                  placeholder="이메일 주소"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white pl-14 pr-24 py-4 rounded-3xl text-sm font-bold transition-all outline-none"
                  required
                  disabled={isEmailVerified && mode === 'SIGNUP'}
                />
                {mode === 'SIGNUP' && !isEmailVerified && (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={isSendingCode || timer > 0}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-gray-900 text-white rounded-2xl text-[10px] font-black hover:bg-black disabled:bg-gray-200 transition-all"
                  >
                    {isSendingCode ? <Loader2 size={14} className="animate-spin" /> : timer > 0 ? `${Math.floor(timer/60)}:${(timer%60).toString().padStart(2,'0')}` : '인증발송'}
                  </button>
                )}
                {isEmailVerified && mode === 'SIGNUP' && (
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 text-green-500 flex items-center gap-1 font-black text-[10px]">
                    <CheckCircle2 size={14} /> 인증됨
                  </div>
                )}
              </div>

              {mode === 'SIGNUP' && timer > 0 && !isEmailVerified && (
                <div className="relative animate-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="인증코드 6자리"
                    className="w-full bg-blue-50 border-2 border-blue-200 pl-14 pr-24 py-4 rounded-3xl text-sm font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={isVerifyingCode || verificationCode.length !== 6}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-2xl text-[10px] font-black hover:bg-blue-700 disabled:bg-blue-300 transition-all"
                  >
                    확인
                  </button>
                </div>
              )}
            </div>

            {/* 닉네임 영역 (가입 시에만) */}
            {mode === 'SIGNUP' && (
              <div className="relative group animate-in slide-in-from-top-2">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setIsNicknameChecked(false); }}
                  placeholder="닉네임 (2자 이상)"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 pl-14 pr-24 py-4 rounded-3xl text-sm font-bold transition-all outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={handleCheckNickname}
                  disabled={isCheckingNickname || nickname.length < 2 || isNicknameChecked}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 rounded-2xl text-[10px] font-black transition-all ${
                    isNicknameChecked ? 'bg-green-50 text-green-600' : 'bg-gray-900 text-white hover:bg-black'
                  }`}
                >
                  {isCheckingNickname ? <Loader2 size={14} className="animate-spin" /> : isNicknameChecked ? '확인완료' : '중복확인'}
                </button>
              </div>
            )}

            {/* 비밀번호 영역 */}
            <div className="space-y-2">
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-blue-600 focus:bg-white pl-14 pr-5 py-4 rounded-3xl text-sm font-bold transition-all outline-none"
                  required
                />
              </div>

              {mode === 'SIGNUP' && (
                <>
                  <div className="px-5 space-y-1">
                    <p className={`text-[10px] font-bold ${password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>• 8자 이상 입력</p>
                    <p className={`text-[10px] font-bold ${isPasswordValid ? 'text-green-500' : 'text-gray-400'}`}>• 영문, 숫자, 특수문자 조합</p>
                  </div>
                  <div className="relative group">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600">
                      <ShieldCheck size={18} />
                    </div>
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="비밀번호 확인"
                      className={`w-full bg-gray-50 border-2 pl-14 pr-5 py-4 rounded-3xl text-sm font-bold transition-all outline-none ${
                        passwordConfirm ? (isPasswordMatch ? 'border-green-200' : 'border-red-200') : 'border-transparent'
                      }`}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            {mode === 'SIGNUP' && (
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                  <ShieldCheck size={18} />
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="관리자 초대 코드 (선택)"
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 pl-14 pr-5 py-4 rounded-3xl text-sm font-bold transition-all outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (mode === 'SIGNUP' && (!isEmailVerified || !isNicknameChecked || !isPasswordValid || !isPasswordMatch))}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white py-5 rounded-[32px] text-lg font-black shadow-xl shadow-blue-100 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {mode === 'LOGIN' ? '시작하기' : '회원가입 완료'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 text-center border-t border-gray-50">
            <button
              onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
              className="text-sm font-black text-gray-400 hover:text-blue-600 transition-colors italic uppercase tracking-wider"
            >
              {mode === 'LOGIN' ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
