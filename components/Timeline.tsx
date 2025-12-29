import React, { useEffect, useState } from 'react';
import { Clock, History, Loader2, Sparkles, Calendar, Layers, Activity, Brain, TrendingUp } from 'lucide-react';
import { getMemories } from '../services/storage';
import { reconstructEpisodicTimeline } from '../services/llm';
import { Memory } from '../types';

const Timeline: React.FC = () => {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [viewMode, setViewMode] = useState<'episodic' | 'evolution'>('evolution');
  const [evolutionData, setEvolutionData] = useState<Memory[]>([]);

  useEffect(() => {
    handleReconstruction();
    setEvolutionData(getMemories().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  const handleReconstruction = async () => {
    setIsReconstructing(true);
    try {
        const memories = getMemories();
        const timeline = await reconstructEpisodicTimeline(memories);
        // Ensure episodes is always an array
        setEpisodes(Array.isArray(timeline) ? timeline : []);
    } catch (e) {
        console.error("Reconstruction handler error:", e);
        setEpisodes([]);
    } finally {
        setIsReconstructing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-6 overflow-hidden">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div>
                <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                    <Clock className="text-indigo-400" /> Neural Timeline
                </h2>
                <p className="text-slate-400 mt-1">Stitched narrative of atomic fragments and their evolution.</p>
            </div>
            <div className="flex gap-3">
                <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-800">
                    <button 
                        onClick={() => setViewMode('evolution')} 
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'evolution' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                        Raw Evolution
                    </button>
                    <button 
                        onClick={() => setViewMode('episodic')} 
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'episodic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
                    >
                        AI Narrative
                    </button>
                </div>
                {viewMode === 'episodic' && (
                    <button 
                        onClick={handleReconstruction}
                        disabled={isReconstructing}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg"
                    >
                        {isReconstructing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Refresh Narrative
                    </button>
                )}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-700 pb-20 relative">
            {viewMode === 'evolution' ? (
                <div className="space-y-6 ml-4 md:ml-12 border-l-2 border-slate-800 py-4 pl-8 md:pl-16">
                    {evolutionData.map((mem, idx) => (
                        <div key={mem.id} className="relative group animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 20}ms` }}>
                            <div className={`absolute -left-[calc(2rem+1px)] md:-left-[calc(4rem+1px)] top-4 w-4 h-4 rounded-full border-2 z-10 ${mem.distilled_by === 'manual' ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-indigo-500 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`}></div>
                            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl hover:border-slate-700 transition-all flex flex-col gap-3">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> {new Date(mem.createdAt).toLocaleString()}
                                    </div>
                                    <div className="px-2 py-0.5 rounded-full bg-slate-800">{mem.type}</div>
                                </div>
                                <p className="text-slate-200 text-sm italic leading-relaxed">"{mem.content}"</p>
                                {mem.justification && (
                                    <div className="flex items-start gap-2 text-[10px] text-indigo-400 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                                        <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
                                        <span>Stored because: {mem.justification}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : isReconstructing ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400">
                    <Activity className="w-12 h-12 animate-pulse" />
                    <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Scanning Neural Net...</p>
                </div>
            ) : (!episodes || episodes.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full opacity-30 italic">
                    <History className="w-16 h-16 mb-4" />
                    <p>No episodic narrative available. Try adding more memories.</p>
                </div>
            ) : (
                <div className="space-y-12 ml-4 md:ml-12 border-l-2 border-slate-800 py-8 pl-8 md:pl-16">
                    {Array.isArray(episodes) && episodes.map((ep, idx) => (
                        <div key={idx} className="relative group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="absolute -left-[calc(2rem+1px)] md:-left-[calc(4rem+1px)] top-4 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 z-10 group-hover:scale-125 transition-transform shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                            
                            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] hover:border-indigo-500/30 transition-all shadow-xl">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{ep.episode_name}</h3>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                        <Calendar className="w-3 h-3" /> {ep.date_range}
                                    </div>
                                </div>
                                <p className="text-slate-300 leading-relaxed text-sm md:text-base italic mb-6">
                                    "{ep.summary}"
                                </p>
                                <div className="flex items-center gap-4 pt-6 border-t border-slate-800/50">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase">
                                        <Layers className="w-3 h-3" /> {ep.related_memories_count} Fragments Stitched
                                    </div>
                                    <div className="h-1 w-24 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, ep.related_memories_count * 10)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export default Timeline;