import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Globe,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Wifi,
  RefreshCw,
  Radio,
  ChevronRight,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { eventBus } from "@/services/event-bus";

interface PortInfo {
  port: number;
  pid: number;
  process_name: string;
  state: string;
}

interface PortForwardingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onForwardedCountChange?: (count: number) => void;
}

export function PortForwardingPanel({
  isOpen,
  onClose,
  onForwardedCountChange,
}: PortForwardingPanelProps) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [manualPorts, setManualPorts] = useState<number[]>([]);
  const [activeTunnels, setActiveTunnels] = useState<Record<number, string>>({});
  const [tunnelsLoading, setTunnelsLoading] = useState<Record<number, boolean>>({});
  const [copiedPort, setCopiedPort] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [addPortValue, setAddPortValue] = useState("");
  const [addPortError, setAddPortError] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [portList, tunnels] = await Promise.all([
        invoke<PortInfo[]>("get_active_ports"),
        invoke<Record<number, string>>("get_active_tunnels"),
      ]);
      setPorts(portList);
      setActiveTunnels(tunnels);
    } catch (err) {
      console.error("PortForwardingPanel fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const count = Object.keys(activeTunnels).length;
    onForwardedCountChange?.(count);
  }, [activeTunnels, onForwardedCountChange]);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    fetchAll();
    intervalRef.current = setInterval(fetchAll, 5000);
    const unsub = eventBus.subscribe("ports-changed", fetchAll);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      unsub();
    };
  }, [isOpen, fetchAll]);

  // All unique ports to display: auto-detected + manually added
  const allPorts = [
    ...ports,
    ...manualPorts
      .filter((mp) => !ports.find((p) => p.port === mp))
      .map((mp) => ({
        port: mp,
        pid: 0,
        process_name: "Manual",
        state: "LISTEN",
      })),
  ];

  const handleExpose = async (port: number) => {
    setTunnelsLoading((prev) => ({ ...prev, [port]: true }));
    try {
      const url = await invoke<string>("start_port_tunnel", { port });
      setActiveTunnels((prev) => ({ ...prev, [port]: url }));
    } catch (err) {
      console.error(`Failed to expose port ${port}:`, err);
    } finally {
      setTunnelsLoading((prev) => ({ ...prev, [port]: false }));
    }
  };

  const handleStop = async (port: number) => {
    setTunnelsLoading((prev) => ({ ...prev, [port]: true }));
    try {
      await invoke("stop_port_tunnel", { port });
      setActiveTunnels((prev) => {
        const copy = { ...prev };
        delete copy[port];
        return copy;
      });
    } catch (err) {
      console.error(`Failed to stop tunnel for port ${port}:`, err);
    } finally {
      setTunnelsLoading((prev) => ({ ...prev, [port]: false }));
    }
  };

  const handleCopy = async (port: number, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPort(port);
      setTimeout(() => setCopiedPort(null), 2000);
    } catch (err) {
      console.error("Clipboard write failed:", err);
    }
  };

  const handleAddPort = () => {
    const num = parseInt(addPortValue.trim(), 10);
    if (isNaN(num) || num < 1 || num > 65535) {
      setAddPortError("Enter a valid port (1–65535)");
      return;
    }
    if (allPorts.find((p) => p.port === num)) {
      setAddPortError("Port already listed");
      return;
    }
    setManualPorts((prev) => [...prev, num]);
    setAddPortValue("");
    setAddPortError("");
  };

  const forwardedCount = Object.keys(activeTunnels).length;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — semi-transparent, click to close */}
      <div
        className="fixed inset-0 z-[90]"
        onClick={onClose}
      />

      {/* Panel — anchored above the status bar (h-6 = 24px) */}
      <div
        className="fixed bottom-6 left-0 right-0 z-[91] mx-auto"
        style={{ maxWidth: "900px", padding: "0 12px" }}
      >
        <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 border-b-0 rounded-t-xl shadow-[0_-12px_40px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 fade-in duration-250 overflow-hidden flex flex-col"
          style={{ maxHeight: "380px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <Radio size={13} className="text-sky-400" />
                <span className="text-[12px] font-semibold text-white tracking-tight">
                  Port Forwarding
                </span>
              </div>
              {forwardedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/25 text-[10px] font-bold text-sky-400 animate-pulse">
                  {forwardedCount} Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchAll}
                disabled={loading}
                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-all active:scale-95 disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-300 transition-all active:scale-95"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Add Port Row */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/20 shrink-0">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Plus size={11} />
              <span className="text-[11px] font-medium">Forward Port</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {addPortError && (
                <span className="text-[10px] text-red-400">{addPortError}</span>
              )}
              <input
                ref={addInputRef}
                type="number"
                min={1}
                max={65535}
                value={addPortValue}
                onChange={(e) => {
                  setAddPortValue(e.target.value);
                  setAddPortError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPort();
                  if (e.key === "Escape") onClose();
                }}
                placeholder="e.g. 3000"
                className="w-28 bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/50 transition-all"
              />
              <button
                onClick={handleAddPort}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-[11px] font-medium transition-all active:scale-95"
              >
                <Plus size={11} />
                Add
              </button>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid text-[10px] font-bold text-zinc-600 uppercase tracking-widest px-4 py-1.5 border-b border-zinc-800/40 bg-zinc-900/10 shrink-0"
            style={{ gridTemplateColumns: "80px 1fr 140px 120px 180px 80px" }}
          >
            <div>Port</div>
            <div>Process</div>
            <div>Local Address</div>
            <div>Visibility</div>
            <div>Public URL</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Port Rows */}
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {allPorts.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 opacity-30">
                <Wifi size={28} className="text-zinc-500" />
                <p className="text-xs text-zinc-400 font-medium">No active ports detected</p>
                <p className="text-[10px] text-zinc-600">Start a dev server or add a port manually</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-900/60">
                {allPorts.map((p, i) => {
                  const tunnel = activeTunnels[p.port];
                  const isLoading = !!tunnelsLoading[p.port];
                  const isShared = !!tunnel;

                  return (
                    <div
                      key={`${p.port}-${p.pid}`}
                      className="grid items-center px-4 py-2.5 hover:bg-zinc-900/30 transition-colors group animate-in fade-in duration-200"
                      style={{
                        gridTemplateColumns: "80px 1fr 140px 120px 180px 80px",
                        animationDelay: `${i * 20}ms`,
                      }}
                    >
                      {/* Port */}
                      <div>
                        <span className="font-mono font-bold text-[12px] text-emerald-400 group-hover:text-emerald-300 transition-colors">
                          {p.port}
                        </span>
                      </div>

                      {/* Process */}
                      <div className="min-w-0 pr-3">
                        <span className="text-[11px] text-zinc-300 truncate block">
                          {p.process_name}
                          {p.pid > 0 && (
                            <span className="ml-1.5 text-[10px] text-zinc-600 font-mono">
                              PID {p.pid}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Local Address */}
                      <div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          localhost:{p.port}
                        </span>
                      </div>

                      {/* Visibility */}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isShared
                                ? "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)] animate-pulse"
                                : "bg-zinc-700"
                            }`}
                          />
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-tight ${
                              isShared ? "text-sky-400" : "text-zinc-500"
                            }`}
                          >
                            {isShared ? "Public" : "Local"}
                          </span>
                        </div>
                      </div>

                      {/* Public URL */}
                      <div className="min-w-0 pr-2">
                        {isShared ? (
                          <div className="flex items-center gap-1 animate-in fade-in duration-200">
                            <span className="text-[10px] font-mono text-sky-400 truncate max-w-[140px] bg-sky-500/8 border border-sky-500/20 rounded px-1.5 py-0.5">
                              {tunnel}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-700">—</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Open localhost */}
                        <button
                          onClick={() => window.open(`http://localhost:${p.port}`)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all active:scale-90"
                          title="Open in Browser"
                        >
                          <ChevronRight size={12} />
                        </button>

                        {/* Copy tunnel URL */}
                        {isShared && (
                          <button
                            onClick={() => handleCopy(p.port, tunnel)}
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-sky-400 transition-all active:scale-90"
                            title="Copy Public URL"
                          >
                            {copiedPort === p.port ? (
                              <Check size={12} className="text-sky-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        )}

                        {/* Open public URL */}
                        {isShared && (
                          <a
                            href={tunnel}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-600 hover:text-sky-400 transition-all active:scale-90"
                            title="Open Public URL"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                        {/* Expose / Stop */}
                        {isLoading ? (
                          <div className="p-1.5 text-zinc-500">
                            <Loader2 size={12} className="animate-spin" />
                          </div>
                        ) : isShared ? (
                          <button
                            onClick={() => handleStop(p.port)}
                            className="p-1.5 rounded hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400 transition-all active:scale-90"
                            title="Stop Tunnel"
                          >
                            <Globe size={12} className="animate-pulse" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleExpose(p.port)}
                            className="p-1.5 rounded hover:bg-sky-500/10 text-zinc-600 hover:text-sky-400 transition-all active:scale-90"
                            title="Expose Port (Public Tunnel)"
                          >
                            <Globe size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-800/40 bg-zinc-900/20 shrink-0">
            <span className="text-[10px] text-zinc-600">
              Auto-refreshes every 5s · Tunneled via localtunnel
            </span>
            <span className="text-[10px] text-zinc-700">
              {allPorts.length} port{allPorts.length !== 1 ? "s" : ""} · {forwardedCount} forwarded
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
