import React, { useState } from 'react';
import { X, Mail, Lock, User, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { login, signup, isLoading } = useUserStore();
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [adminCode, setAdminCode] = useState(''); // 관리자 코드 상태
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'LOGIN') {
      const formData = new FormData();
      formData.append('username', email); 
      formData.append('password', password);
      
      const success = await login(formData);
      if (success) onClose();
      else setError('이메일 또는 비밀번호가 잘못되었습니다.');
    } else {
      const result = await signup({ 
        email, 
        password, 
        nickname, 
        admin_code: adminCode || null 
      });
      if (result.success) {
        alert('회원가입이 완료되었습니다. 로그인해 주세요!');
        setMode('LOGIN');
      } else {
        setError(result.error || '회원가입에 실패했습니다.');
      }
    }

  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-500">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-2xl font-black text-gray-900 leading-tight">
              {mode === 'LOGIN' ? '환영합니다!' : 'VIUM 가입하기'}
            </h3>
            <p className="text-gray-400 text-xs mt-1 font-medium">
              {mode === 'LOGIN' ? '로그인하고 실명 리뷰를 남겨보세요.' : '스마트한 충전 생활의 시작.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-gray-300" size={18} />
              <input 
                type="email" 
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-300" size={18} />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
          </div>

          {mode === 'SIGNUP' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nickname</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-gray-300" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="멋진 닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Code</label>
                  <span className="text-[8px] font-bold text-blue-400 opacity-60">(관리자 전용)</span>
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-3.5 text-gray-300" size={18} />
                  <input 
                    type="password" 
                    placeholder="초대 코드가 있다면 입력"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-[10px] font-bold ml-1 animate-pulse">{error}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-4 rounded-3xl text-sm font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'LOGIN' ? '로그인' : '회원가입')}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}
            className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
          >
            {mode === 'LOGIN' ? '아직 계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
};
