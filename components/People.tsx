
import React, { useEffect, useState } from 'react';
import { User, Share2, Calendar, Plus, X, Trash2, ShieldCheck, ShieldAlert, Info, Clock } from 'lucide-react';
import { getPeople, updatePerson, updatePersonConsent, addFactToPerson, removeFactFromPerson } from '../services/storage';
import { Person } from '../types';

const People: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('');
  const [newFact, setNewFact] = useState('');

  useEffect(() => {
    setPeople(getPeople());
  }, []);

  const refresh = () => {
      const p = getPeople();
      setPeople(p);
      if (selectedPerson) {
          const updated = p.find(item => item.id === selectedPerson.id);
          if (updated) setSelectedPerson(updated);
      }
  };

  const handleAdd = () => {
      if(newName.trim() && newFact.trim()) {
          updatePerson(newName.trim(), newFact.trim(), newRelation.trim() || 'Acquaintance');
          refresh();
          setIsAdding(false);
          setNewName('');
          setNewRelation('');
          setNewFact('');
      }
  };

  const handleToggleConsent = (id: string, current: boolean) => {
      updatePersonConsent(id, !current);
      refresh();
  };

  const handleDeleteFact = (personId: string, factId: string) => {
      removeFactFromPerson(personId, factId);
      refresh();
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-6 overflow-hidden relative">
      <header className="flex justify-between items-center shrink-0">
        <div>
            <h2 className="text-3xl font-bold text-slate-100">People Graph</h2>
            <p className="text-slate-400">Entity relationship tracking with source-aware governance.</p>
        </div>
        <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-indigo-500/20"
        >
            <Plus className="w-5 h-5" /> Add Entity
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {people.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                <User className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-500">No entities tracked yet.</p>
                <p className="text-xs text-slate-600 mt-2">Try chatting about someone to auto-extract nodes.</p>
              </div>
            ) : (
              people.map(person => (
                <div key={person.id} className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 hover:border-indigo-500/30 transition-all flex flex-col h-full group relative">
                  <div className="flex items-center gap-4 mb-6 shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xl font-bold text-slate-100 truncate">{person.name}</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-3 py-1 rounded-full inline-block uppercase font-bold tracking-widest mt-1">
                        {person.relation}
                      </span>
                    </div>
                    <button 
                        onClick={() => handleToggleConsent(person.id, person.consent_given)}
                        className={`p-3 rounded-2xl transition-all ${person.consent_given ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500 hover:text-red-400'}`}
                        title={person.consent_given ? "Consent Active" : "No Consent Recorded"}
                    >
                        {person.consent_given ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <div className="space-y-4 flex-1 overflow-hidden">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Recent Facts
                    </div>
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                        {person.facts.slice(0, 3).map((fact) => (
                          <div key={fact.id} className="group/fact flex gap-3 text-sm text-slate-300 items-start p-3 bg-slate-800/30 rounded-xl border border-slate-700/50 relative">
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${fact.source === 'user' ? 'bg-indigo-500' : 'bg-amber-500'}`}></div>
                            <span className="break-words flex-1 pr-6 italic">"{fact.content}"</span>
                            <button 
                                onClick={() => handleDeleteFact(person.id, fact.id)}
                                className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover/fact:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        {person.facts.length > 3 && (
                            <button onClick={() => setSelectedPerson(person)} className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300">
                                View all {person.facts.length} data points
                            </button>
                        )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
                    <div className="flex items-center gap-2">
                      <Share2 className="w-3 h-3" /> {person.facts.length} nodes
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> {new Date(person.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
      </div>

      {/* Add Modal */}
      {isAdding && (
          <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setIsAdding(false)}>
              <div className="bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-2xl font-bold text-white">Initialize Entity</h3>
                      <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500 hover:text-white"/></button>
                  </div>
                  <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Legal/Identity Designation</label>
                        <input 
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                            placeholder="Name (e.g. John Doe)" 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)}
                            autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Relational Vector</label>
                        <input 
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                            placeholder="Relation (e.g. Project Lead)" 
                            value={newRelation} 
                            onChange={e => setNewRelation(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Metadata</label>
                        <textarea 
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" 
                            placeholder="Initial Fact (e.g. Expert in Rust)" 
                            value={newFact} 
                            onChange={e => setNewFact(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={handleAdd}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20"
                        disabled={!newName.trim() || !newFact.trim()}
                      >
                          Deploy Entity
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Detailed View Modal */}
      {selectedPerson && (
          <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedPerson(null)}>
              <div className="bg-slate-900 border border-slate-700 rounded-[3rem] p-10 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-start mb-10 shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white font-bold text-4xl shadow-xl">
                            {selectedPerson.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-3xl font-bold text-white">{selectedPerson.name}</h3>
                            <div className="flex gap-3 mt-2">
                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{selectedPerson.relation}</span>
                                <span className="text-xs font-bold text-slate-500">•</span>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedPerson.facts.length} Data Points</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setSelectedPerson(null)} className="p-3 hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-500"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-800 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col gap-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Governance State</span>
                              <div className="flex items-center gap-3">
                                  {selectedPerson.consent_given ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-red-400" />}
                                  <span className="text-sm font-bold">{selectedPerson.consent_given ? 'Full Consent' : 'Passive Monitoring'}</span>
                              </div>
                          </div>
                          <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 flex flex-col gap-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Last Update</span>
                              <div className="flex items-center gap-3">
                                  <Clock className="w-5 h-5 text-indigo-400" />
                                  <span className="text-sm font-bold">{new Date(selectedPerson.lastUpdated).toLocaleDateString()}</span>
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex justify-between items-center">
                              Episodic Memory Fact Logs
                          </h4>
                          <div className="space-y-3">
                              {selectedPerson.facts.map((fact) => (
                                  <div key={fact.id} className="group relative p-5 bg-slate-950/40 rounded-3xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                                      <div className="flex justify-between items-center mb-2">
                                          <div className="flex items-center gap-2">
                                              <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${fact.source === 'user' ? 'bg-indigo-600/20 text-indigo-400' : 'bg-amber-600/20 text-amber-400'}`}>
                                                  {fact.source}
                                              </span>
                                              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">{new Date(fact.timestamp).toLocaleString()}</span>
                                          </div>
                                          <button 
                                            onClick={() => handleDeleteFact(selectedPerson.id, fact.id)}
                                            className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                          >
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                      <p className="text-sm text-slate-300 leading-relaxed italic">"{fact.content}"</p>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default People;
