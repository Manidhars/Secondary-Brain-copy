
import React, { useEffect, useState } from 'react';
import { Database, Users, Zap, Clock, Activity, Cpu, Wifi, RefreshCw, Wind, Sparkles } from 'lucide-react';
import { getMemories, getPeople, getReminders, getPlaces, getQueue, getSmartDevices, getSettings, getStorageUsage, getDecisionLogs } from '../services/storage';
import { Reminder, View, QueueItem, SmartDevice } from '../types';

interface DashboardProps {
  setView: (view: View) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const [stats, setStats] = useState({ memories: 0, people: 0, tasks: 0, places: 0, cold: 0, insights: 0 });
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [smartDevices, setSmartDevices] = useState<SmartDevice[]>([]);
  const [healthInfo, setHealthInfo] = useState({ latency: 0, storage: 0, cognitiveLoad: 0 });
  const settings = getSettings();

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    const mems = getMemories();
    const logs = getDecisionLogs();
    const usage = getStorageUsage();
    
    setStats({
      memories: mems.filter(m => m.status === 'active' && m.type !== 'insight').length,
      people: getPeople().length,
      tasks: getReminders().filter(r => !r.completed).length,
      places: getPlaces().length,
      cold: mems.filter(m => m.status === 'cold_storage').length,
      insights: mems.filter(m => m.type === 'insight').length
    });
    setReminders(getReminders().filter(r => !r.completed)); 
    setSmartDevices(getSmartDevices());
    setHealthInfo({
        latency: logs.slice(0, 5).reduce((acc, l) => acc + (l.retrieval_latency_ms || 0), 0) / 5 || 0,
        storage: usage.percent,
        cognitiveLoad: logs[0]?.cognitive_load || 0
    });
  };

  const isHighLoad = healthInfo.latency > 1500;
  const isHighCognitive = healthInfo.cognitiveLoad > 0.8;

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full overflow-y-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-20 scrollbar-thin scrollbar-thumb-slate-700">
      
      <div className="flex flex-col lg:flex-row justify-between items-start gap-6 border-b border-slate-800 pb-8">
        <div className="flex-1">
          <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-cyan-300 tracking-tight mb-2">
            Brain OS Nominal.
          </h1>
          <div className="flex flex-wrap gap-2 mt-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  <Cpu className="w-3 h-3"/> {isHighLoad ? 'Hardware Throttled' : 'Full Precision'}
              </div>
              {settings.sync_enabled && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/20 border border-indigo-500/30 text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      <RefreshCw className="w-3 h-3 animate-spin-slow"/> Cloud Bridge Active
                  </div>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:w-auto">
            <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 w-full lg:w-64 flex flex-col gap-3">
                 <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                     <span>Synaptic Load</span>
                     <span className={isHighLoad ? 'text-amber-400' : 'text-indigo-400'}>{Math.round(healthInfo.latency)}ms</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className={`h-full bg-indigo-500 transition-all ${isHighLoad ? 'w-[85%] bg-amber-500' : 'w-[45%]'}`}></div>
                 </div>
                 <p className="text-[10px] text-slate-600 leading-tight">
                     {isHighLoad ? "Hardware Alert: Slashing recall depth." : "Hardware throughput optimal."}
                 </p>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800 w-full lg:w-64 flex flex-col gap-3">
                 <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                     <span>Cognitive Load</span>
                     <span className={isHighCognitive ? 'text-amber-400' : 'text-emerald-400'}>{Math.round(healthInfo.cognitiveLoad * 100)}%</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className={`h-full bg-emerald-500 transition-all`} style={{ width: `${healthInfo.cognitiveLoad * 100}%` }}></div>
                 </div>
                 <p className="text-[10px] text-slate-600 leading-tight">
                     {isHighCognitive ? "Context Saturated: Metacognition risk high." : "Cognitive buffer stable."}
                 </p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button onClick={() => setView(View.MEMORIES)} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group">
                <div className="text-indigo-400 mb-4"><Database className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{stats.memories}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Synapses</div>
            </button>
            <button onClick={() => setView(View.MEMORIES)} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group border-emerald-500/20">
                <div className="text-emerald-400 mb-4"><Sparkles className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{stats.insights}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Insights</div>
            </button>
            <button onClick={() => setView(View.MEMORIES)} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group">
                <div className="text-cyan-400 mb-4"><Wind className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{stats.cold}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Cold Tier</div>
            </button>
            <button onClick={() => setView(View.PEOPLE)} className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group">
                <div className="text-pink-400 mb-4"><Users className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{stats.people}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Entities</div>
            </button>
            <button className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group">
                <div className="text-amber-400 mb-4"><Activity className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{stats.tasks}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Tasks</div>
            </button>
            <button className="bg-slate-900/50 border border-slate-800 p-6 rounded-[2rem] text-left transition-all group">
                <div className="text-slate-400 mb-4"><Clock className="w-8 h-8" /></div>
                <div className="text-3xl font-bold text-white mb-1">{Math.round(getQueue().length)}</div>
                <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Queue</div>
            </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
              <h3 className="font-bold text-white mb-6">Autonomous Activity</h3>
              <div className="space-y-4">
                  {getQueue().slice(0, 3).map(q => (
                      <div key={q.id} className="flex justify-between items-center p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                          <div className="flex items-center gap-3">
                              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin-slow" />
                              <span className="text-sm text-slate-200 capitalize">{q.type} Optimization</span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{q.status}</span>
                      </div>
                  ))}
                  {getQueue().length === 0 && <p className="text-xs text-slate-500 text-center py-4 italic">No background tasks active. Cognitive pathways optimized.</p>}
              </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8">
              <h3 className="font-bold text-white mb-6">Neural Heatmap</h3>
              <div className="grid grid-cols-10 gap-1 opacity-50">
                  {getMemories().slice(0, 50).map((m, i) => (
                      <div key={i} className={`aspect-square rounded-[2px] ${m.status === 'cold_storage' ? 'bg-slate-800' : m.type === 'insight' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                  ))}
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
