
import React, { useState } from 'react';
import { MessageSquare, Brain, Users, Settings, Activity, Mic, LayoutDashboard, Menu, X, Home, Clock, History } from 'lucide-react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const navItems = [
    { id: View.DASHBOARD, label: 'Command Center', icon: LayoutDashboard },
    { id: View.TIMELINE, label: 'Episodic Timeline', icon: Clock },
    { id: View.HOME, label: 'Home Control', icon: Home },
    { id: View.CHAT, label: 'Neural Chat', icon: MessageSquare },
    { id: View.MEMORIES, label: 'Memory Bank', icon: Brain },
    { id: View.PEOPLE, label: 'People Graph', icon: Users },
    { id: View.AUDIT, label: 'Audit Replay', icon: History },
    { id: View.TRANSCRIBE, label: 'Transcribe', icon: Mic },
    { id: View.SETTINGS, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: View) => {
    setView(id);
    setIsOpen(false);
  };

  return (
    <>
    <button 
      onClick={() => setIsOpen(!isOpen)}
      className="md:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg text-slate-200 shadow-lg border border-slate-700"
    >
      {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
    </button>

    {isOpen && (
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        onClick={() => setIsOpen(false)}
      ></div>
    )}

    <div className={`
      fixed md:static inset-y-0 left-0 w-64 bg-slate-950/95 md:bg-slate-950/50 backdrop-blur-xl border-r border-slate-800 flex flex-col p-4 z-40 transition-transform duration-300
      ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      <div className="flex items-center gap-3 mb-10 px-2 pt-2 ml-10 md:ml-0">
        <div className="p-2 bg-indigo-500/20 rounded-lg">
           <Activity className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
           <h1 className="font-bold text-slate-100 leading-none">Secondary</h1>
           <span className="text-xs font-mono text-cyan-400">BRAIN OS v2.5</span>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-900/50 to-indigo-900/10 text-white border-l-2 border-indigo-400' 
                  : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-indigo-400' : 'group-hover:text-slate-300'} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-4 py-6 border-t border-slate-800/50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-indigo-500 animate-ping opacity-75"></div>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest">Neural Link Encrypted</span>
        </div>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
