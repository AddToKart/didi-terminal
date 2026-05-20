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
    <div className="h-6 bg-[#09090b] border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-sans text-zinc-400 select-none z-[40] px-3">
      <div className="flex items-center gap-1.5 h-full">
        <button 
          className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 rounded px-2 py-0.5 transition-all duration-150 font-medium text-[11px]"
          onClick={onOpenPortManager}
          title="Active ports monitor"
        >
          <Wifi size={11} className={portCount > 0 ? "text-amber-500/80" : "text-zinc-500"} />
          <span>{portCount} {portCount === 1 ? 'Port' : 'Ports'}</span>
          <ChevronUp size={10} className="text-zinc-500/60" />
        </button>

        <div className="h-3 w-[1px] bg-zinc-800/60" />

        <button 
          className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 rounded px-2 py-0.5 transition-all duration-150 font-medium text-[11px]"
          onClick={onOpenDbViewer}
          title="Explore database"
        >
          <Database size={11} className="text-zinc-500" />
          <span>Database</span>
        </button>

        <div className="h-3 w-[1px] bg-zinc-800/60" />

        <div className="flex items-center gap-1.5 px-2 py-0.5 text-zinc-400 font-medium text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>System Stable</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 h-full">
        <div className="flex items-center gap-1.5 px-2 py-0.5 text-zinc-400 font-medium text-[11px]">
          <Terminal size={11} className="text-zinc-500" />
          <span>PowerShell</span>
        </div>
        
        <div className="h-3 w-[1px] bg-zinc-800/60" />

        <div className="flex items-center gap-1.5 px-2 py-0.5 text-zinc-400 font-medium text-[11px]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span>Connected</span>
        </div>
      </div>
    </div>
  );
}

