import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Memories from './components/Memories';
import People from './components/People';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import CommandPalette from './components/CommandPalette';
import { View, SystemHealth } from './types';
import { initializeStorage, runSystemBootCheck, getStorageUsage, getDecisionLogs, getQueue } from './services/storage';
import { Loader2, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isBooting, setIsBooting] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth>({
    status: 'nominal',
    storage_pressure: 0,
    avg_latency: 0,
    queue_depth: 0,
    boot_errors: [],
    anomalies_detected: 0,
    cognitive_saturation: 0
  });

  useEffect(() => {
     const boot = async () => {
         await initializeStorage();
         const errors = runSystemBootCheck();
         if (errors.length > 0) {
             setHealth(prev => ({ ...prev, status: 'safe_mode', boot_errors: errors }));
         }
         setIsBooting(false);
     };

     boot();

     const handleNavigate = (e: CustomEvent) => {
         setCurrentView(e.detail.view);
     };
     const handleKeyDown = (e: KeyboardEvent) => {
         if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
             e.preventDefault();
             setIsPaletteOpen(prev => !prev);
         }
     };

     window.addEventListener('navigate-view', handleNavigate as EventListener);
     window.addEventListener('keydown', handleKeyDown);

     const watchdogInterval = setInterval(() => {
        const usage = getStorageUsage();
        const logs = getDecisionLogs();
        const queue = getQueue();
        const recentLatency = logs.slice(0, 5).reduce((acc, l) => acc + (l.retrieval_latency_ms || 0), 0) / 5;
        
        setHealth(prev => ({
            ...prev,
            storage_pressure: usage.percent,
            avg_latency: recentLatency,
            queue_depth: queue.length,
            status: recentLatency > 2000 ? 'degraded' : 'nominal'
        }));
     }, 10000);

     return () => {
         window.removeEventListener('navigate-view', handleNavigate as EventListener);
         window.removeEventListener('keydown', handleKeyDown);
         clearInterval(watchdogInterval);
     };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD: return <Dashboard setView={setCurrentView} />;
      case View.CHAT: return <Chat />;
      case View.MEMORIES: return <Memories />;
      case View.PEOPLE: return <People />;
      case View.SETTINGS: return <Settings />;
      default: return <Dashboard setView={setCurrentView} />;
    }
  };

  if (isBooting) {
      return (
          <div className="h-screen w-full bg-black flex flex-col items-center justify-center gap-4 text-indigo-400">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Initializing Volatile Core</p>
          </div>
      );
  }

  return (
    <div className={`flex h-screen w-full bg-black text-slate-200 overflow-hidden font-sans`}>
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} setView={setCurrentView} />
      <Sidebar currentView={currentView} setView={setCurrentView} />
      <main className="flex-1 relative h-full w-full overflow-hidden bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none"></div>
        
        {/* Performance Alert (Production Grade: Less intrusive than a banner) */}
        {health.status === 'degraded' && (
            <div className="absolute top-4 right-4 z-50 animate-pulse bg-amber-500/10 border border-amber-500/30 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2">
                <Zap className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Latency High</span>
            </div>
        )}

        {renderView()}
      </main>
    </div>
  );
};

export default App;