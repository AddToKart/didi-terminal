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
  Server,
  Globe,
  Copy,
  Check,
  Loader2
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

  const [activeTunnels, setActiveTunnels] = useState<Record<number, string>>({});
  const [tunnelsLoading, setTunnelsLoading] = useState<Record<number, boolean>>({});
  const [copiedPort, setCopiedPort] = useState<number | null>(null);

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

  const fetchTunnels = useCallback(async () => {
    try {
      const active = await invoke<Record<number, string>>("get_active_tunnels");
      setActiveTunnels(active);
    } catch (err) {
      console.error("Failed to fetch active tunnels:", err);
    }
  }, []);

  const handleKill = async (pid: number) => {
    try {
      await invoke("kill_process", { pid });
      fetchPorts();
    } catch (err) {
      alert(`Failed to kill process: ${err}`);
    }
  };

  const handleExpose = async (port: number) => {
    setTunnelsLoading(prev => ({ ...prev, [port]: true }));
    try {
      const url = await invoke<string>("start_port_tunnel", { port });
      setActiveTunnels(prev => ({ ...prev, [port]: url }));
    } catch (err) {
      alert(`Failed to expose port ${port}: ${err}`);
    } finally {
      setTunnelsLoading(prev => ({ ...prev, [port]: false }));
    }
  };

  const handleStopExpose = async (port: number) => {
    setTunnelsLoading(prev => ({ ...prev, [port]: true }));
    try {
      await invoke("stop_port_tunnel", { port });
      setActiveTunnels(prev => {
        const copy = { ...prev };
        delete copy[port];
        return copy;
      });
    } catch (err) {
      alert(`Failed to stop tunnel for port ${port}: ${err}`);
    } finally {
      setTunnelsLoading(prev => ({ ...prev, [port]: false }));
    }
  };

  const handleCopy = async (port: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPort(port);
      setTimeout(() => setCopiedPort(null), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchPorts();
    fetchTunnels();
    const unsub = eventBus.subscribe("ports-changed", () => {
      fetchPorts();
      fetchTunnels();
    });
    return () => unsub();
  }, [fetchPorts, fetchTunnels, isOpen]);

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
        className="fixed inset-0 bg-black/75 z-[100] animate-in fade-in duration-300" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden w-full max-w-2xl h-[650px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          {/* Header Section */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/20">
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
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Column Headers */}
          <div className="px-6 py-2 bg-zinc-900/40 border-b border-zinc-800 flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            <div className="w-20">Port</div>
            <div className="flex-1">Process</div>
            <div className="w-24">PID</div>
            <div className="w-24">Status</div>
            <div className="w-28 text-right">Actions</div>
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
                  className="mt-4 px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 rounded-lg text-xs transition-colors text-zinc-300"
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
              <div className="divide-y divide-zinc-900">
                {filteredPorts.map((port, index) => (
                  <div 
                    key={`${port.port}-${port.pid}`}
                    className="group flex items-center px-6 py-3.5 hover:bg-zinc-900/40 transition-colors animate-in fade-in slide-in-from-top-1 duration-300"
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
                      {activeTunnels[port.port] && (
                        <div className="mt-1.5 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-400 truncate max-w-[280px]">
                            {activeTunnels[port.port]}
                          </span>
                          <button
                            onClick={() => handleCopy(port.port, activeTunnels[port.port])}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all active:scale-95"
                            title="Copy Tunnel URL"
                          >
                            {copiedPort === port.port ? <Check size={10} className="text-sky-400 animate-in zoom-in-50 duration-150" /> : <Copy size={10} />}
                          </button>
                          <a
                            href={activeTunnels[port.port]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-all active:scale-95"
                            title="Open public URL"
                          >
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="w-24">
                      <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                        {port.pid}
                      </span>
                    </div>

                    <div className="w-24">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1 h-1 rounded-full ${activeTunnels[port.port] ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${activeTunnels[port.port] ? "text-sky-400 animate-pulse" : "text-emerald-500/80"}`}>
                          {activeTunnels[port.port] ? "Shared" : port.state}
                        </span>
                      </div>
                    </div>

                    <div className="w-28 flex items-center justify-end gap-1">
                      <button 
                        onClick={() => window.open(`http://localhost:${port.port}`)}
                        className="p-1.5 hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 rounded-md transition-all active:scale-90"
                        title="Open in Browser"
                      >
                        <ExternalLink size={14} />
                      </button>
                      {tunnelsLoading[port.port] ? (
                        <div className="p-1.5 text-zinc-400">
                          <Loader2 size={14} className="animate-spin" />
                        </div>
                      ) : activeTunnels[port.port] ? (
                        <button
                          onClick={() => handleStopExpose(port.port)}
                          className="p-1.5 hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 rounded-md transition-all active:scale-90"
                          title="Stop Exposing"
                        >
                          <Globe size={14} className="animate-pulse" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleExpose(port.port)}
                          className="p-1.5 hover:bg-sky-500/10 text-zinc-500 hover:text-sky-400 rounded-md transition-all active:scale-90"
                          title="Expose Port"
                        >
                          <Globe size={14} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleKill(port.pid)}
                        className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-md transition-all active:scale-90"
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
