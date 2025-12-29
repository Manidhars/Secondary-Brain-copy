
import React, { useState, useEffect } from 'react';
import { Brain, Search, ShieldAlert, History, Ghost, ShieldCheck, AlertTriangle, ShieldCheck as ShieldCheckIcon, TrendingDown, Lock, Unlock, Check, X, Inbox, Pin, Info, Activity, Layers, RefreshCcw } from 'lucide-react';
import { getMemories, deleteMemory, updateMemory, approveMemory } from '../services/storage';
import { memorySearch } from '../services/llm';
import { Memory } from '../types';

const Memories: React.FC = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [filter, setFilter] = useState('');
  const [searchResults, setSearchResults] = useState<Memory[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'insights'>('all');

  useEffect(() => { refresh(); }, []);
  const refresh = () => {
    const mems = getMemories();
    setMemories(mems);
  };

  useEffect(() => {
    const performSearch = async () => {
        let results = memories;
        if (activeTab === 'pending') {
            results = results.filter(m => m.isPendingApproval);
        } else if (activeTab === 'insights') {
            results = results.sort((a,b) => b.accessCount - a.accessCount);
        } else {
            results = results.filter(m => !m.isPendingApproval).sort((a,b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
        }
        
        if (filter.trim()) {
            const searchData = await memorySearch.search(filter, results);
            results = searchData.map(r => r.item);
        }
        setSearchResults(results);
    };
    performSearch();
  }, [filter, memories, activeTab]);

  const handleToggleLock = (id: string, current: boolean) => {
    updateMemory(id, { isLocked: !current });
    refresh();
  };

  const handleTogglePin = (id: string, current: boolean) => {
    updateMemory(id, { isPinned: !current });
    refresh();
  };

  const handleApprove = (id: string) => {
      approveMemory(id);
      refresh();
  };

  const handleDelete = (id: string) => {
      deleteMemory(id);
      refresh();
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-6 overflow-hidden">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Brain className="text-indigo-400" /> Memory Bank
          </h2>
          <p className="text-slate-400 mt-1">Neural fragments with Bayesian confidence state.</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
            <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>Active</button>
            <button onClick={() => setActiveTab('pending')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'pending' ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                <Inbox className="w-3 h-3" /> Inbox {memories.filter(m => m.isPendingApproval).length > 0 && `(${memories.filter(m => m.isPendingApproval).length})`}
            </button>
            <button onClick={() => setActiveTab('insights')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'insights' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
                <Activity className="w-3 h-3" /> Neural Heatmap
            </button>
        </div>
      </header>

      {activeTab === 'insights' ? (
          <div className="flex-1 overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-700">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 lg:grid-cols-12 gap-2">
                  {memories.map(m => {
                      const activityLevel = Math.min(100, (m.accessCount / 10) * 100);
                      const confidenceColor = m.status === 'contradictory' ? 'bg-red-600' : m.confidence > 0.8 ? 'bg-emerald-500' : m.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500';
                      return (
                          <div 
                            key={m.id} 
                            className={`aspect-square rounded-md ${confidenceColor} transition-all cursor-help relative group`}
                            style={{ opacity: 0.2 + (activityLevel / 125) }}
                          >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white p-3 rounded-xl border border-slate-700 text-[10px] hidden group-hover:block z-50 shadow-2xl">
                                  <div className="font-bold mb-1 flex justify-between">
                                      <span>{m.entity}</span>
                                      {m.status === 'contradictory' && <ShieldAlert className="w-3 h-3 text-red-400" />}
                                  </div>
                                  <div className="opacity-70 line-clamp-2 italic mb-2">"{m.content}"</div>
                                  <div className="flex justify-between border-t border-slate-800 pt-1">
                                      <span>Access: {m.accessCount}</span>
                                      <span>Conf: {Math.round(m.confidence * 100)}%</span>
                                  </div>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      ) : (
          <>
            <div className="relative shrink-0">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Neural search..." className="w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-6 pl-14 text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>

            <div className="flex-1 overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {searchResults.map(mem => (
                        <div key={mem.id} className={`bg-slate-900/40 border p-6 rounded-[2rem] flex flex-col gap-4 transition-all group relative ${mem.status === 'contradictory' ? 'border-red-500/50 bg-red-500/5' : mem.isPinned ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-indigo-500/30'}`}>
                            
                            <div className="absolute top-6 right-6 flex gap-2">
                                <button 
                                    onClick={() => handleTogglePin(mem.id, !!mem.isPinned)}
                                    className={`p-2 rounded-full transition-all ${mem.isPinned ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 opacity-0 group-hover:opacity-100'}`}
                                    title={mem.isPinned ? "Unpin Memory" : "Pin Memory"}
                                >
                                    <Pin className={`w-4 h-4 ${mem.isPinned ? 'fill-current' : ''}`} />
                                </button>
                                
                                <button 
                                    onClick={() => handleToggleLock(mem.id, !!mem.isLocked)}
                                    className={`p-2 rounded-full transition-all ${mem.isLocked ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500 opacity-0 group-hover:opacity-100'}`}
                                    title={mem.isLocked ? "Memory Locked" : "Lock Memory"}
                                >
                                    {mem.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="flex justify-between items-start pr-12">
                                <div className="flex flex-wrap gap-2">
                                    <div className="px-3 py-1 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-bold uppercase">{mem.domain}</div>
                                    {mem.status === 'contradictory' && (
                                        <div className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                                            <ShieldAlert className="w-3 h-3" /> Contradictory
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <p className="text-slate-200 text-sm leading-relaxed italic bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">"{mem.content}"</p>
                            
                            {mem.metadata?.validation_reason && (
                                <div className="p-3 bg-red-900/10 rounded-xl border border-red-500/10">
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">
                                        <AlertTriangle className="w-3 h-3" /> Conflict Detected
                                    </div>
                                    <p className="text-[11px] text-red-200/70 leading-tight">{mem.metadata.validation_reason}</p>
                                </div>
                            )}

                            {mem.justification && !mem.metadata?.validation_reason && (
                                <div className="p-3 bg-indigo-900/10 rounded-xl border border-indigo-500/10 group/just">
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                                        <Info className="w-3 h-3" /> System Justification
                                    </div>
                                    <p className="text-[11px] text-slate-400 leading-tight">{mem.justification}</p>
                                </div>
                            )}

                            {mem.isPendingApproval && (
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => handleApprove(mem.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><Check className="w-3 h-3" /> Confirm</button>
                                    <button onClick={() => handleDelete(mem.id)} className="flex-1 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"><X className="w-3 h-3" /> Discard</button>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <div className={mem.status === 'contradictory' ? 'text-red-400' : 'text-indigo-400'}>
                                    Bayesian Conf: {Math.round(mem.confidence * 100)}%
                                </div>
                                <div className="text-slate-600">Pulse: {mem.accessCount}x</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </>
      )}
    </div>
  );
};

export default Memories;
