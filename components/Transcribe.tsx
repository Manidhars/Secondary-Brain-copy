
import React, { useState, useEffect } from 'react';
import { Mic, Upload, FileText, Trash2, Search, Sparkles, Loader2, Play, Activity, Users, Clock } from 'lucide-react';
import { getTranscriptionLogs, addTranscriptionLog, deleteTranscriptionLog } from '../services/storage';
import { localTranscribe, transcriptSearch, diarizeTranscription } from '../services/llm';

const Transcribe: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    const data = getTranscriptionLogs();
    setLogs(data);
    setSearchResults(data);
  };

  useEffect(() => {
      const performSearch = async () => {
          if (!searchQuery.trim()) {
              setSearchResults(logs);
              setIsSearching(false);
              return;
          }
          setIsSearching(true);
          try {
              const results = await transcriptSearch.search(searchQuery, logs);
              setSearchResults(results.map(r => r.item));
          } catch(e) {
              setSearchResults(logs);
          } finally {
              setIsSearching(false);
          }
      };
      
      const timer = setTimeout(performSearch, 400);
      return () => clearTimeout(timer);
  }, [searchQuery, logs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsProcessing(true);
      try {
        const rawText = await localTranscribe(file);
        // Multi-speaker handling (Section 10.1)
        const segments = await diarizeTranscription(rawText);
        addTranscriptionLog(rawText, 'upload', segments);
        refresh();
      } catch (e) {
        console.error(e);
        alert("Transcription failed.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDelete = (id: string) => {
    deleteTranscriptionLog(id);
    refresh();
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-8 overflow-hidden">
      <header className="shrink-0">
        <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          <Mic className="text-indigo-400" /> Transcribe
        </h2>
        <p className="text-slate-400 mt-1">Local Whisper processing with cloud-assisted speaker diarization.</p>
      </header>

      {/* Upload/Action Zone */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
         <label className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[2.5rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group relative">
            <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            <div className="p-5 bg-slate-800 rounded-3xl mb-4 group-hover:scale-110 transition-transform shadow-lg">
               <Upload className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Ingest Audio Link</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">WAV, MP3 • AI Diarization Enabled</p>
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl z-20 flex flex-col items-center justify-center gap-4 rounded-[2.5rem] animate-in fade-in">
                 <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                 <div className="text-center">
                    <p className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-1">Processing Neural Map</p>
                    <p className="text-[10px] text-indigo-400 animate-pulse font-mono">Applying Diarization Logic...</p>
                 </div>
              </div>
            )}
         </label>

         <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-10 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="p-5 bg-red-500/10 rounded-3xl mb-4">
               <Activity className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Synchronous Capture</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Real-time Stream Analysis</p>
            <button className="mt-8 px-10 py-4 bg-slate-800 border border-slate-700 text-slate-400 rounded-2xl text-xs font-bold uppercase tracking-widest cursor-not-allowed">
               Protocol Restricted
            </button>
         </div>
      </div>

      {/* History Log */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
         <div className="relative shrink-0">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search episodic transcripts..."
              className="w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-5 pl-14 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-inner"
            />
         </div>

         <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-slate-700 pb-24">
            {searchResults.length === 0 ? (
               <div className="text-center py-32 text-slate-600 italic">No historical data available.</div>
            ) : (
               searchResults.map(log => (
                 <div key={log.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col gap-6 hover:border-slate-700 transition-all group shadow-sm">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-slate-800 rounded-2xl shadow-lg">
                             <FileText className="w-6 h-6 text-indigo-400" />
                          </div>
                          <div>
                             <h4 className="font-bold text-slate-100 uppercase text-[10px] tracking-[0.2em] mb-1">Signal Source: {log.source}</h4>
                             <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                                <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleString()}
                             </div>
                          </div>
                       </div>
                       <button onClick={() => handleDelete(log.id)} className="text-slate-700 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-5 h-5" />
                       </button>
                    </div>

                    {log.segments && log.segments.length > 0 ? (
                        /* FEATURE: Multi-speaker Handling (Section 10.1) */
                        <div className="space-y-4">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-3 h-3" /> Speaker Segments
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {log.segments.map((seg: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 p-4 bg-slate-950/30 rounded-2xl border border-slate-800/50 hover:border-indigo-500/20 transition-all">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-indigo-400">{seg.speaker.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">{seg.speaker}</div>
                                            <p className="text-sm text-slate-300 leading-relaxed italic">"{seg.text}"</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-300 leading-relaxed italic bg-slate-950/20 p-5 rounded-2xl border border-slate-800/50">"{log.content}"</p>
                    )}
                 </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
};

export default Transcribe;
