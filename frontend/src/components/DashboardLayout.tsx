import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  MessageSquare, BookOpen, Layers, FileText, HelpCircle, 
  Calendar, BarChart2, User, LogOut, Sun, Moon, Search, Menu, X, Bell, Cpu
} from 'lucide-react';
import api from '../utils/api';
import { renderAvatar } from '../utils/avatar';


interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  globalSearchQuery,
  setGlobalSearchQuery,
  onSearchSubmit,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [notifications, setNotifications] = useState<any[]>([
    {
      id: '1',
      title: 'Welcome to StudyPilot!',
      message: 'Upload your study PDFs to start chatting, generating flashcards, and taking timed quizzes.',
      type: 'success',
      read: false,
      createdAt: new Date(),
      actionTab: 'documents'
    },
    {
      id: '2',
      title: 'Pro Tip: Spaced Repetition',
      message: 'Review your flashcard deck daily to enhance your long-term memory retention.',
      type: 'info',
      read: false,
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      actionTab: 'flashcards'
    }
  ]);

  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newNotif = customEvent.detail;
      setNotifications((prev) => [
        {
          id: Math.random().toString(),
          createdAt: new Date(),
          read: false,
          ...newNotif
        },
        ...prev
      ]);
    };
    window.addEventListener('addAppNotification', handleNewNotification);
    return () => window.removeEventListener('addAppNotification', handleNewNotification);
  }, []);

  // Fetch current model name
  useEffect(() => {
    api.get('/settings/status').then(res => {
      setCurrentModel(res.data.chat_model || '');
    }).catch(() => {});
  }, [activeTab]);

  const handleNotificationClick = (notif: any) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setNotificationsOpen(false);
    if (notif.actionTab) {
      setActiveTab(notif.actionTab);
    }
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const menuItems = [
    { id: 'chat', label: 'RAG Chat', icon: MessageSquare },
    { id: 'documents', label: 'My Documents', icon: BookOpen },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'notes', label: 'AI Study Notes', icon: FileText },
    { id: 'quiz', label: 'Quiz Generator', icon: HelpCircle },
    { id: 'planner', label: 'Study Planner', icon: Calendar },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-4 transition-colors duration-300">
        <div className="flex items-center gap-3 px-2 py-3 border-b border-border mb-6">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-violet-500/10">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-foreground to-foreground/85 dark:from-white dark:via-zinc-200 dark:to-zinc-400 bg-clip-text text-transparent">StudyPilot</span>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User Card & Action Footer */}
        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1">
            {renderAvatar(user?.avatar, user?.name, "h-9 w-9 text-sm")}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.subscriptionStatus} Plan</p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. Mobile Nav Backdrop & Slide-out */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`fixed top-0 bottom-0 left-0 w-64 bg-card border-r border-border p-4 z-50 md:hidden transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-2 py-3 border-b border-border mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-bold text-lg">StudyPilot</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1 mb-2">
            {renderAvatar(user?.avatar, user?.name, "h-8 w-8 text-xs")}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.subscriptionStatus}</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              toggleTheme();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            Toggle Theme
          </button>

          <button
            onClick={() => {
              logout();
              setMobileOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* 3. Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-card/65 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
          
          {/* Mobile hamburger menu */}
          <button 
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground md:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Search bar */}
          <form onSubmit={onSearchSubmit} className="flex-1 max-w-md ml-4 md:ml-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Search across documents, concepts, definitions..."
                className="w-full pl-9 pr-4 py-2 bg-secondary border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </form>

          {/* Action icons / Notifications */}
          <div className="flex items-center gap-3 relative">
            {/* Model indicator badge */}
            {currentModel && (
              <button
                onClick={() => setActiveTab('profile')}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-[11px] text-violet-600 dark:text-violet-400 font-medium hover:bg-violet-500/20 transition-all cursor-pointer"
                title="Click to change AI model"
              >
                <Cpu className="h-3.5 w-3.5" />
                {currentModel}
              </button>
            )}
            <button 
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-all relative"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {notificationsOpen && (
              <div className="absolute right-0 top-12 w-80 glass border border-border rounded-2xl shadow-2xl z-50 p-2 space-y-1 text-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
                  <span className="font-bold text-xs">Notifications</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleMarkAllRead}
                      className="text-[10px] text-primary hover:underline font-semibold"
                    >
                      Read All
                    </button>
                    <button 
                      onClick={handleClearAll}
                      className="text-[10px] text-muted-foreground hover:underline font-semibold"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-xs">
                      No new notifications.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full text-left p-3 transition-colors hover:bg-secondary/40 flex items-start gap-2.5 ${
                          !notif.read ? 'bg-primary/5 font-medium' : 'opacity-75'
                        }`}
                      >
                        <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${
                          notif.type === 'success' ? 'bg-emerald-500' :
                          notif.type === 'error' ? 'bg-red-500' :
                          notif.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{notif.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-normal mt-0.5 line-clamp-2">{notif.message}</p>
                          <span className="text-[9px] text-muted-foreground/60 block mt-1">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            
            <div className="md:flex hidden">
              {renderAvatar(user?.avatar, user?.name, "h-9 w-9 text-sm")}
            </div>
          </div>
        </header>

        {/* Content body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background/50">
          {children}
        </main>
      </div>
    </div>
  );
};
