
import React, { useState, useRef, useEffect } from 'react';
import { Send, Brain, Plus, Menu, Info, ImageIcon, Eye, MessageSquare, ShieldCheck } from 'lucide-react';
import { ChatMessage, ChatSession, View } from '../types';
import { consultBrain, speakText } from '../services/llm';
import { getMemories, getSessions, createSession, updateSession, getSettings, getDecisionLogs } from '../services/storage';

const Chat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showExplanationId, setShowExplanationId] = useState<string | null>(null);
  const [showAssumptionsId, setShowAssumptionsId] = useState<string | null>(null);
  const [isObserverMode, setIsObserverMode] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSessions(); }, []);
  const loadSessions = () => {
    const loaded = getSessions();
    setSessions(loaded);
    if (loaded.length > 0) { 
        setActiveSessionId(loaded[0].id); 
        setHistory(loaded[0].messages);
        setIsObserverMode(loaded[0].mode === 'observer');
    }
    else { handleNewChat(); }
  };

  const handleNewChat = (mode: 'active' | 'observer' = 'active') => {
    const newSession = createSession(mode);
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setHistory(newSession.messages);
    setIsObserverMode(mode === 'observer');
    setShowHistory(false);
  };

  useEffect(() => {
    if (activeSessionId) updateSession(activeSessionId, history);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, activeSessionId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now() };
    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      const memories = getMemories();
      const logs = getDecisionLogs();
      const avgLatency = logs.slice(0, 5).reduce((acc, l) => acc + (l.retrieval_latency_ms || 0), 0) / 5 || 0;
      const systemStatus = avgLatency > 1500 ? 'degraded' : 'nominal';

      const response = await consultBrain(
          history.map(h => ({ role: h.role, content: h.content })), 
          userMsg.content, 
          memories,
          isObserverMode,
          systemStatus 
      );
      
      const modelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: response.reply,
        timestamp: Date.now(),
        explanation: {
            reasoning: response.explanation || "General knowledge applied.",
            citations: response.citations || [],
            assumptions: response.assumptions || []
        }
      };
      setHistory(prev => [...prev, modelMsg]);
      if (voiceMode) speakText(response.reply);
    } catch (e) {
      setHistory(prev => [...prev, { id: crypto.randomUUID(), role: 'system', content: "Neural link failure.", timestamp: Date.now() }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full relative">
      <div className={`absolute inset-y-0 left-0 z-30 w-64 bg-slate-950/95 border-r border-slate-800 transition-transform md:relative md:transform-none ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-4">
           <div className="flex flex-col gap-2 mb-4">
               <button onClick={() => handleNewChat('active')} className="w-full flex items-center gap-2 bg-indigo-600 px-4 py-3 rounded-xl text-white font-medium"><Plus className="w-5 h-5" /> Active Brain</button>
               <button onClick={() => handleNewChat('observer')} className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl text-slate-300 font-medium"><Eye className="w-5 h-5" /> Observer Mode</button>
           </div>
           <div className="flex-1 overflow-y-auto space-y-2">
             {sessions.map(s => <div key={s.id} onClick={() => { setActiveSessionId(s.id); setHistory(s.messages); setIsObserverMode(s.mode === 'observer'); }} className={`p-3 rounded-xl cursor-pointer ${activeSessionId === s.id ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{s.title} {s.mode === 'observer' && '(ReadOnly)'}</div>)}
           </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        <div className="p-4 md:p-6 flex justify-between items-center z-10 shrink-0">
          <button onClick={() => setShowHistory(!showHistory)} className="md:hidden p-2 text-slate-400"><Menu /></button>
          <div className="flex items-center gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-slate-100 flex items-center gap-3"><Brain className="text-indigo-400" /> Jarvis</h2>
              {isObserverMode && <div className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold uppercase rounded">Observer View</div>}
          </div>
          <div className="text-xs text-indigo-400 animate-pulse font-bold">{isProcessing ? 'COMPUTING...' : 'STANDBY'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-thin scrollbar-thumb-slate-700" ref={scrollRef}>
          {history.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[90%] md:max-w-[75%] gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-5 py-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700'}`}>
                    <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                    {msg.explanation && (
                        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-4">
                            <button onClick={() => setShowExplanationId(showExplanationId === msg.id ? null : msg.id)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                <Info className="w-3 h-3" /> {showExplanationId === msg.id ? 'Hide Logic' : 'Priors'}
                            </button>
                            {msg.explanation.assumptions && msg.explanation.assumptions.length > 0 && (
                                <button onClick={() => setShowAssumptionsId(showAssumptionsId === msg.id ? null : msg.id)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                    <ShieldCheck className="w-3 h-3" /> Metacognition
                                </button>
                            )}
                        </div>
                    )}
                    {showExplanationId === msg.id && msg.explanation && (
                        <div className="mt-3 p-3 bg-black/30 rounded-xl animate-in slide-in-from-top-2">
                            <p className="text-[11px] text-slate-300 italic">"{msg.explanation.reasoning}"</p>
                        </div>
                    )}
                    {showAssumptionsId === msg.id && msg.explanation?.assumptions && (
                        <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-in slide-in-from-top-2">
                            <h4 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Assumptions based on history</h4>
                            <ul className="space-y-1">
                                {msg.explanation.assumptions.map((a, i) => (
                                    <li key={i} className="text-[10px] text-emerald-200 flex items-start gap-2">
                                        <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5" /> {a}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              </div>
            </div>
          ))}
          {isProcessing && <div className="flex justify-start animate-pulse"><div className="bg-slate-800 rounded-full px-4 py-2 text-xs text-indigo-400">Jarvis is thinking...</div></div>}
        </div>

        <div className="p-4 md:p-6 bg-slate-950/90 border-t border-slate-800 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3">
             <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex items-center px-4">
                <textarea 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder={isObserverMode ? "Ask as observer (Memory read-only)..." : "Ask Jarvis..."}
                    className="flex-1 bg-transparent py-4 text-sm outline-none resize-none h-12" 
                />
             </div>
             <button onClick={handleSend} disabled={isProcessing || !input.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl disabled:opacity-50"><Send className="w-5 h-5"/></button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
