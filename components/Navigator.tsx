import React, { useState, useEffect } from 'react';
import { MapPin, Search, Compass, Navigation, Bookmark, ExternalLink, Filter, Map as MapIcon, Plus, X } from 'lucide-react';
import { getPlaces, addPlace, updatePlaceStatus, deletePlace } from '../services/storage';
import { placeSearch } from '../services/llm';
import { Place } from '../types';

// Fix: Implemented the component logic and returned a valid ReactNode to fix 'Type () => void is not assignable to FC'
const Navigator: React.FC = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [filter, setFilter] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPlace, setNewPlace] = useState<Partial<Place>>({ name: '', location: '', description: '', category: 'General' });

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    setPlaces(getPlaces());
  };

  const handleAdd = () => {
    if (newPlace.name) {
      addPlace(newPlace);
      setNewPlace({ name: '', location: '', description: '', category: 'General' });
      setIsAdding(false);
      refresh();
    }
  };

  const filteredPlaces = places.filter(p => 
    p.name.toLowerCase().includes(filter.toLowerCase()) || 
    p.location.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8 h-full flex flex-col gap-6 overflow-hidden">
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h2 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Compass className="text-indigo-400" /> Neural Navigator
          </h2>
          <p className="text-slate-400 mt-1">Spatial memory nodes and geographic entity tracking.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" /> Add Location
        </button>
      </header>

      <div className="relative shrink-0">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        <input 
          type="text" 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)} 
          placeholder="Search spatial nodes..." 
          className="w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-6 pl-14 text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-20 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlaces.map(place => (
            <div key={place.id} className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] flex flex-col gap-4 hover:border-indigo-500/30 transition-all group">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/20">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="px-3 py-1 bg-slate-800 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {place.category}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100 mb-1">{place.name}</h3>
                <p className="text-xs text-indigo-400 font-mono mb-4">{place.location}</p>
                <p className="text-sm text-slate-400 leading-relaxed italic line-clamp-3">"{place.description}"</p>
              </div>
              <div className="mt-auto pt-6 border-t border-slate-800 flex justify-between items-center">
                <button 
                  onClick={() => updatePlaceStatus(place.id, place.status === 'visited' ? 'bucket_list' : 'visited')}
                  className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl border transition-all ${place.status === 'visited' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}
                >
                  {place.status === 'visited' ? 'Synchronized' : 'Bucket List'}
                </button>
                <button onClick={() => deletePlace(place.id)} className="p-2 text-slate-700 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h3 className="text-2xl font-bold text-white mb-6">Register Spatial Node</h3>
            <div className="space-y-4">
              <input 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white outline-none" 
                placeholder="Place Name" 
                value={newPlace.name} 
                onChange={e => setNewPlace({...newPlace, name: e.target.value})}
              />
              <input 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white outline-none" 
                placeholder="Coordinates / Address" 
                value={newPlace.location} 
                onChange={e => setNewPlace({...newPlace, location: e.target.value})}
              />
              <textarea 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white outline-none h-24 resize-none" 
                placeholder="Contextual Description" 
                value={newPlace.description} 
                onChange={e => setNewPlace({...newPlace, description: e.target.value})}
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold">Deploy Node</button>
                <button onClick={() => setIsAdding(false)} className="px-6 bg-slate-800 text-slate-400 rounded-2xl font-bold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navigator;