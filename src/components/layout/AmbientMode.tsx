import { useState, useEffect, useCallback, useRef } from 'react';
import { Monitor, Clock, Cpu } from 'lucide-react';

const IDLE_DELAY_MS = 15_000;
const CLOCK_REFRESH_MS = 60_000;

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
      setCurrentTime(new Date());
      setIsIdle(true);
    }, IDLE_DELAY_MS);
  }, []);

  useEffect(() => {
    idleTimerRef.current = setTimeout(() => {
      setCurrentTime(new Date());
      setIsIdle(true);
    }, IDLE_DELAY_MS);

    const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [resetTimer]);

  useEffect(() => {
    if (!isIdle) return;

    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, CLOCK_REFRESH_MS);

    return () => clearInterval(timeInterval);
  }, [isIdle]);

  if (!isIdle) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none select-none flex flex-col items-center justify-center animate-in fade-in duration-1000">
      <div className="absolute inset-0 bg-black/55 transition-opacity duration-1000" />
      
      <div className="absolute inset-0 bg-brand-accent/[0.03]" />

      <div className="relative z-10 flex flex-col items-center gap-8 animate-in zoom-in-95 slide-in-from-bottom-4 duration-1000 delay-300">
        <div className="flex flex-col items-center gap-2">
          <div className="p-6 rounded-full bg-zinc-900/40 border border-zinc-800/80 shadow-2xl relative group">
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

        <div className="flex items-center gap-12 px-8 py-3 rounded-2xl bg-black/45 border border-zinc-800/80">
          <div className="flex flex-col items-center gap-1">
            <Clock size={14} className="text-zinc-500" />
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Uptime</span>
            <span className="text-[10px] font-mono text-zinc-400">Stable</span>
          </div>
          <div className="w-px h-8 bg-zinc-900/60" />
          <div className="flex flex-col items-center gap-1">
            <Cpu size={14} className="text-zinc-500" />
            <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Core</span>
            <span className="text-[10px] font-mono text-zinc-400">Background Syncing</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] opacity-40 animate-bounce text-center">
          Press any key to resume
        </div>
      </div>
    </div>
  );
}

