
import React, { useState, useEffect } from 'react';
import { History, Search, Zap, AlertTriangle, ShieldCheck, Clock, Brain, User, ChevronRight, Activity, ShieldAlert, Database, Cpu } from 'lucide-react';
import { getDecisionLogs, getMemories, getStorageUsage } from '../services/storage';
import { DecisionLog, Memory } from '../types';

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<DecisionLog | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const storage = getStorageUsage();

  useEffect(() => {
    setLogs(getDecisionLogs());
    setMemories(getMemories());
  }, []);

  const getInjectedMemories = (ids: string[] = []) => {
      return memories.filter(m => ids.includes(m.id));
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-6 overflow-hidden">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
            <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <History className="text-indigo-400" /> Audit Replay
            </h2>
            <p className="text-slate-400 mt-1">Audit the influence of storage tiers and cognitive saturation on system logic.</p>
        </div>
        <div className="flex gap-2">
            <div className="bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3">
                <Database className="w-4 h-4 text-cyan-400" />
                <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Storage Pressure</span>
                    <span className="text-xs font-mono text-white">{storage.percent}% of 5MB</span>
                </div>
            </div>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Log List */}
          <div className="w-1/2 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-700 pb-20">
              {logs.map((log, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left p-6 rounded-3xl border transition-all flex flex-col gap-3 group ${selectedLog === log ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-500/20' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                  >
                      <div className="flex justify-between items-start">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedLog === log ? 'text-white' : 'text-slate-500'}`}>
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            {log.retrieval_latency_ms > 1500 && <Cpu className="w-3 h-3 text-amber-400" />}
                            {log.cognitive_load > 0.7 && <Activity className="w-3 h-3 text-red-400" />}
                          </div>
                      </div>
                      <p className={`text-sm font-medium leading-relaxed line-clamp-2 ${selectedLog === log ? 'text-white' : 'text-slate-200'}`}>"{log.query}"</p>
                      <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                          <div className={`flex items-center gap-1 ${selectedLog === log ? 'text-indigo-200' : 'text-indigo-400'}`}>
                            <Brain className="w-3 h-3" /> {log.memories_injected} Synapses
                          </div>
                          <div className={`flex items-center gap-1 ${selectedLog === log ? 'text-emerald-200' : 'text-emerald-400'}`}>
                            <Clock className="w-3 h-3" /> {log.retrieval_latency_ms}ms
                          </div>
                      </div>
                  </button>
              ))}
          </div>

          {/* REPLAY PANEL */}
          <div className="w-1/2 bg-slate-950/50 border border-slate-800 rounded-[2.5rem] p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pb-20">
              {selectedLog ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cognitive Load</span>
                              <div className="flex items-center justify-between">
                                  <span className="text-xl font-bold text-white">{Math.round(selectedLog.cognitive_load * 100)}%</span>
                                  <Activity className={`w-5 h-5 ${selectedLog.cognitive_load > 0.7 ? 'text-red-500' : 'text-emerald-500'}`} />
                              </div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${selectedLog.cognitive_load > 0.7 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${selectedLog.cognitive_load * 100}%` }}></div>
                              </div>
                          </div>
                          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Decision Latency</span>
                              <div className="flex items-center justify-between">
                                  <span className="text-xl font-bold text-white">{selectedLog.retrieval_latency_ms}ms</span>
                                  <Zap className={`w-5 h-5 ${selectedLog.retrieval_latency_ms > 1500 ? 'text-amber-500' : 'text-indigo-500'}`} />
                              </div>
                              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${selectedLog.retrieval_latency_ms > 1500 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (selectedLog.retrieval_latency_ms / 2000) * 100)}%` }}></div>
                              </div>
                          </div>
                      </div>

                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Input Stream</h3>
                          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                              <p className="text-slate-200 italic leading-relaxed">"{selectedLog.query}"</p>
                          </div>
                      </div>

                      {selectedLog.assumptions && selectedLog.assumptions.length > 0 && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
                              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                  <ShieldAlert className="w-4 h-4" /> Active Assumptions (Self-Reflective)
                              </h3>
                              <ul className="space-y-3">
                                  {selectedLog.assumptions.map((a, i) => (
                                      <li key={i} className="text-xs text-emerald-100/70 flex items-start gap-3 italic">
                                          <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 shrink-0" /> 
                                          <span>{a}</span>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                      )}

                      <div>
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 flex justify-between items-center">
                              Synaptic Influence
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full">{selectedLog.memories_injected} Nodes</span>
                          </h3>
                          <div className="space-y-4">
                              {getInjectedMemories(selectedLog.injected_ids).map(mem => (
                                  <div key={mem.id} className={`p-5 bg-slate-900/80 border rounded-2xl flex flex-col gap-2 transition-all ${mem.status === 'cold_storage' ? 'border-cyan-900/50' : 'border-indigo-500/20'}`}>
                                      <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                                          <span className={mem.status === 'cold_storage' ? 'text-cyan-400' : 'text-indigo-400'}>
                                              {mem.status === 'cold_storage' ? 'Tier 2: Cold' : 'Tier 1: Active'} • {mem.domain}
                                          </span>
                                          <span className="text-slate-500">Conf: {Math.round(mem.confidence * 100)}%</span>
                                      </div>
                                      <p className="text-sm text-slate-300 leading-relaxed">"{mem.content}"</p>
                                  </div>
                              ))}
                              {selectedLog.memories_injected === 0 && (
                                  <div className="text-center py-10 opacity-30 italic text-sm">
                                      Zero-retrieval state. Relying on model weights.
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Metacognitive Trace</h3>
                          <p className="text-xs text-slate-400 leading-relaxed font-mono bg-black/40 p-4 rounded-xl border border-slate-800">
                              {selectedLog.decision_reason}
                          </p>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-6 opacity-30">
                      <div className="relative">
                        <History className="w-16 h-16" />
                        <Activity className="w-6 h-6 absolute -bottom-2 -right-2 text-indigo-500 animate-pulse" />
                      </div>
                      <p className="text-sm font-bold uppercase tracking-widest text-center max-w-xs">Select an interaction to analyze neural load and data bias.</p>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};

export default AuditLog;
