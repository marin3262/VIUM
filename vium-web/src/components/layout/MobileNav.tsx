import React from 'react';
import { Zap, MapPin, Coins, User } from 'lucide-react';

export const MobileNav: React.FC = () => {
  return (
    <nav className="md:hidden bg-white/90 backdrop-blur-xl border-t border-gray-100 fixed bottom-0 w-full flex justify-around py-4 px-2 z-40">
      <button className="flex flex-col items-center gap-1 text-blue-600">
        <Zap size={22} fill="currentColor" />
        <span className="text-[10px] font-bold">홈</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-gray-300">
        <MapPin size={22} />
        <span className="text-[10px] font-bold">지도</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-gray-300">
        <Coins size={22} />
        <span className="text-[10px] font-bold">마일리지</span>
      </button>
      <button className="flex flex-col items-center gap-1 text-gray-300">
        <User size={22} />
        <span className="text-[10px] font-bold">내정보</span>
      </button>
    </nav>
  );
};
