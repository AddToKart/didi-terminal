import { 
  Terminal, 
  Wifi,
  ChevronUp,
  Database
} from "lucide-react";

interface StatusBarProps {
  portCount: number;
  onOpenPortManager: () => void;
  onOpenDbViewer: () => void;
}

export function StatusBar({ portCount, onOpenPortManager, onOpenDbViewer }: StatusBarProps) {
  return (
    <div className="h-6 bg-[#09090b] border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 select-none z-[40] px-3">
      <div className="flex items-center gap-2 h-full py-0.5">
        <div 
          className="flex items-center gap-1.5 cursor-pointer bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-amber-500/5 text-zinc-400 hover:text-amber-300 rounded px-2.5 h-full transition-all duration-200 font-mono text-[9px] font-bold shadow-inner"
          onClick={onOpenPortManager}
          title="Active ports monitor"
        >
          <Wifi size={10} className={portCount > 0 ? "text-amber-400" : "text-zinc-600"} />
          <span className="uppercase tracking-tight">{portCount} {portCount === 1 ? 'Port' : 'Ports'}</span>
          <ChevronUp size={10} className="text-zinc-600" />
        </div>

        <div 
          className="flex items-center gap-1.5 cursor-pointer bg-zinc-950 border border-zinc-800/80 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-zinc-400 hover:text-indigo-300 rounded px-2.5 h-full transition-all duration-200 font-mono text-[9px] font-bold shadow-inner"
          onClick={onOpenDbViewer}
          title="Explore database"
        >
          <Database size={10} className="text-indigo-500" />
          <span className="uppercase tracking-tight">Database</span>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800/80 text-zinc-400 rounded px-2.5 h-full font-mono text-[9px] font-bold shadow-inner">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
          </span>
          <span className="uppercase tracking-tight">System Stable</span>
        </div>
      </div>

      <div className="flex items-center gap-2 h-full py-0.5">
        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800/80 rounded px-2.5 h-full text-zinc-400 font-mono text-[9px] font-bold shadow-inner">
          <Terminal size={10} className="text-zinc-500" />
          <span className="uppercase tracking-tight">Powershell</span>
        </div>
        
        <div className="flex items-center gap-1.5 bg-zinc-950 border border-emerald-950/80 rounded px-2.5 h-full text-emerald-400 font-mono text-[9px] font-bold shadow-[0_0_8px_rgba(16,185,129,0.02)]">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
          </span>
          <span className="uppercase tracking-tight text-emerald-400/90">Connected</span>
        </div>
      </div>
    </div>
  );
}
