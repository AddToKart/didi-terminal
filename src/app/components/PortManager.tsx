import { useState, useEffect } from "react";
import { 
  Activity, 
  X, 
  RefreshCw, 
  ShieldAlert, 
  Wifi,
  Trash2,
  ExternalLink,
  Search
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

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

  const fetchPorts = async () => {
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
  };

  const handleKill = async (pid: number) => {
    try {
      await invoke("kill_process", { pid });
      fetchPorts();
    } catch (err) {
      alert(`Failed to kill process: ${err}`);
    }
  };

  useEffect(() => {
    fetchPorts();
    const interval = setInterval(fetchPorts, 10000);
    return () => clearInterval(interval);
  }, []);

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
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-500" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-2xl h-[600px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
          
          {/* Header Section */}
          <div className="relative p-6 border-b border-white/5 bg-gradient-to-b from-white/[0.05] to-transparent">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 border border-emerald-500/20">
                    <Activity size={24} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">System Port Monitor</h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {ports.length} Active Listeners
                    </span>
                    <span className="opacity-20">|</span>
                    <span>Real-time Process Tracking</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchPorts}
                  disabled={loading}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh List"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl text-zinc-400 hover:text-red-400 transition-all active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search Bar - Integrated into Header */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-emerald-500 transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text"
                placeholder="Search by port, process name, or PID..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Main Content - Fixed Height Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 bg-black/20">
            {error && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="p-4 bg-red-500/10 rounded-full text-red-500 mb-4">
                  <ShieldAlert size={48} />
                </div>
                <p className="text-lg font-medium text-white mb-2">Monitor Error</p>
                <p className="text-sm text-red-400/80 max-w-xs">{error}</p>
                <button 
                  onClick={fetchPorts}
                  className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {filteredPorts.length === 0 && !loading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="relative mb-6">
                  <Wifi size={80} className="text-zinc-700" />
                  <Search size={32} className="absolute bottom-0 right-0 text-emerald-500" />
                </div>
                <p className="text-lg font-medium text-white">No matches found</p>
                <p className="text-sm">Try searching for a different port or process</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {filteredPorts.map((port) => (
                <div 
                  key={`${port.port}-${port.pid}`}
                  className="group relative flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 rounded-2xl transition-all duration-300 overflow-hidden"
                >
                  {/* Subtle Background Glow on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="relative flex items-center gap-6">
                    <div className="flex flex-col items-center justify-center min-w-[70px]">
                      <span className="text-lg font-black font-mono text-emerald-400 leading-none mb-1">
                        {port.port}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-emerald-500/40 font-bold">PORT</span>
                    </div>

                    <div className="h-10 w-px bg-white/5" />

                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">
                        {port.process_name}
                      </span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-black/40 rounded-lg border border-white/5">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">PID</span>
                          <span className="text-[10px] text-zinc-300 font-mono">{port.pid}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 rounded-lg border border-emerald-500/10">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">{port.state}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-2">
                    <button 
                      onClick={() => window.open(`http://localhost:${port.port}`)}
                      className="p-3 bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-xl transition-all active:scale-90"
                      title="Open Localhost"
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button 
                      onClick={() => handleKill(port.pid)}
                      className="p-3 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-xl transition-all active:scale-90"
                      title="Terminate Process"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="p-4 px-6 bg-zinc-950 border-t border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
              <span className="opacity-20 text-xs">|</span>
              <span>Updated {new Date().toLocaleTimeString()}</span>
            </div>
            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <span className="text-[9px] font-black text-zinc-400 tracking-tighter uppercase">Didi Security Engine v2.0</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
