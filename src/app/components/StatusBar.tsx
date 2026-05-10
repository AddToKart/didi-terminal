import { 
  Activity, 
  Terminal, 
  Wifi,
  ChevronUp
} from "lucide-react";

interface StatusBarProps {
  portCount: number;
  onOpenPortManager: () => void;
}

export function StatusBar({ portCount, onOpenPortManager }: StatusBarProps) {
  return (
    <div className="h-6 bg-zinc-900/50 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400 select-none z-[40]">
      <div className="flex items-center gap-0 h-full">
        <div 
          className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors bg-white/5 px-3 h-full border-r border-white/5"
          onClick={onOpenPortManager}
        >
          <Wifi size={10} className={portCount > 0 ? "text-emerald-500" : "text-zinc-500"} />
          <span className="font-medium">{portCount} {portCount === 1 ? 'Port' : 'Ports'}</span>
          <ChevronUp size={10} className="opacity-50" />
        </div>

        <div className="flex items-center gap-1.5 px-3 opacity-60">
          <Activity size={10} />
          <span>System Stable</span>
        </div>
      </div>

      <div className="flex items-center gap-4 px-3">
        <div className="flex items-center gap-1.5">
          <Terminal size={10} />
          <span className="uppercase tracking-wider">Powershell</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-500/80">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
          <span>Connected</span>
        </div>
      </div>
    </div>
  );
}
