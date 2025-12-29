
import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, User, MapPin, Brain, Zap, Home, Mic, LayoutDashboard } from 'lucide-react';
import { View, Memory, Person, Place, SmartDevice } from '../types';
import { getMemories, getPeople, getPlaces, getSmartDevices } from '../services/storage';

interface CommandPaletteProps {
  setView: (view: View) => void;
  isOpen: boolean;
  onClose: () => void;
}

type ResultItem = {
  id: string;
  type: 'navigation' | 'memory' | 'person' | 'place' | 'device';
  title: string;
  subtitle?: string;
  action: () => void;
  icon: any;
};

const CommandPalette: React.FC<CommandPaletteProps> = ({ setView, isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      search('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          results[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const search = (q: string) => {
    const lowerQ = q.toLowerCase();
    const newResults: ResultItem[] = [];

    // 1. Navigation Actions
    const navs: { label: string, view: View, icon: any }[] = [
        { label: 'Go to Dashboard', view: View.DASHBOARD, icon: LayoutDashboard },
        { label: 'Go to Chat', view: View.CHAT, icon: Brain },
        { label: 'Go to Memories', view: View.MEMORIES, icon: Brain },
        { label: 'Go to People', view: View.PEOPLE, icon: User },
        { label: 'Go to Home Control', view: View.HOME, icon: Home },
        { label: 'Transcribe Audio', view: View.TRANSCRIBE, icon: Mic },
    ];

    navs.forEach(nav => {
        if (nav.label.toLowerCase().includes(lowerQ)) {
            newResults.push({
                id: nav.label,
                type: 'navigation',
                title: nav.label,
                icon: nav.icon,
                action: () => setView(nav.view)
            });
        }
    });

    // 2. Data Search
    if (q.trim()) {
        const memories = getMemories();
        const people = getPeople();
        const places = getPlaces();
        const devices = getSmartDevices();

        // People
        people.forEach(p => {
            if (p.name.toLowerCase().includes(lowerQ) || p.relation.toLowerCase().includes(lowerQ)) {
                newResults.push({
                    id: p.id,
                    type: 'person',
                    title: p.name,
                    subtitle: p.relation,
                    icon: User,
                    action: () => setView(View.PEOPLE) // Ideally jump to specific person
                });
            }
        });

        // Devices
        devices.forEach(d => {
            if (d.name.toLowerCase().includes(lowerQ) || d.room.toLowerCase().includes(lowerQ)) {
                newResults.push({
                    id: d.id,
                    type: 'device',
                    title: d.name,
                    subtitle: `${d.room} • ${d.status}`,
                    icon: Zap,
                    action: () => setView(View.HOME)
                });
            }
        });

        // Places
        places.forEach(p => {
            if (p.name.toLowerCase().includes(lowerQ) || p.location.toLowerCase().includes(lowerQ)) {
                newResults.push({
                    id: p.id,
                    type: 'place',
                    title: p.name,
                    subtitle: p.location,
                    icon: MapPin,
                    action: () => setView(View.MEMORIES) // Jump to Navigator via Memories tab logic
                });
            }
        });

        // Memories (Limit to 3)
        let memCount = 0;
        for (const m of memories) {
            if (memCount >= 3) break;
            if (m.content.toLowerCase().includes(lowerQ)) {
                newResults.push({
                    id: m.id,
                    type: 'memory',
                    title: m.content.slice(0, 50) + "...",
                    subtitle: new Date(m.createdAt).toLocaleDateString(),
                    icon: Brain,
                    action: () => setView(View.MEMORIES)
                });
                memCount++;
            }
        }
    }

    setResults(newResults.slice(0, 10)); // Limit total results
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
      setSelectedIndex(0);
      search(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
            <div className="flex items-center gap-3 p-4 border-b border-slate-800">
                <Command className="w-5 h-5 text-slate-500" />
                <input 
                    ref={inputRef}
                    type="text" 
                    value={query}
                    onChange={handleChange}
                    placeholder="Type a command or search..."
                    className="flex-1 bg-transparent outline-none text-lg text-white placeholder:text-slate-600"
                />
                <button onClick={onClose} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">ESC</button>
            </div>
            
            <div className="overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
                {results.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No matching neural pathways found.</p>
                    </div>
                ) : (
                    results.map((result, index) => {
                        const Icon = result.icon;
                        const isSelected = index === selectedIndex;
                        return (
                            <div 
                                key={result.id + index}
                                onClick={() => { result.action(); onClose(); }}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                            >
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-800'}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{result.title}</div>
                                    {result.subtitle && <div className={`text-xs truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>{result.subtitle}</div>}
                                </div>
                                {isSelected && <ArrowRight className="w-4 h-4 animate-in slide-in-from-left-2" />}
                            </div>
                        );
                    })
                )}
            </div>
            
            <div className="p-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between px-4">
                <span>Select <kbd className="bg-slate-800 px-1 rounded">↑↓</kbd></span>
                <span>Confirm <kbd className="bg-slate-800 px-1 rounded">↵</kbd></span>
            </div>
        </div>
    </div>
  );
};

export default CommandPalette;
