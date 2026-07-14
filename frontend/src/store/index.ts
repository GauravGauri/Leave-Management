import { create } from 'zustand';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: any[];
  unreadNotificationsCount: number;
  chatMessages: ChatMessage[];
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setNotifications: (notifications: any[]) => void;
  addNotification: (notification: any) => void;
  markNotificationsAsRead: () => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  notifications: [],
  unreadNotificationsCount: 0,
  chatMessages: [
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your AI HR Assistant. I can help you check your leave balance, see company holidays, explain leave rules, or recommend optimal dates for your next vacation. Ask me anything!",
      timestamp: new Date()
    }
  ],
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    }
    return { theme: nextTheme };
  }),
  setTheme: (theme) => set(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    return { theme };
  }),
  setNotifications: (notifications) => set({
    notifications,
    unreadNotificationsCount: notifications.filter((n) => !n.isRead).length
  }),
  addNotification: (notification) => set((state) => {
    const updated = [notification, ...state.notifications];
    return {
      notifications: updated,
      unreadNotificationsCount: updated.filter((n) => !n.isRead).length
    };
  }),
  markNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    unreadNotificationsCount: 0
  })),
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [
      ...state.chatMessages,
      {
        ...msg,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date()
      }
    ]
  })),
  clearChat: () => set({ chatMessages: [] })
}));
