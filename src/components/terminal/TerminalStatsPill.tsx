import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { STATS_REFRESH_MS } from "@/components/terminal/terminal-helpers";

interface TerminalStatsPillProps {
  ptyKey: string;
  isZenMode?: boolean;
}

export function TerminalStatsPill({ ptyKey, isZenMode }: TerminalStatsPillProps) {
  const [stats, setStats] = useState({ cpu: 0, mem: 0 });

  useEffect(() => {
    if (isZenMode) return;

    let cancelled = false;
    let inFlight = false;

    const refreshStats = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const result: [number, number] = await invoke("get_process_stats", { agent: ptyKey });
        if (!cancelled) {
          setStats({ cpu: result[0], mem: result[1] });
        }
      } catch (e) {
        // Ignore errors
      } finally {
        inFlight = false;
      }
    };

    refreshStats();
    const statInterval = setInterval(refreshStats, STATS_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(statInterval);
      setStats({ cpu: 0, mem: 0 });
    };
  }, [ptyKey, isZenMode]);

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center bg-zinc-950/80 border border-zinc-800/80 px-2 py-0.5 rounded text-zinc-400 font-mono text-[9px] font-bold shadow-inner"
        title="CPU Usage"
      >
        <span className="text-[8px] text-zinc-600 mr-0.5 uppercase tracking-tighter">CPU</span>
        <span className="text-zinc-300">{stats.cpu.toFixed(1)}%</span>
      </div>
      <div
        className="flex items-center bg-zinc-950/80 border border-zinc-800/80 px-2 py-0.5 rounded text-zinc-400 font-mono text-[9px] font-bold shadow-inner"
        title="Memory Usage"
      >
        <span className="text-[8px] text-zinc-600 mr-0.5 uppercase tracking-tighter">MEM</span>
        <span className="text-zinc-300">{(stats.mem / 1024 / 1024).toFixed(0)}MB</span>
      </div>
    </div>
  );
}
