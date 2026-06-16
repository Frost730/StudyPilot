import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthPage } from './pages/AuthPage';
import { DashboardLayout } from './components/DashboardLayout';
import { ChatPage } from './pages/ChatPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { NotesPage } from './pages/NotesPage';
import { QuizPage } from './pages/QuizPage';
import { PlannerPage } from './pages/PlannerPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ProfilePage } from './pages/ProfilePage';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Handle global search in navigation navbar
  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchQuery.trim()) return;

    // Direct user to RAG chat panel
    setActiveTab('chat');
    
    // We can dispatch a custom event to notify ChatPage to search
    const event = new CustomEvent('globalSearchTriggered', {
      detail: { query: globalSearchQuery.trim() }
    });
    window.dispatchEvent(event);
    
    setGlobalSearchQuery('');
  };

  // If session is validating on load
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-zinc-400">
        <Loader2 className="animate-spin h-10 w-10 text-primary mb-3" />
        <p className="text-sm font-semibold">Initializing study assistant...</p>
      </div>
    );
  }

  // Auth Guard Gate
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      globalSearchQuery={globalSearchQuery}
      setGlobalSearchQuery={setGlobalSearchQuery}
      onSearchSubmit={handleGlobalSearch}
    >
      {activeTab === 'chat' && <ChatPage />}
      {activeTab === 'documents' && <DocumentsPage />}
      {activeTab === 'flashcards' && <FlashcardsPage />}
      {activeTab === 'notes' && <NotesPage />}
      {activeTab === 'quiz' && <QuizPage />}
      {activeTab === 'planner' && <PlannerPage />}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'profile' && <ProfilePage />}
    </DashboardLayout>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
