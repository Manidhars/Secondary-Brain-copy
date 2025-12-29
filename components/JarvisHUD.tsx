import React, { useEffect, useRef, useState } from 'react';
import { Mic, X, Activity, Radio, Cpu, Volume2 } from 'lucide-react';

interface JarvisHUDProps {
  onClose: () => void;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  response?: string;
  audioStream?: MediaStream | null;
}

const JarvisHUD: React.FC<JarvisHUDProps> = ({ onClose, isListening, isProcessing, transcript, response, audioStream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Visual state management
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Audio Analysis Setup
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArray: Uint8Array | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    if (audioStream && isListening) {
       try {
           // Reuse context if possible, or handle strict browser limits carefully
           audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
           analyser = audioContext.createAnalyser();
           source = audioContext.createMediaStreamSource(audioStream);
           source.connect(analyser);
           // Higher FFT size for more detailed bars
           analyser.fftSize = 128; 
           const bufferLength = analyser.frequencyBinCount;
           dataArray = new Uint8Array(bufferLength);
       } catch (e) {
           console.error("Audio Context Error:", e);
       }
    }

    const draw = () => {
      if (!ctx) return;
      
      // Handle Resize
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
      }

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const time = Date.now();
      
      ctx.clearRect(0, 0, width, height);

      // --- CONFIGURATION ---
      const baseRadius = 80;
      let dominantFreq = 0;

      // --- DATA ACQUISITION ---
      if (analyser && isListening && dataArray) {
          analyser.getByteFrequencyData(dataArray);
          // Calculate average for core pulse
          let sum = 0;
          for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          dominantFreq = sum / dataArray.length;
      } else if (isProcessing) {
          // Synthetic pulse for "Thinking"
          dominantFreq = (Math.sin(time / 200) + 1) * 30 + 20;
      }

      const pulseFactor = dominantFreq / 255; // 0 to 1
      const activeColor = isProcessing ? '251, 191, 36' : '99, 102, 241'; // Amber vs Indigo

      // --- LAYER 1: Core Glow ---
      const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius * (1 + pulseFactor));
      gradient.addColorStop(0, `rgba(${activeColor}, 0.1)`);
      gradient.addColorStop(0.5, `rgba(${activeColor}, 0.3)`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 2: Central Circle ---
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${activeColor}, 0.8)`;
      ctx.lineWidth = 2;
      ctx.arc(centerX, centerY, baseRadius - 10 + (pulseFactor * 10), 0, Math.PI * 2);
      ctx.stroke();

      // --- LAYER 3: Rotating Rings (Decorative) ---
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time / 3000);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${activeColor}, 0.3)`;
      ctx.lineWidth = 1;
      ctx.setLineDash([15, 25]);
      ctx.arc(0, 0, baseRadius + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-time / 2000);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${activeColor}, 0.2)`;
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 40]);
      ctx.arc(0, 0, baseRadius + 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // --- LAYER 4: Frequency Bars (The Visualizer) ---
      if (analyser && dataArray) {
          const barCount = 40; // Number of bars around the circle
          const step = (Math.PI * 2) / barCount;
          
          ctx.save();
          ctx.translate(centerX, centerY);
          
          for (let i = 0; i < barCount; i++) {
              // Map visualizer bars to frequency data
              // We mirror the data to make it symmetrical
              const dataIndex = Math.floor(Math.abs((i - barCount / 2)) / (barCount / 2) * (dataArray.length / 2));
              const value = dataArray[dataIndex];
              const barHeight = Math.max(4, (value / 255) * 60);
              
              ctx.rotate(step);
              
              ctx.fillStyle = `rgba(${activeColor}, ${0.5 + (value / 510)})`;
              
              // Draw rounded bar
              const x = baseRadius + 15; // Offset from center
              const w = 4; // Bar width
              
              ctx.beginPath();
              ctx.roundRect(x, -w/2, barHeight, w, 2);
              ctx.fill();
          }
          ctx.restore();
      } else if (isProcessing) {
          // Synthetic orbital particles for "Thinking"
          const particleCount = 8;
          ctx.save();
          ctx.translate(centerX, centerY);
          for (let i = 0; i < particleCount; i++) {
              const angle = (time / 500) + (i * (Math.PI * 2 / particleCount));
              const r = baseRadius + 25 + Math.sin(time/200 + i)*10;
              const px = Math.cos(angle) * r;
              const py = Math.sin(angle) * r;
              
              ctx.beginPath();
              ctx.fillStyle = `rgba(${activeColor}, 0.8)`;
              ctx.arc(px, py, 3, 0, Math.PI * 2);
              ctx.fill();
          }
          ctx.restore();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [isListening, isProcessing, audioStream]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500 text-white font-sans selection:bg-indigo-500/30">
        
        {/* Cinematic Noise Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>
        
        {/* Ambient Gradient Background */}
        <div className={`absolute inset-0 bg-radial-gradient from-indigo-900/20 to-transparent transition-opacity duration-1000 ${isProcessing ? 'opacity-0' : 'opacity-100'}`}></div>
        <div className={`absolute inset-0 bg-radial-gradient from-amber-900/20 to-transparent transition-opacity duration-1000 ${isProcessing ? 'opacity-100' : 'opacity-0'}`}></div>

        {/* Top Status Bar */}
        <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start text-xs font-mono uppercase tracking-[0.2em] text-slate-500 z-20">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`}></div>
                    <span>MIC_INPUT: {isListening ? 'LIVE' : 'OFFLINE'}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`}></div>
                    <span>NEURAL_CORE: {isProcessing ? 'COMPUTING' : 'STANDBY'}</span>
                </div>
            </div>
            <div className="text-right opacity-50">
                SEC_BRAIN_OS v2.4
                <br/>
                VOICE_MODULE
            </div>
        </div>

        {/* Central Canvas Layer */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

        {/* Content Layer */}
        <div className="relative z-30 w-full max-w-4xl px-6 flex flex-col items-center justify-center min-h-[60vh]">
            
            {/* Transcript Area */}
            <div className={`transition-all duration-500 transform ${transcript ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}>
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="px-4 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] uppercase tracking-widest text-slate-400 backdrop-blur-md">
                        Incoming Transmission
                    </div>
                    <p className="text-3xl md:text-5xl font-light text-slate-100 leading-tight max-w-3xl drop-shadow-2xl">
                        "{transcript || '...'}"
                    </p>
                </div>
            </div>

            {/* AI Response Area */}
            {response && (
                <div className="mt-12 animate-in slide-in-from-bottom-8 fade-in duration-700 max-w-2xl w-full">
                    <div className="relative p-8 rounded-3xl bg-slate-900/50 border border-indigo-500/30 backdrop-blur-xl shadow-2xl">
                        {/* Decorative Corner accents */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-indigo-400 rounded-tl-xl opacity-50"></div>
                        <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-indigo-400 rounded-tr-xl opacity-50"></div>
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-indigo-400 rounded-bl-xl opacity-50"></div>
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-indigo-400 rounded-br-xl opacity-50"></div>

                        <div className="flex items-center gap-3 mb-4 text-indigo-400">
                            <Activity className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">System Response</span>
                        </div>
                        <p className="text-lg md:text-xl text-slate-200 font-medium leading-relaxed font-sans">
                            {response}
                        </p>
                    </div>
                </div>
            )}
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-12 z-40">
            <button 
                onClick={onClose}
                className="group relative px-8 py-4 bg-slate-900/80 hover:bg-red-950/30 border border-slate-700 hover:border-red-500/50 rounded-full transition-all duration-300 backdrop-blur-md overflow-hidden"
            >
                <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="relative flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 group-hover:animate-ping"></div>
                    <span className="text-slate-300 font-mono text-xs uppercase tracking-widest group-hover:text-white transition-colors">
                        Terminate Session
                    </span>
                </div>
            </button>
        </div>
    </div>
  );
};

export default JarvisHUD;