
import React, { useEffect, useState, useMemo } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles } from 'lucide-react';
import { getMemories } from '../services/storage';
import { Memory } from '../types';

interface PhotoFrameProps {
  query: string;
  onClose: () => void;
}

const PhotoFrame: React.FC<PhotoFrameProps> = ({ query, onClose }) => {
  const [images, setImages] = useState<{ src: string, caption: string, date: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const allMemories = getMemories();
    
    // Filter logic: Find memories matching query that HAVE images
    // We search across content, domain, and date.
    const filtered = allMemories.filter(m => {
        const hasImage = m.images && m.images.length > 0;
        if (!hasImage) return false;
        
        if (!query) return true; // Show all if no query

        const lowerQ = query.toLowerCase();
        return (
            m.content.toLowerCase().includes(lowerQ) || 
            m.domain.toLowerCase().includes(lowerQ) ||
            new Date(m.createdAt).toLocaleDateString().includes(lowerQ)
        );
    });

    const imageList = filtered.flatMap(m => 
        (m.images || []).map(img => ({
            src: img,
            caption: m.content,
            date: m.createdAt
        }))
    );

    setImages(imageList);
    setCurrentIndex(0);
  }, [query]);

  useEffect(() => {
    let interval: number;
    if (isPlaying && images.length > 1) {
        interval = window.setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % images.length);
        }, 8000); // Slower, more "ambient" transition for Orin frame
    }
    return () => clearInterval(interval);
  }, [isPlaying, images.length]);

  // --- ADDED MISSING HANDLERS ---
  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % images.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  };

  if (images.length === 0) {
      return (
          <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center text-slate-400">
              <button onClick={onClose} className="absolute top-8 right-8 p-2 bg-slate-800 rounded-full hover:bg-slate-700 text-white">
                  <X className="w-6 h-6" />
              </button>
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <h2 className="text-xl font-bold">No memories found for "{query}"</h2>
              <p className="text-sm mt-2">Try saying "Jarvis, show me photos of my friends".</p>
          </div>
      );
  }

  const currentImage = images[currentIndex];

  return (
    <div className="absolute inset-0 z-50 bg-black text-white flex flex-col animate-in fade-in duration-1000 overflow-hidden">
        {/* Top HUD Overlay */}
        <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 via-black/20 to-transparent pointer-events-none">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600/30 backdrop-blur-md rounded-2xl border border-indigo-500/30">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-widest uppercase font-mono text-white drop-shadow-lg">{query || 'All Memories'}</h1>
                    <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest opacity-70">Neural Archive • {currentIndex + 1} of {images.length}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all border border-white/10 pointer-events-auto">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Cinematic Stage */}
        <div className="flex-1 relative flex items-center justify-center">
            {/* Background Ambient Glow (Picks up colors from image) */}
            <div 
                key={`bg-${currentIndex}`}
                className="absolute inset-0 bg-cover bg-center blur-[120px] opacity-40 scale-125 transition-all duration-[2000ms] ease-out"
                style={{ backgroundImage: `url(data:image/jpeg;base64,${currentImage.src})` }}
            ></div>

            {/* Main Image */}
            <div className="relative z-10 w-full h-full flex items-center justify-center p-12 md:p-24">
                <img 
                    key={currentIndex}
                    src={`data:image/jpeg;base64,${currentImage.src}`} 
                    className="max-h-full max-w-full object-contain shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-lg animate-in zoom-in-105 fade-in duration-[1500ms] ease-out"
                    alt="Memory"
                />
            </div>
            
            {/* Nav Controls */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-6 z-20 pointer-events-none">
                <button onClick={handlePrev} className="p-4 bg-black/20 hover:bg-black/40 rounded-full text-white/50 hover:text-white backdrop-blur-sm transition-all pointer-events-auto">
                    <ChevronLeft className="w-10 h-10" />
                </button>
                <button onClick={handleNext} className="p-4 bg-black/20 hover:bg-black/40 rounded-full text-white/50 hover:text-white backdrop-blur-sm transition-all pointer-events-auto">
                    <ChevronRight className="w-10 h-10" />
                </button>
            </div>
        </div>

        {/* Bottom Caption Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20 flex justify-between items-end">
            <div className="max-w-3xl animate-in slide-in-from-bottom-4 duration-1000">
                <blockquote className="text-2xl md:text-3xl font-light text-slate-100 leading-snug drop-shadow-2xl">
                    "{currentImage.caption}"
                </blockquote>
                <div className="flex items-center gap-3 mt-4 text-sm text-indigo-400 font-bold uppercase tracking-widest">
                    <div className="w-8 h-px bg-indigo-500/50"></div>
                    {new Date(currentImage.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>
            
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded-full backdrop-blur-2xl transition-all border border-indigo-500/30 group"
            >
                {isPlaying ? <Pause className="w-8 h-8 fill-current group-active:scale-90" /> : <Play className="w-8 h-8 fill-current group-active:scale-90" />}
            </button>
        </div>
    </div>
  );
};

export default PhotoFrame;
