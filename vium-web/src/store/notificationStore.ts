import { create } from 'zustand';

export interface ViumNotification {
  id: string;
  role: 'USER' | 'ADMIN'; // 수신 대상 추가
  type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface NotificationState {
  notifications: ViumNotification[];
  addNotification: (notification: Omit<ViumNotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (role: 'USER' | 'ADMIN') => void;
  deleteNotification: (id: string) => void;
  clearAll: (role: 'USER' | 'ADMIN') => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  addNotification: (newNoti) => {
    const notification: ViumNotification = {
      ...newNoti,
      id: `noti-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };
    set((state) => ({ notifications: [notification, ...state.notifications] }));

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(newNoti.title, { body: newNoti.message });
    }
  },

  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
  })),

  markAllAsRead: (role) => set((state) => ({
    notifications: state.notifications.map(n => n.role === role ? { ...n, isRead: true } : n)
  })),

  deleteNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearAll: (role) => set((state) => ({
    notifications: state.notifications.filter(n => n.role !== role)
  })),
}));
