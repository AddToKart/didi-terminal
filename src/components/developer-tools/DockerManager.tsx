import { useCallback, useEffect, useState } from "react";
import { 
  X, 
  RefreshCw, 
  Play, 
  Square, 
  RotateCcw, 
  Pause, 
  ShieldAlert, 
  Container, 
  Terminal, 
  Search, 
  HardDrive, 
  Cpu, 
  Trash2,
  ExternalLink
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { loadTerminalLanes, saveTerminalLanes } from "../../services/terminal-lanes";

interface ContainerInfo {
  id: string;
  name: string;
  state: string;
  status: string;
  image: string;
  ports: string;
}

interface ContainerStats {
  id: string;
  cpu_perc: string;
  mem_usage: string;
  mem_perc: string;
}

interface DockerManagerProps {
  isOpen: boolean;
  onClose: () => void;
  controller: any;
}

export function DockerManager({ isOpen, onClose, controller }: DockerManagerProps) {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [stats, setStats] = useState<Record<string, ContainerStats>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

  const { activeWorkspaceId, activeTabId, tabs } = controller || {};

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch containers
      const containerList = await invoke<ContainerInfo[]>("get_docker_containers");
      setContainers(containerList);
      setError(null);

      // 2. Fetch stats
      try {
        const statsList = await invoke<ContainerStats[]>("get_docker_stats");
        const statsMap: Record<string, ContainerStats> = {};
        statsList.forEach(s => {
          statsMap[s.id] = s;
        });
        setStats(statsMap);
      } catch (statsErr) {
        console.warn("Failed to fetch Docker stats:", statsErr);
      }
    } catch (err) {
      console.error("Failed to connect to Docker:", err);
      setError(
        typeof err === "string" 
          ? err 
          : "Could not establish connection to the Docker Daemon. Make sure Docker Desktop or your WSL Docker service is running."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const handleAction = async (id: string, action: string) => {
    setActionLoadingMap(prev => ({ ...prev, [id]: true }));
    try {
      await invoke("control_container", { id, action });
      await fetchData(false);
    } catch (err) {
      alert(`Docker action failed: ${err}`);
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSpawnShell = (containerId: string, containerName: string) => {
    const activeTab = tabs?.find((t: any) => t.id === activeTabId);
    const activeAgent = activeTab?.agents?.[0];

    if (activeAgent?.id) {
      // User has an active agent, append a new terminal lane
      const currentLanes = loadTerminalLanes(activeAgent.id, activeWorkspaceId);
      
      // Prevent duplicate shell lanes for the same container
      const existingLane = currentLanes.find(l => l.shell?.includes(containerId));
      if (existingLane) {
        emit("lanes-changed", { agentId: activeAgent.id, selectLaneId: existingLane.id });
        onClose();
        return;
      }

      const nextLaneId = crypto.randomUUID();
      const newLane = {
        id: nextLaneId,
        label: `${containerName.slice(0, 10)}`,
        agentName: activeAgent.id,
        shell: `docker exec -it ${containerId} sh`
      };

      const updatedLanes = [...currentLanes, newLane];
      saveTerminalLanes(activeAgent.id, activeWorkspaceId, updatedLanes);
      emit("lanes-changed", { agentId: activeAgent.id, selectLaneId: nextLaneId });
    } else {
      // Spawn a new agent in the active tab since no agent exists yet
      controller.spawnAgent(undefined, `Docker: ${containerName.slice(0, 10)}`, `docker exec -it ${containerId} sh`);
    }

    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchData, isOpen]);

  const filteredContainers = containers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.image.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]";
      case "paused":
        return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]";
      default:
        return "bg-zinc-650";
    }
  };

  const getStatusTextClass = (state: string) => {
    switch (state.toLowerCase()) {
      case "running":
        return "text-emerald-400";
      case "paused":
        return "text-amber-400";
      default:
        return "text-zinc-500";
    }
  };

  const parsePorts = (portsStr: string) => {
    if (!portsStr || portsStr.trim() === "") return [];
    // e.g. "0.0.0.0:80->80/tcp, :::80->80/tcp" or "80/tcp"
    const items = portsStr.split(",").map(p => p.trim());
    const parsed: { host: string; container: string }[] = [];
    
    items.forEach(item => {
      const match = item.match(/(?:0\.0\.0\.0|\[::\]):(\d+)->(\d+)\/tcp/);
      if (match) {
        parsed.push({ host: match[1], container: match[2] });
      }
    });

    // De-duplicate same host port maps
    return parsed.filter((v, i, a) => a.findIndex(t => t.host === v.host) === i);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 z-[100] animate-in fade-in duration-350" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/80 rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden w-full max-w-4xl h-[700px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-6 duration-350">
          
          {/* Header Section */}
          <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                  <Container size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Docker & Container Hub
                    <span className="px-1.5 py-0.5 rounded-md bg-sky-500/10 text-[9px] text-sky-400 border border-sky-500/20 uppercase tracking-wider font-semibold">
                      WSL Integrated
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Live Environment Manager</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchData(true)}
                  disabled={loading}
                  className="p-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Force Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-2 bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-sky-400 transition-colors">
                <Search size={14} />
              </div>
              <input 
                type="text"
                placeholder="Search container names, images, status or ID..."
                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg py-2.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 transition-all shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 flex flex-col">
            {error ? (
              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                <div className="p-4 bg-sky-500/5 rounded-2xl text-sky-400 mb-4 border border-sky-500/10 shadow-[0_0_30px_rgba(14,165,233,0.05)]">
                  <ShieldAlert size={36} />
                </div>
                <p className="text-sm font-bold text-white mb-2">Docker Daemon Connection Offline</p>
                <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed">
                  We could not connect to Docker. Ensure Docker Desktop is active on Windows, or if running in WSL, make sure the service is running.
                </p>
                
                <div className="mt-6 flex flex-col gap-2 text-left max-w-sm bg-zinc-900/30 border border-zinc-850 p-4 rounded-lg text-[10px] text-zinc-450 font-mono">
                  <p className="text-zinc-300 font-semibold mb-1 uppercase tracking-wider">Troubleshooting Command:</p>
                  <p className="bg-black/40 px-2 py-1.5 rounded border border-zinc-800/80 text-sky-450">wsl.exe sudo service docker start</p>
                </div>

                <button 
                  onClick={() => fetchData(true)}
                  disabled={loading}
                  className="mt-6 px-5 py-2 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(14,165,233,0.2)] disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                  Retry Connection
                </button>
              </div>
            ) : filteredContainers.length === 0 && !loading ? (
              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center opacity-40 animate-in fade-in duration-500">
                <Container size={48} className="text-zinc-600 mb-3 animate-pulse" />
                <p className="text-sm font-bold text-white">No Docker Containers Found</p>
                <p className="text-[11px] text-zinc-500">Your docker host contains no containers matching the filter</p>
              </div>
            ) : (
              <div className="flex-1 min-w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 bg-zinc-900/10 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      <th className="py-3 px-5 w-52">Container</th>
                      <th className="py-3 px-4 w-28">State</th>
                      <th className="py-3 px-4 w-44">Ports</th>
                      <th className="py-3 px-4 w-48">Resource Stats</th>
                      <th className="py-3 px-5 text-right w-52">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/50">
                    {filteredContainers.map((container, index) => {
                      const containerStats = stats[container.id];
                      const isRunning = container.state.toLowerCase() === "running";
                      const isPaused = container.state.toLowerCase() === "paused";
                      const isLoading = actionLoadingMap[container.id];
                      const portsList = parsePorts(container.ports);

                      return (
                        <tr 
                          key={container.id}
                          className="group hover:bg-zinc-900/35 transition-colors animate-in fade-in duration-300"
                          style={{ animationDelay: `${index * 25}ms` }}
                        >
                          {/* Name & Image */}
                          <td className="py-3.5 px-5">
                            <div className="flex flex-col gap-1 max-w-xs">
                              <span className="text-xs font-bold text-zinc-250 truncate group-hover:text-white transition-colors">
                                {container.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-mono font-medium">
                                <span className="bg-zinc-900 border border-zinc-800 px-1 rounded select-all truncate max-w-[140px]" title={container.image}>
                                  {container.image}
                                </span>
                                <span className="text-zinc-600 font-normal">|</span>
                                <span className="select-all font-semibold uppercase">{container.id.slice(0, 12)}</span>
                              </div>
                            </div>
                          </td>

                          {/* State & Status */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(container.state)}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${getStatusTextClass(container.state)}`}>
                                  {container.state}
                                </span>
                              </div>
                              <span className="text-[9px] text-zinc-500 font-mono">
                                {container.status}
                              </span>
                            </div>
                          </td>

                          {/* Ports */}
                          <td className="py-3.5 px-4">
                            {portsList.length === 0 ? (
                              <span className="text-[10px] text-zinc-600 font-mono font-medium">-</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {portsList.map((p, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => window.open(`http://localhost:${p.host}`)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-sky-400 hover:text-sky-300 hover:border-sky-500/30 rounded text-[9px] font-mono font-semibold transition-all active:scale-90"
                                    title={`Open http://localhost:${p.host}`}
                                  >
                                    <span>{p.host}:{p.container}</span>
                                    <ExternalLink size={8} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* CPU & Memory gauges */}
                          <td className="py-3.5 px-4">
                            {isRunning && containerStats ? (
                              <div className="flex flex-col gap-2 max-w-[160px]">
                                {/* CPU */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[9px] font-mono text-zinc-450">
                                    <span className="flex items-center gap-1 font-semibold"><Cpu size={10} className="text-zinc-500" /> CPU</span>
                                    <span className="text-zinc-300 font-bold">{containerStats.cpu_perc}</span>
                                  </div>
                                  <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full" 
                                      style={{ width: `${Math.min(100, parseFloat(containerStats.cpu_perc) || 0)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Memory */}
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex justify-between text-[8px] font-mono text-zinc-450 leading-none">
                                    <span className="flex items-center gap-1 font-semibold"><HardDrive size={10} className="text-zinc-500" /> MEM</span>
                                    <span className="text-zinc-350 font-medium truncate max-w-[80px]" title={containerStats.mem_usage}>
                                      {containerStats.mem_usage.split("/")[0].trim()}
                                    </span>
                                  </div>
                                  <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-teal-500 to-sky-500 rounded-full" 
                                      style={{ width: `${Math.min(100, parseFloat(containerStats.mem_perc) || 0)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-mono font-medium">-</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isLoading ? (
                                <RefreshCw size={12} className="animate-spin text-zinc-500 py-1" />
                              ) : (
                                <>
                                  {/* Lifecycle Control Trigger */}
                                  {isRunning ? (
                                    <>
                                      <button 
                                        onClick={() => handleAction(container.id, "stop")}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-red-500/10 text-zinc-450 hover:text-red-400 border border-zinc-800 rounded-md transition-all active:scale-90"
                                        title="Stop Container"
                                      >
                                        <Square size={12} fill="currentColor" className="stroke-none" />
                                      </button>
                                      <button 
                                        onClick={() => handleAction(container.id, "pause")}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-amber-500/10 text-zinc-450 hover:text-amber-400 border border-zinc-800 rounded-md transition-all active:scale-90"
                                        title="Pause Container"
                                      >
                                        <Pause size={12} fill="currentColor" className="stroke-none" />
                                      </button>
                                      <button 
                                        onClick={() => handleAction(container.id, "restart")}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-455 hover:text-white border border-zinc-800 rounded-md transition-all active:scale-90"
                                        title="Restart Container"
                                      >
                                        <RotateCcw size={12} />
                                      </button>
                                    </>
                                  ) : isPaused ? (
                                    <button 
                                      onClick={() => handleAction(container.id, "unpause")}
                                      className="p-1.5 bg-zinc-900/60 hover:bg-emerald-500/10 text-zinc-455 hover:text-emerald-400 border border-zinc-800 rounded-md transition-all active:scale-90"
                                      title="Resume Container"
                                    >
                                      <Play size={12} fill="currentColor" className="stroke-none" />
                                    </button>
                                  ) : (
                                    <>
                                      <button 
                                        onClick={() => handleAction(container.id, "start")}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-emerald-500/10 text-zinc-455 hover:text-emerald-400 border border-zinc-800 rounded-md transition-all active:scale-90"
                                        title="Start Container"
                                      >
                                        <Play size={12} fill="currentColor" className="stroke-none" />
                                      </button>
                                      <button 
                                        onClick={() => handleAction(container.id, "remove")}
                                        className="p-1.5 bg-zinc-900/60 hover:bg-red-500/10 text-zinc-455 hover:text-red-400 border border-zinc-800 rounded-md transition-all active:scale-90"
                                        title="Remove Container"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </>
                                  )}

                                  {/* Spawn Terminal button */}
                                  {isRunning && (
                                    <button 
                                      onClick={() => handleSpawnShell(container.id, container.name)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 active:scale-95 text-black hover:text-zinc-950 font-bold rounded-lg transition-all text-[10px] shadow-[0_0_12px_rgba(14,165,233,0.1)] border border-sky-500/20 whitespace-nowrap shrink-0"
                                      title="Open interactive terminal lane inside container"
                                    >
                                      <Terminal size={11} strokeWidth={2.5} />
                                      <span>Spawn Shell</span>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </>
  );
}
