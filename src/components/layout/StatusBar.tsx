import { 
  Terminal, 
  Wifi,
  ChevronUp,
  Database,
  Container,
  Radio,
} from "lucide-react";

interface StatusBarProps {
  portCount: number;
  dockerCount: number | null;
  forwardedCount: number;
  onOpenPortManager: () => void;
  onOpenDbViewer: () => void;
  onOpenDockerManager: () => void;
  onOpenPortForwarding: () => void;
}

export function StatusBar({ 
  portCount, 
  dockerCount,
  forwardedCount,
  onOpenPortManager, 
  onOpenDbViewer,
  onOpenDockerManager,
  onOpenPortForwarding,
}: StatusBarProps) {
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

        {/* Port Forwarding chip — VSCode style */}
        <button 
          className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/40 rounded px-2 py-0.5 transition-all duration-150 font-medium text-[11px]"
          onClick={onOpenPortForwarding}
          title="Port forwarding & tunnels"
          style={{ color: forwardedCount > 0 ? "rgb(56 189 248)" : undefined }}
        >
          <Radio 
            size={11} 
            className={forwardedCount > 0 ? "text-sky-400 animate-pulse" : "text-zinc-500"} 
          />
          <span className={forwardedCount > 0 ? "text-sky-400" : "text-zinc-400"}>
            {forwardedCount > 0 ? `${forwardedCount} Forwarded` : "Ports"}
          </span>
          <ChevronUp size={10} className="text-zinc-500/60" />
        </button>

        <div className="h-3 w-[1px] bg-zinc-800/60" />

        <button 
          className="flex items-center gap-1.5 cursor-pointer hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 rounded px-2 py-0.5 transition-all duration-150 font-medium text-[11px]"
          onClick={onOpenDockerManager}
          title="Docker container hub"
        >
          <Container size={11} className={dockerCount !== null && dockerCount > 0 ? "text-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.4)] font-bold animate-pulse" : "text-zinc-500"} />
          <span>{dockerCount === null ? 'Docker Offline' : `${dockerCount} ${dockerCount === 1 ? 'Container' : 'Containers'}`}</span>
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
