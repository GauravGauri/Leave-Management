'use client';

import React, { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useUIStore } from '@/store';
import api from '@/lib/axios';
import AiChatbot from './AiChatbot';
import {
  Menu, X, Sun, Moon, Bell, LogOut, LayoutDashboard, Calendar, FileSpreadsheet,
  Users, ShieldAlert, BadgeInfo, Settings, ChevronDown, Sparkles, CheckSquare, History
} from 'lucide-react';

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles?: string[];
}

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Leaves & Apply', href: '/leaves', icon: BadgeInfo },
  { name: 'Leave Calendar', href: '/calendar', icon: Calendar },
  { name: 'Approvals Workflow', href: '/leaves/approvals', icon: CheckSquare, roles: ['Manager', 'HR Admin', 'Super Admin'] },
  { name: 'Employee Directory', href: '/admin/employees', icon: Users, roles: ['HR Admin', 'Super Admin'] },
  { name: 'Policy Editor', href: '/admin/policies', icon: Settings, roles: ['HR Admin', 'Super Admin'] },
  { name: 'Reports & Analytics', href: '/reports', icon: FileSpreadsheet, roles: ['Manager', 'HR Admin', 'Super Admin'] },
  { name: 'Audit Logs', href: '/admin/audit', icon: ShieldAlert, roles: ['Super Admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const {
    sidebarOpen, toggleSidebar,
    theme, toggleTheme,
    notifications, setNotifications, addNotification, markNotificationsAsRead, unreadNotificationsCount
  } = useUIStore();

  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Load Initial Notifications & LocalStorage Token Setup
  useEffect(() => {
    if (session?.user?.accessToken) {
      localStorage.setItem('token', session.user.accessToken as string);
      
      // Fetch user notifications
      api.get('/settings/notifications')
        .then(res => setNotifications(res.data))
        .catch(err => console.error('Error loading notifications:', err));
    }
  }, [session, setNotifications]);

  // Setup Socket Connection
  useEffect(() => {
    if (!session?.user?.id) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socketConnection = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    socketConnection.on('connect', () => {
      console.log('[Socket] Connected to server.');
      socketConnection.emit('join', session.user?.id);
    });

    socketConnection.on('notification', (data) => {
      // Append new notification in state
      addNotification({
        _id: Math.random().toString(),
        title: data.title,
        message: data.message,
        isRead: false,
        createdAt: new Date()
      });
      // Standard browser alert if needed, or web notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, { body: data.message });
      }
    });

    setSocket(socketConnection);

    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      socketConnection.disconnect();
    };
  }, [session, addNotification]);

  const handleMarkNotificationsRead = async () => {
    try {
      await api.post('/settings/notifications/read');
      markNotificationsAsRead();
      setNotifDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('token');
    await signOut({ callbackUrl: '/login' });
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-muted-foreground">Synchronizing credentials...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const userRole = (session.user as any).role || 'Employee';

  // Filter sidebar options based on role permissions
  const filteredSidebarItems = sidebarItems.filter(
    item => !item.roles || item.roles.includes(userRole)
  );

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${theme}`}>
      <div className="flex h-full w-full bg-background text-foreground">
        
        {/* ==========================================
            SIDEBAR NAVIGATION PANEL
           ========================================== */}
        <aside
          className={`glass border-r border-border h-full flex flex-col transition-all duration-300 z-30 ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
          {/* Brand Header */}
          <div className="flex h-16 items-center px-4 justify-between border-b border-border/60">
            <Link href="/dashboard" className="flex items-center space-x-2.5 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 shadow-md">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              {sidebarOpen && (
                <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
                  Keka HRMS
                </span>
              )}
            </Link>
          </div>

          {/* Links Area */}
          <nav className="flex-1 space-y-1.5 p-3 overflow-y-auto">
            {filteredSidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition duration-150 ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Signout Link */}
          <div className="p-3 border-t border-border/60">
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {sidebarOpen && <span>Logout Workspace</span>}
            </button>
          </div>
        </aside>

        {/* ==========================================
            MAIN CONTENT AREA
           ========================================== */}
        <div className="flex-1 flex flex-col overflow-hidden h-full">
          
          {/* Top Navbar */}
          <header className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-border bg-card/65 backdrop-blur-md z-20">
            {/* Toggle Sidebar & Title */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Workspaces / {pathname.replace('/', '').toUpperCase() || 'DASHBOARD'}
              </span>
            </div>

            {/* Profile Dropdown, Theme, Notifications */}
            <div className="flex items-center space-x-4.5">
              
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="rounded-xl p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition"
              >
                {theme === 'light' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
              </button>

              {/* Real-time Notifications Bell */}
              <div className="relative">
                <button
                  onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
                  className="relative rounded-xl p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {notifDropdownOpen && (
                  <div className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-border bg-card shadow-xl p-2.5 z-50 text-xs overflow-hidden glass">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2 font-semibold px-1">
                      <span>Latest Alerts</span>
                      {unreadNotificationsCount > 0 && (
                        <button
                          onClick={handleMarkNotificationsRead}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4 text-[11px]">No new notifications.</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            className={`p-2 rounded-xl border ${
                              n.isRead ? 'border-transparent bg-transparent' : 'border-primary/10 bg-primary/5'
                            }`}
                          >
                            <h4 className="font-semibold text-[11px] text-foreground">{n.title}</h4>
                            <p className="text-muted-foreground text-[10px] leading-snug mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center space-x-2 rounded-xl p-1 hover:bg-muted transition"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-teal-400 flex items-center justify-center text-xs font-bold text-white uppercase shadow-inner">
                    {session.user?.name?.substring(0, 2) || 'US'}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card shadow-xl p-1 z-50 text-xs glass">
                    <div className="p-2.5 border-b border-border/40">
                      <p className="font-bold text-foreground">{session.user?.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{session.user?.email}</p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold">
                        {userRole}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center px-3 py-2 text-destructive hover:bg-destructive/10 rounded-lg transition text-left mt-1"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* Subpage Contents Router View */}
          <main className="flex-1 overflow-y-auto p-8 h-full bg-background">
            {children}
          </main>
        </div>

        {/* HR Assistant Chatbot */}
        <AiChatbot />
      </div>
    </div>
  );
}
