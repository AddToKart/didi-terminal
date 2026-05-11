import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Clock, Cpu } from 'lucide-react';

export function AmbientMode() {
  const [isIdle, setIsIdle] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 15000); // 15 seconds
  }, []);

  useEffect(() => {
    // Initial timer
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, 15000);

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(timeInterval);
    };
  }, [resetTimer]);

  if (!isIdle) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none select-none flex flex-col items-center justify-center animate-in fade-in duration-1000">
      {/* Backdrop Blur Layer */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md transition-all duration-1000" />
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-accent/5 via-transparent to-brand-accent/5 opacity-50 animate-pulse" />
      
      {/* Floating Particles Animation (Simplified) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px] animate-blob" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px] animate-blob animation-delay-2000" />
      </div>

      {/* Ambient Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-in zoom-in-95 slide-in-from-bottom-4 duration-1000 delay-300">
        <div className="flex flex-col items-center gap-2">
          <div className="p-6 rounded-full bg-white/[0.03] border border-white/5 backdrop-blur-xl shadow-2xl relative group">
            <div className="absolute inset-0 rounded-full bg-brand-accent/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <Monitor size={48} className="text-brand-accent animate-pulse relative z-10" />
          </div>
          <div className="mt-4 flex flex-col items-center">
            <h2 className="text-4xl font-light tracking-[0.2em] text-white/90 font-mono uppercase">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h2>
            <p className="text-[10px] text-brand-accent/60 font-black tracking-widest uppercase mt-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
              </span>
              Ambient Mode Active
            </p>
          </div>
        </div>

        {/* System Stats Footer */}
        <div className="flex items-center gap-12 px-8 py-3 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md">
          <div className="flex flex-col items-center gap-1">
            <Clock size={14} className="text-zinc-500" />
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Uptime</span>
            <span className="text-[10px] font-mono text-zinc-400">Stable</span>
          </div>
          <div className="w-px h-8 bg-white/5" />
          <div className="flex flex-col items-center gap-1">
            <Cpu size={14} className="text-zinc-500" />
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Core</span>
            <span className="text-[10px] font-mono text-zinc-400">Background Syncing</span>
          </div>
        </div>
      </div>

      {/* Snap back hint */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] opacity-40 animate-bounce text-center">
          Press any key to resume
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}} />
    </div>
  );
}
