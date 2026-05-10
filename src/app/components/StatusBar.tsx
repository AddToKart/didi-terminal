import { useState, useEffect } from "react";
import { 
  Activity, 
  X, 
  Terminal, 
  RefreshCw, 
  ShieldAlert, 
  Wifi,
  Trash2,
  ExternalLink,
  ChevronUp,
  Search
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface PortInfo {
  port: number;
  pid: number;
  process_name: string;
  state: string;
}

export function StatusBar() {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMonitor, setShowMonitor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPorts = async () => {
    setLoading(true);
    try {
      const result = await invoke<PortInfo[]>("get_active_ports");
      setPorts(result);
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
    const interval = setInterval(fetchPorts, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const filteredPorts = ports.filter(p => 
    p.process_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.port.toString().includes(searchTerm) ||
    p.pid.toString().includes(searchTerm)
  );

  return (
    <>
      {/* Tiny Status Bar */}
      <div className="h-6 bg-zinc-900/50 backdrop-blur-md border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-400 select-none z-[40]">
        <div className="flex items-center gap-0 h-full">
          <div 
            className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors bg-white/5 px-3 h-full border-r border-white/5"
            onClick={() => {
              fetchPorts();
              setShowMonitor(true);
            }}
          >
            <Wifi size={10} className={ports.length > 0 ? "text-emerald-500" : "text-zinc-500"} />
            <span className="font-medium">{ports.length} {ports.length === 1 ? 'Port' : 'Ports'}</span>
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

      {/* Port Monitor Modal */}
      {showMonitor && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" 
            onClick={() => setShowMonitor(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
            <div className="bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden w-full max-w-xl max-h-[80vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <Activity size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Port & Process Monitor</h3>
                    <p className="text-xs text-zinc-400">Managing active TCP listeners and dev servers</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={fetchPorts}
                    disabled={loading}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  </button>
                  <button 
                    onClick={() => setShowMonitor(false)}
                    className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-5 py-3 bg-black/20 border-b border-white/5">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input 
                    type="text"
                    placeholder="Search by port, process name, or PID..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.07] transition-all shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                {error && (
                  <div className="p-8 text-center">
                    <ShieldAlert size={40} className="mx-auto text-red-500/50 mb-3" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {filteredPorts.length === 0 && !loading && !error && (
                  <div className="py-20 text-center text-zinc-500">
                    <Wifi size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm">
                      {searchTerm ? `No results for "${searchTerm}"` : "No active ports found"}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  {filteredPorts.map((port) => (
                    <div 
                      key={`${port.port}-${port.pid}`}
                      className="group flex items-center justify-between p-3.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 text-center">
                          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md">
                            {port.port}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">
                            {port.process_name}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                            <span className="font-mono bg-white/5 px-1.5 rounded">PID: {port.pid}</span>
                            <span className="opacity-30">•</span>
                            <span className="text-emerald-500/70 lowercase font-medium">{port.state}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={() => window.open(`http://localhost:${port.port}`)}
                          className="p-2.5 hover:bg-blue-500/20 text-zinc-400 hover:text-blue-400 rounded-lg transition-all"
                          title="Open in Browser"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button 
                          onClick={() => handleKill(port.pid)}
                          className="p-2.5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-all"
                          title="Kill Process"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 bg-black/20 border-t border-white/5 flex justify-between items-center text-[10px] text-zinc-500">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
                  <span>Auto-refreshing every 10 seconds</span>
                </div>
                <span className="uppercase tracking-widest opacity-50 font-bold">Didi System Monitor</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
