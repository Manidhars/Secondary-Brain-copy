
import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Zap, Maximize, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(err.name === 'NotAllowedError' ? "Permission Denied" : "Camera unavailable");
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = dataUrl.split(',')[1];
        onCapture(base64);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      {/* HUD Overlay */}
      <div className="absolute inset-0 border-[20px] border-black/40 pointer-events-none z-20">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-indigo-500 rounded-tl-lg"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-indigo-500 rounded-tr-lg"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-indigo-500 rounded-bl-lg"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-indigo-500 rounded-br-lg"></div>
        
        {/* Scanning Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-[scan_4s_linear_infinite] opacity-50"></div>
      </div>

      <header className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Camera className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm tracking-widest uppercase">Visual Ingestion</h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              SENSOR_ACTIVE_01
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white transition-all backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
      </header>

      <div className="relative w-full h-full flex items-center justify-center">
        {isInitializing && (
          <div className="flex flex-col items-center gap-4 text-indigo-400">
            <RefreshCw className="w-10 h-10 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Waking Optic Hub...</span>
          </div>
        )}
        
        {error && (
          <div className="flex flex-col items-center gap-4 text-red-400 bg-red-900/20 p-8 rounded-[2rem] border border-red-500/30">
            <AlertCircle className="w-12 h-12" />
            <div className="text-center">
              <h3 className="font-bold text-lg">{error}</h3>
              <p className="text-xs opacity-70 mt-1">Please ensure camera permissions are granted.</p>
            </div>
            <button onClick={startCamera} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl font-bold text-sm transition-all hover:bg-red-400">
              Retry Connection
            </button>
          </div>
        )}

        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className={`max-w-full max-h-full object-contain ${isInitializing || error ? 'hidden' : 'block animate-in zoom-in-110 fade-in duration-700'}`}
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <footer className="absolute bottom-12 z-30 flex items-center gap-8">
        <div className="flex flex-col items-center gap-2">
            <button 
              onClick={capturePhoto}
              disabled={isInitializing || !!error}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent group active:scale-95 transition-all disabled:opacity-20"
            >
              <div className="w-16 h-16 rounded-full bg-white group-hover:bg-indigo-400 transition-colors"></div>
            </button>
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Capture Frame</span>
        </div>
      </footer>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;
