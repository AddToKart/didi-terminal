import { useCallback, useEffect, useState } from "react";
import { 
  X, 
  RefreshCw, 
  ShieldAlert, 
  Wifi,
  Trash2,
  ExternalLink,
  Search,
  Command,
  Server
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { eventBus } from "../../services/event-bus";

interface PortInfo {
  port: number;
  pid: number;
  process_name: string;
  state: string;
}

interface PortManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onPortsUpdate?: (count: number) => void;
}

export function PortManager({ isOpen, onClose, onPortsUpdate }: PortManagerProps) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPorts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<PortInfo[]>("get_active_ports");
      setPorts(result);
      onPortsUpdate?.(result.length);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch ports:", err);
      setError("Failed to fetch ports");
    } finally {
      setLoading(false);
    }
  }, [onPortsUpdate]);

  const handleKill = async (pid: number) => {
    try {
      await invoke("kill_process", { pid });
      fetchPorts();
    } catch (err) {
      alert(`Failed to kill process: ${err}`);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchPorts();
    const unsub = eventBus.subscribe("ports-changed", () => fetchPorts());
    return () => unsub();
  }, [fetchPorts, isOpen]);

  const filteredPorts = ports.filter(p => 
    p.process_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.port.toString().includes(searchTerm) ||
    p.pid.toString().includes(searchTerm)
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-500" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-2xl h-[650px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          {/* Header Section */}
          <div className="p-5 border-b border-white/5 bg-zinc-900/40">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Active Ports
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[10px] text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter">
                      Live
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Network Process Monitor</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={fetchPorts}
                  disabled={loading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-emerald-500 transition-colors">
                <Search size={14} />
              </div>
              <input 
                type="text"
                placeholder="Filter by port, process or PID..."
                className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Column Headers */}
          <div className="px-6 py-2 bg-black/40 border-b border-white/5 flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <div className="w-20">Port</div>
            <div className="flex-1">Process</div>
            <div className="w-24">PID</div>
            <div className="w-24">Status</div>
            <div className="w-20 text-right">Actions</div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10">
            {error ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="p-3 bg-red-500/10 rounded-lg text-red-500 mb-3 border border-red-500/20">
                  <ShieldAlert size={32} />
                </div>
                <p className="text-sm font-bold text-white mb-1">Monitor Sync Error</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">{error}</p>
                <button 
                  onClick={fetchPorts}
                  className="mt-4 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors"
                >
                  Reconnect
                </button>
              </div>
            ) : filteredPorts.length === 0 && !loading ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-30 animate-in fade-in duration-500">
                <Wifi size={48} className="text-zinc-600 mb-3" />
                <p className="text-sm font-bold text-white">No active listeners</p>
                <p className="text-[11px] text-zinc-500">Search criteria yielded no matches</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {filteredPorts.map((port, index) => (
                  <div 
                    key={`${port.port}-${port.pid}`}
                    className="group flex items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors animate-in fade-in slide-in-from-top-1 duration-300"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="w-20">
                      <span className="text-xs font-mono font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                        {port.port}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Command size={10} className="text-zinc-600" />
                        <span className="text-xs font-medium text-zinc-300 truncate group-hover:text-white transition-colors">
                          {port.process_name}
                        </span>
                      </div>
                    </div>

                    <div className="w-24">
                      <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                        {port.pid}
                      </span>
                    </div>

                    <div className="w-24">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                        <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-tighter">
                          {port.state}
                        </span>
                      </div>
                    </div>

                    <div className="w-20 flex items-center justify-end gap-1">
                      <button 
                        onClick={() => window.open(`http://localhost:${port.port}`)}
                        className="p-1.5 hover:bg-emerald-500/10 text-zinc-600 hover:text-emerald-400 rounded-md transition-all active:scale-90"
                        title="Open in Browser"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button 
                        onClick={() => handleKill(port.pid)}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-600 hover:text-red-400 rounded-md transition-all active:scale-90"
                        title="Kill Process"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
