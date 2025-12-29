import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import Memories from './components/Memories';
import People from './components/People';
import Transcribe from './components/Transcribe';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import PhotoFrame from './components/PhotoFrame'; 
import HomeControl from './components/HomeControl'; 
import Timeline from './components/Timeline';
import AuditLog from './components/AuditLog';
import ProcessingUnit from './components/ProcessingUnit'; 
import CommandPalette from './components/CommandPalette';
import { View, SystemHealth } from './types';
import { isApiConfigured } from './services/llm';
import { initializeStorage, runSystemBootCheck, getStorageUsage, getDecisionLogs, getQueue } from './services/storage';
import { AlertTriangle, ShieldAlert, Activity, Database, Zap, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isConfigured, setIsConfigured] = useState(isApiConfigured());
  const [isBooting, setIsBooting] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  // Fix: Added missing 'cognitive_saturation' property to comply with SystemHealth interface
  const [health, setHealth] = useState<SystemHealth>({
    status: 'nominal',
    storage_pressure: 0,
    avg_latency: 0,
    queue_depth: 0,
    boot_errors: [],
    anomalies_detected: 0,
    cognitive_saturation: 0
  });
  const [viewProps, setViewProps] = useState<any>({});

  useEffect(() => {
     const boot = async () => {
         // Step 1: Initialize storage (handles decryption if enabled)
         await initializeStorage();
         
         // Step 2: Perform safety checks
         const errors = runSystemBootCheck();
         if (errors.length > 0) {
             setHealth(prev => ({ ...prev, status: 'safe_mode', boot_errors: errors }));
         }
         
         setIsBooting(false);
     };

     boot();

     const handleSettingsChange = () => setIsConfigured(isApiConfigured());
     const handleNavigate = (e: CustomEvent) => {
         const { view, props } = e.detail;
         setViewProps(props || {});
         setCurrentView(view);
     };
     const handleKeyDown = (e: KeyboardEvent) => {
         if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
             e.preventDefault();
             setIsPaletteOpen(prev => !prev);
         }
     };

     window.addEventListener('settings-changed', handleSettingsChange);
     window.addEventListener('navigate-view', handleNavigate as EventListener);
     window.addEventListener('keydown', handleKeyDown);

     const watchdogInterval = setInterval(() => {
        const usage = getStorageUsage();
        const logs = getDecisionLogs();
        const queue = getQueue();
        const recentLatency = logs.slice(0, 5).reduce((acc, l) => acc + (l.retrieval_latency_ms || 0), 0) / 5;
        const anomalyCount = logs.filter(l => l.anomaly_score && l.anomaly_score > 0.6).length;
        const cogSaturation = logs[0]?.cognitive_load || 0;

        setHealth(prev => ({
            ...prev,
            storage_pressure: usage.percent,
            avg_latency: recentLatency,
            queue_depth: queue.length,
            anomalies_detected: anomalyCount,
            cognitive_saturation: cogSaturation,
            status: (usage.percent > 90 || recentLatency > 2000 || anomalyCount > 3) ? 'degraded' : (prev.status === 'safe_mode' ? 'safe_mode' : 'nominal')
        }));
     }, 10000);

     return () => {
         window.removeEventListener('settings-changed', handleSettingsChange);
         window.removeEventListener('navigate-view', handleNavigate as EventListener);
         window.removeEventListener('keydown', handleKeyDown);
         clearInterval(watchdogInterval);
     };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD: return <Dashboard setView={setCurrentView} />;
      case View.HOME: return <HomeControl />;
      case View.CHAT: return <Chat />;
      case View.TIMELINE: return <Timeline />;
      case View.MEMORIES: return <Memories />;
      case View.PEOPLE: return <People />;
      case View.TRANSCRIBE: return <Transcribe />;
      case View.SETTINGS: return <Settings />;
      case View.AUDIT: return <AuditLog />;
      case View.PHOTO_FRAME: return <PhotoFrame query={viewProps.query || ''} onClose={() => setCurrentView(View.DASHBOARD)} />;
      default: return <Dashboard setView={setCurrentView} />;
    }
  };

  if (isBooting) {
      return (
          <div className="h-screen w-full bg-[#09090b] flex flex-col items-center justify-center gap-4 text-indigo-400">
              <Loader2 className="w-12 h-12 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Initializing Synaptic Pathways...</p>
          </div>
      );
  }

  return (
    <div className={`flex h-screen w-full bg-[#09090b] text-slate-200 overflow-hidden font-sans ${health.status === 'safe_mode' ? 'border-4 border-red-500/20' : ''}`}>
      {health.status !== 'safe_mode' && <ProcessingUnit />} 
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} setView={setCurrentView} />
      {currentView !== View.PHOTO_FRAME && <Sidebar currentView={currentView} setView={setCurrentView} />}
      <main className="flex-1 relative h-full w-full">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#09090b] to-[#050505] -z-10"></div>
        
        {/* SAFE MODE ALERT */}
        {health.status === 'safe_mode' && (
            <div className="absolute top-0 left-0 right-0 bg-red-600/90 text-white px-6 py-2 flex items-center justify-between z-[100] backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Safe Mode: Storage IO Restricted</span>
                </div>
                <button onClick={() => window.location.reload()} className="text-[10px] font-bold bg-white/20 px-3 py-1 rounded">Re-Boot</button>
            </div>
        )}

        {/* PERFORMANCE HUD */}
        {(health.status === 'degraded' || health.avg_latency > 1500) && (
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <div className="bg-amber-500/10 border border-amber-500/30 backdrop-blur-md rounded-xl p-2 flex items-center gap-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-200">{Math.round(health.avg_latency)}ms</span>
                </div>
            </div>
        )}

        {renderView()}
      </main>
    </div>
  );
};

export default App;