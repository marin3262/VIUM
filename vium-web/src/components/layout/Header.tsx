import React, { useState } from 'react';
import { Zap, Bell, ShieldCheck, User } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationPanel } from '../reward/NotificationPanel';

interface HeaderProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onToggleAdmin }) => {
  const { user } = useUserStore();
  const { notifications } = useNotificationStore();
  const [isNotiOpen, setIsNotiOpen] = useState(false);

  // --- 역할 기반 배지 카운트 필터링 (격리 완료) ---
  const currentRole = isAdmin ? 'ADMIN' : 'USER';
  const unreadCount = notifications.filter(n => n.role === currentRole && !n.isRead).length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center gap-2 font-black text-2xl tracking-tight text-blue-600">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <Zap size={20} fill="currentColor" />
          </div>
          VIUM {isAdmin && <span className="text-gray-400 text-sm ml-1 font-black">ADMIN</span>}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleAdmin}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all ${
              isAdmin ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isAdmin ? <User size={14} /> : <ShieldCheck size={14} />}
            {isAdmin ? '사용자 모드' : '관리자 모드'}
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsNotiOpen(!isNotiOpen)}
              className={`p-2 rounded-full transition-colors relative ${isNotiOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} isAdminMode={isAdmin} />
          </div>
          
          <div className="hidden md:flex items-center gap-2 p-1 pr-3 hover:bg-gray-100 rounded-full transition-all cursor-pointer">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
              {user.name[0]}
            </div>
            <span className="text-sm font-medium">{user.name} 님</span>
          </div>
        </div>
      </div>
    </header>
  );
};
