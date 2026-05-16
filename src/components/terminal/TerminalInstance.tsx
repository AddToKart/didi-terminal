import { memo, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal as TerminalIcon, X, Zap, ExternalLink, Plus, GripVertical, Search, ChevronRight } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Terminal } from "@xterm/xterm";
import { useXTerm } from "./useXTerm";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadTerminalLanes,
  saveTerminalLanes,
  type TerminalLane,
} from "../../services/terminal-lanes";

const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

const CLI_PROFILES = [
  {
    name: "opencode",
    patterns: ["Ask anything", "Build ·", "commands"],
  },
  {
    name: "copilot",
    patterns: ["GitHub Copilot", "ctrl+p commands", "commands ? help"],
  },
  {
    name: "gemini",
    patterns: ["Type your message", "Type your message or @path/to/file", "Gemini CLI"],
  },
  {
    name: "shell",
    patterns: ["PS ", "$ ", ">>> "],
  },
];

const isPromptReady = (value: string) =>
  CLI_PROFILES.some(profile => profile.patterns.some(pattern => value.includes(pattern))) ||
  /(^|\s)>($|\s)/.test(value);

const getAgentId = (agentName: string) =>
  agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const getPtyEventKey = (agent: string) => agent.replace(/[^a-zA-Z0-9]/g, "_");
const STATS_REFRESH_MS = 10000;
interface PtyOutputPayload {
  agent: string;
  workspace?: string;
  data: string;
  bytes?: string | number[];
}

interface PtyScrollback {
  data: string;
  bytes?: string | number[];
}

const decodeBase64Bytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getTerminalWritePayload = (payload: Pick<PtyOutputPayload, "data" | "bytes">) => {
  if (typeof payload.bytes === "string" && payload.bytes.length > 0) {
    return decodeBase64Bytes(payload.bytes);
  }

  if (Array.isArray(payload.bytes) && payload.bytes.length > 0) {
    return new Uint8Array(payload.bytes);
  }

  return payload.data;
};

const getNextLaneIndex = (lanes: TerminalLane[]) => {
  const usedIndexes = new Set(
    lanes
      .map(lane => lane.agentName.match(/\slane\s(\d+)$/i)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(value => Number(value))
  );

  let index = 2;
  while (usedIndexes.has(index)) index += 1;
  return index;
};

interface Props {
  agentId: string;
  agentName: string;
  cwd?: string | null;
  onRemove?: () => void;
  onDetach?: () => void;
  onSplit?: () => void;
  dragAttributes?: any;
  dragListeners?: any;
  workspaceName?: string;
  workspaceId?: string;
  isZenMode?: boolean;
  onFocus?: () => void;
}

interface TerminalLaneStripProps {
  lanes: TerminalLane[];
  activeLaneId: string;
  editingLaneId: string | null;
  editLaneLabel: string;
  onSelectLane: (laneId: string) => void;
  onAddLane: (event: React.MouseEvent) => void;
  onCloseLane: (event: React.MouseEvent, laneId: string) => void;
  onStartRenameLane: (lane: TerminalLane) => void;
  onEditLaneLabelChange: (value: string) => void;
  onCommitRenameLane: () => void;
  onCancelRenameLane: () => void;
}

const TerminalLaneStrip = memo(({
  lanes,
  activeLaneId,
  editingLaneId,
  editLaneLabel,
  onSelectLane,
  onAddLane,
  onCloseLane,
  onStartRenameLane,
  onEditLaneLabelChange,
  onCommitRenameLane,
  onCancelRenameLane,
}: TerminalLaneStripProps) => (
  <div
    className="h-full flex items-center min-w-0 flex-1 overflow-x-auto custom-scrollbar border-l border-app-border"
    onPointerDown={(event) => event.stopPropagation()}
    onContextMenu={(event) => event.stopPropagation()}
  >
    <div className="flex items-center h-full">
      {lanes.map((lane) => {
        const isActive = lane.id === activeLaneId;
        const isEditing = lane.id === editingLaneId;
        return (
          <div
            key={lane.id}
            onClick={() => {
              if (!isEditing) onSelectLane(lane.id);
            }}
            onDoubleClick={() => onStartRenameLane(lane)}
            className={`group flex items-center gap-2 px-3 h-full border-r border-app-border cursor-pointer select-none min-w-[92px] max-w-[160px] transition-all ${isActive
                ? "bg-app-panel text-white shadow-[inset_0_-2px_0_0_var(--tw-colors-brand-accent)]"
                : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            title={`Switch to ${lane.label}`}
          >
            {isEditing ? (
              <input
                value={editLaneLabel}
                onChange={(event) => onEditLaneLabelChange(event.target.value)}
                onBlur={onCommitRenameLane}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCommitRenameLane();
                  if (event.key === "Escape") onCancelRenameLane();
                }}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                autoFocus
                className="bg-transparent border-none outline-none text-xs font-bold text-white flex-1 min-w-0"
              />
            ) : (
              <span className={`text-xs truncate flex-1 ${isActive ? "font-bold" : "font-medium"}`}>
                {lane.label}
              </span>
            )}
            {lane.id !== ROOT_TERMINAL_LANE_ID && (
              <button
                type="button"
                onClick={(event) => onCloseLane(event, lane.id)}
                onPointerDown={(event) => event.stopPropagation()}
                className={`p-1 rounded-md transition-colors ${isActive
                    ? "text-brand-primary/80 hover:text-white hover:bg-white/10"
                    : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                  }`}
                title={`Close ${lane.label}`}
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>
        );
      })}
    </div>
    <button
      type="button"
      onClick={onAddLane}
      onPointerDown={(event) => event.stopPropagation()}
      className="h-full w-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-r border-app-border shrink-0"
    >
      <Plus size={16} strokeWidth={2.5} />
    </button>
  </div>
));

export function TerminalInstance({ agentId, agentName, cwd, onRemove, onDetach, onSplit, dragAttributes, dragListeners, workspaceName, workspaceId, isZenMode, onFocus }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);

  const [isPulsing, setIsPulsing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState({ cpu: 0, mem: 0 });
  const [sentinelPaused, setSentinelPaused] = useState(false);
  const [lanes, setLanes] = useState<TerminalLane[]>(() => loadTerminalLanes(agentId, workspaceId));
  const [activeLaneId, setActiveLaneId] = useState(ROOT_TERMINAL_LANE_ID);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editLaneLabel, setEditLaneLabel] = useState("");

  const [isFocused, setIsFocused] = useState(false);
  const isReadyRef = useRef(isReady);
  const statsRef = useRef(stats);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPtyResizeRef = useRef<{ ptyKey: string; cols: number; rows: number } | null>(null);
  const suppressTerminalInputRef = useRef(false);
  const lanesRef = useRef(lanes);
  const terminalApiRef = useRef<Terminal | null>(null);

  const activeLane = lanes.find(lane => lane.id === activeLaneId) ?? lanes[0] ?? { id: ROOT_TERMINAL_LANE_ID, label: "Main", agentName: agentId };
  const getLanePtyKey = useCallback((laneAgentId: string) => {
    return getTerminalLanePtyKey(workspaceId, laneAgentId);
  }, [workspaceId]);

  // The globally unique identifier for the active lane's process in the Rust backend
  const ptyKey = getLanePtyKey(activeLane.agentName);
  const ptyEventKey = getPtyEventKey(ptyKey);

  const setReadyState = useCallback((nextReady: boolean) => {
    if (isReadyRef.current === nextReady) return;
    isReadyRef.current = nextReady;
    setIsReady(nextReady);
    // Emit state so sidebar can show running indicators
    emit("agent-state", { agent: ptyKey, isReady: nextReady }).catch(console.error);
  }, [ptyKey]);

  const setStatsState = useCallback((nextStats: { cpu: number; mem: number }) => {
    const current = statsRef.current;
    if (Math.abs(current.cpu - nextStats.cpu) < 0.1 && current.mem === nextStats.mem) return;
    statsRef.current = nextStats;
    setStats(nextStats);
  }, []);

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    const restoredLanes = loadTerminalLanes(agentId, workspaceId);
    setLanes(restoredLanes);
    setActiveLaneId(ROOT_TERMINAL_LANE_ID);
    setEditingLaneId(null);
    setEditLaneLabel("");
    // Removed setReadyState and setStatsState from deps to fix cycle bug
  }, [agentId, workspaceId]);

  useEffect(() => {
    saveTerminalLanes(agentId, workspaceId, lanes);
  }, [agentId, workspaceId, lanes]);

  const handleSelectLane = useCallback((laneId: string) => {
    if (laneId === activeLaneId) return;
    setActiveLaneId(laneId);
  }, [activeLaneId]);

  const handleAddLane = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const nextIndex = getNextLaneIndex(lanesRef.current);

    const laneId = crypto.randomUUID();
    const lane: TerminalLane = {
      id: laneId,
      label: `Lane ${nextIndex}`,
      agentName: `${agentId}::lane::${laneId}`,
    };

    setLanes(prev => [...prev, lane]);
    setActiveLaneId(lane.id);
  }, [agentId]);

  const handleCloseLane = useCallback((event: React.MouseEvent, laneId: string) => {
    event.stopPropagation();
    const currentLanes = lanesRef.current;
    const laneIndex = currentLanes.findIndex(lane => lane.id === laneId);
    const lane = currentLanes[laneIndex];
    if (!lane || lane.id === ROOT_TERMINAL_LANE_ID) return;

    invoke("close_pty", { agent: getLanePtyKey(lane.agentName) }).catch(console.error);
    setLanes(prev => prev.filter(item => item.id !== laneId));

    if (laneId === activeLaneId) {
      const fallbackLane = currentLanes[laneIndex - 1] ?? currentLanes[0];
      setActiveLaneId(fallbackLane.id);
      setReadyState(false);
      setStatsState({ cpu: 0, mem: 0 });
    }
  }, [activeLaneId, getLanePtyKey, setReadyState, setStatsState]);

  const closeExtraLanes = useCallback(() => {
    for (const lane of lanesRef.current) {
      if (lane.id === ROOT_TERMINAL_LANE_ID) continue;
      invoke("close_pty", { agent: getLanePtyKey(lane.agentName) }).catch(console.error);
    }
    clearTerminalLanes(agentName, workspaceId);
  }, [agentName, getLanePtyKey, workspaceId]);

  const handleRemovePane = useCallback(() => {
    closeExtraLanes();
    onRemove?.();
  }, [closeExtraLanes, onRemove]);

  const handleStartRenameLane = useCallback((lane: TerminalLane) => {
    setEditingLaneId(lane.id);
    setEditLaneLabel(lane.label);
  }, []);

  const handleCommitRenameLane = useCallback(() => {
    if (!editingLaneId) return;
    const nextLabel = editLaneLabel.trim();
    if (!nextLabel) {
      setEditingLaneId(null);
      return;
    }

    setLanes(prev => prev.map(lane => (
      lane.id === editingLaneId ? { ...lane, label: nextLabel } : lane
    )));
    setEditingLaneId(null);
  }, [editLaneLabel, editingLaneId]);

  const handleCancelRenameLane = useCallback(() => {
    setEditingLaneId(null);
    setEditLaneLabel("");
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSplit) onSplit();
  };


  const handlePopOut = async () => {
    const label = `agent-${ptyKey.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
    const params = new URLSearchParams({ agent: agentName });
    if (cwd) params.set("cwd", cwd);
    const popoutWindow = new WebviewWindow(label, {
      url: `/?${params.toString()}`,
      title: `${agentName} - DidiTerminal`,
      width: 800,
      height: 600,
    });

    popoutWindow.once('tauri://created', function () {
      if (onDetach) onDetach();
    });
    popoutWindow.once('tauri://error', function (e) {
      console.error('Failed to create popout window:', e);
    });
  };

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
          setStatsState({ cpu: result[0], mem: result[1] });
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
    };
  }, [ptyKey, isZenMode, setStatsState]);

  useEffect(() => {
    const unlistenHandoff = listen<{ target: string, payload: string }>("agent-handoff", (event) => {
      if (getAgentId(event.payload.target) === getAgentId(agentName)) {
        setReadyState(false);
        setIsPulsing(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 3000);
      }
    });

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
      unlistenHandoff.then(f => f());
    };
  }, [agentName, setReadyState]);

  useEffect(() => {
    const unlistenExit = listen<{ agent: string }>(`pty-exit-agent-${ptyEventKey}`, (event) => {
      if (event.payload.agent !== ptyKey) return;
      setReadyState(false);
      setStatsState({ cpu: 0, mem: 0 });
    });

    return () => {
      unlistenExit.then(f => f());
    };
  }, [ptyKey, ptyEventKey, setReadyState, setStatsState]);

  useEffect(() => {
    const unlistenSentinel = listen<{ agent: string }>("sentinel-intervention", (event) => {
      if (getAgentId(event.payload.agent) !== getAgentId(agentName)) return;
      setSentinelPaused(true);
      setReadyState(false);
      if (sentinelTimeoutRef.current) clearTimeout(sentinelTimeoutRef.current);
      sentinelTimeoutRef.current = setTimeout(() => setSentinelPaused(false), 7000);
    });

    return () => {
      if (sentinelTimeoutRef.current) {
        clearTimeout(sentinelTimeoutRef.current);
        sentinelTimeoutRef.current = null;
      }
      unlistenSentinel.then(f => f());
    };
  }, [agentName, setReadyState]);

  const writeTerminalInput = useCallback((data: string) => {
    if (!data) return;
    invoke("write_pty", { agent: ptyKey, data }).catch(console.error);
    emit("agent-input", { agent: ptyKey, data }).catch(console.error);
  }, [ptyKey]);

  const pasteTerminalInput = useCallback((text: string) => {
    if (!text) return;

    const activeTerminal = terminalApiRef.current;
    if (activeTerminal) {
      try {
        activeTerminal.paste(text);
        return;
      } catch (error) {
        console.warn("Falling back to direct PTY paste:", error);
      }
    }

    writeTerminalInput(text);
  }, [writeTerminalInput]);

  const handleTerminalData = useCallback((data: string) => {
    if (suppressTerminalInputRef.current) return;
    writeTerminalInput(data);
  }, [writeTerminalInput]);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    if (cols < 2 || rows < 2) return;
    const lastResize = lastPtyResizeRef.current;
    if (lastResize?.ptyKey === ptyKey && lastResize.cols === cols && lastResize.rows === rows) return;

    lastPtyResizeRef.current = { ptyKey, cols, rows };
    invoke("resize_pty", {
      agent: ptyKey,
      cols,
      rows
    }).catch(console.error);
  }, [ptyKey]);

  const handleTerminalKey = useCallback((e: KeyboardEvent) => {
    // Let xterm.js process standard keys by returning true
    
    // Prevent xterm from capturing Zen Mode shortcuts
    if (e.altKey && (
      e.code === "KeyQ" || 
      e.code === "KeyV" || 
      e.code === "KeyH" || 
      e.code === "KeyG" || 
      e.code === "KeyW" || 
      e.code === "KeyF" || 
      e.code === "KeyN" ||
      e.code === "Enter" ||
      /^Digit[1-9]$/.test(e.code)
    )) {
      return false; 
    }

    if (e.type === "keydown") {
      if (e.ctrlKey && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setShowTerminalFind(prev => !prev);
        return false;
      }

      if (e.ctrlKey && e.key === "v") {
        readText().then((text) => {
          pasteTerminalInput(text);
        }).catch(console.error);
        return false;
      }
    }

    return true; // Allow all other keys to be processed by xterm.js!
  }, [pasteTerminalInput]);

  const [terminalFindQuery, setTerminalFindQuery] = useState("");
  const [showTerminalFind, setShowTerminalFind] = useState(false);
  const terminalSearchRef = useRef<{ findNext: (t: string) => void; findPrevious: (t: string) => void } | null>(null);

  const handleTerminalFindChange = useCallback((value: string) => {
    setTerminalFindQuery(value);
    if (value) terminalSearchRef.current?.findNext(value);
  }, []);

  const handleTerminalFindKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) terminalSearchRef.current?.findPrevious(terminalFindQuery);
      else terminalSearchRef.current?.findNext(terminalFindQuery);
    }
    if (e.key === "Escape") {
      setShowTerminalFind(false);
      setTerminalFindQuery("");
    }
  }, [terminalFindQuery]);

  const { terminal, search: terminalSearch, isReady: isTerminalReady } = useXTerm(terminalRef, {
    agentName,
    onData: handleTerminalData,
    onResize: handleTerminalResize,
    onKey: handleTerminalKey,
  });

  terminalSearchRef.current = terminalSearch;
  terminalApiRef.current = terminal;

  const handleContainerClick = () => {
    if (terminal) {
      terminal.focus();
    }
    setIsFocused(true);
    onFocus?.();
  };

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = (e: React.FocusEvent) => {
    // Only unfocus if focus actually moved outside this pane
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsFocused(false);
    }
  };

  useEffect(() => {
    const unlistenFocus = listen<{ agent: string }>("focus-agent", (event) => {
      if (event.payload.agent === agentName && terminal) {
        terminal.focus();
        setIsFocused(true);
      }
    });

    return () => {
      unlistenFocus.then(f => f());
    };
  }, [agentName, terminal]);

  useEffect(() => {
    if (!isTerminalReady || !terminal) return;

    let cancelled = false;
    const outputBuffer = { current: "" };
    const lastReadyEmitAt = { current: 0 };
    try {
      terminal.reset();
    } catch (error) {
      console.warn("Skipped reset for disposed terminal:", error);
      return;
    }
    setReadyState(false);

    const unlistenPty = listen<PtyOutputPayload>(`pty-output-agent-${ptyEventKey}`, (event) => {
      if (cancelled) return;

      try {
        terminal.write(getTerminalWritePayload(event.payload));
      } catch (error) {
        cancelled = true;
        console.warn("Skipped write for disposed terminal:", error);
        return;
      }

      const text = stripTerminalControls(event.payload.data).replace(/\s+/g, " ");
      outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);

      if (isPromptReady(outputBuffer.current)) {
        const now = Date.now();
        setReadyState(true);

        if (now - lastReadyEmitAt.current > 1000) {
          lastReadyEmitAt.current = now;
          emit("agent-prompt-ready", { agent: ptyKey });
        }
      }
    });

    invoke<PtyScrollback>("spawn_pty", { agent: ptyKey, cwd: cwd || null, workspace_name: workspaceName || null })
      .then((scrollback) => {
        if (cancelled || !terminal) return;

        if ((scrollback.bytes?.length ?? 0) > 0 || scrollback.data) {
          try {
            suppressTerminalInputRef.current = true;
            terminal.write(getTerminalWritePayload(scrollback), () => {
              if (!cancelled) terminal.scrollToBottom();
            });
          } catch (error) {
            cancelled = true;
            console.warn("Skipped scrollback restore for disposed terminal:", error);
            return;
          } finally {
            suppressTerminalInputRef.current = false;
          }

          // Re-evaluate prompt readiness on scrollback restore
          const text = stripTerminalControls(scrollback.data).replace(/\s+/g, " ");
          outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);
          
          // Force ready state if we have scrollback, since the process is clearly alive
          setReadyState(true);
        }

        // Ensure the newly spawned PTY immediately gets the correct dimensions
        if (terminal.cols && terminal.rows) {
          handleTerminalResize(terminal.cols, terminal.rows);
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      unlistenPty.then(f => f());
    };
  }, [isTerminalReady, terminal, ptyKey, ptyEventKey, cwd, workspaceName, setReadyState, handleTerminalResize]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData("text");
      if (text) pasteTerminalInput(text);
    };

    const container = terminalRef.current;
    container?.addEventListener("paste", handlePaste);

    return () => {
      container?.removeEventListener("paste", handlePaste);
    };
  }, [pasteTerminalInput]);

  return (
    <div
      className={`flex flex-col h-full w-full bg-transparent transition-colors duration-300 ${isZenMode ? '' : sentinelPaused ? 'border border-red-400 shadow-sm z-10 relative' : isPulsing ? 'border border-brand-accent animate-pulse-border shadow-sm z-10 relative' : isFocused ? 'border border-brand-accent shadow-sm z-10 relative' : 'border border-app-border z-0'}`}
      tabIndex={-1}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleContainerClick}
    >

      {/* Terminal Header & Macros */}
      {!isZenMode && (
        <div
          className={`h-8 flex items-center border-b overflow-hidden transition-colors duration-300 ${sentinelPaused ? 'bg-red-500/10 border-red-400/50' : isPulsing ? 'bg-brand-accent/10 border-brand-accent/50' : isFocused ? 'bg-brand-accent/5 border-brand-accent/40' : 'bg-app-panel border-app-border'}`}
          onContextMenu={handleContextMenu}
        >
          <div
            className={`h-full flex items-center gap-2 px-3 shrink-0 select-none ${dragListeners ? 'cursor-grab active:cursor-grabbing' : ''}`}
            {...dragAttributes}
            {...dragListeners}
          >
            {dragListeners && <GripVertical size={12} className="text-slate-600" />}
            <TerminalIcon size={12} className={sentinelPaused ? 'text-red-300' : isPulsing ? 'text-brand-primary' : isFocused ? 'text-brand-accent' : 'text-slate-500'} />
            <span className={`text-[11px] font-bold tracking-widest uppercase ${sentinelPaused ? 'text-red-200' : isPulsing ? 'text-brand-primary' : isFocused ? 'text-brand-primary' : 'text-zinc-200'}`}>
              {agentName}
            </span>
            {(isPulsing || sentinelPaused) && <Zap size={12} className="text-brand-warn animate-pulse" />}
          </div>

          <TerminalLaneStrip
            lanes={lanes}
            activeLaneId={activeLaneId}
            editingLaneId={editingLaneId}
            editLaneLabel={editLaneLabel}
            onSelectLane={handleSelectLane}
            onAddLane={handleAddLane}
            onCloseLane={handleCloseLane}
            onStartRenameLane={handleStartRenameLane}
            onEditLaneLabelChange={setEditLaneLabel}
            onCommitRenameLane={handleCommitRenameLane}
            onCancelRenameLane={handleCancelRenameLane}
          />


          <div className="h-full flex items-center gap-3 px-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-[9px] font-mono text-zinc-400 font-bold mr-2">
              <span title="CPU Usage">{stats.cpu.toFixed(1)}% CPU</span>
              <span title="Memory Usage">{(stats.mem / 1024 / 1024).toFixed(0)} MB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-brand-warn animate-pulse'}`}></div>
              <span className="text-[9px] font-bold text-zinc-300 font-medium tracking-tight">
                {sentinelPaused ? 'PAUSED' : isReady ? 'IDLE' : 'INIT'}
              </span>
            </div>
            {onRemove && (
              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={handlePopOut}
                  className="text-slate-500 hover:text-brand-primary transition-colors bg-app-bg hover:bg-brand-accent/10 p-1 rounded-sm border border-app-border hover:border-brand-accent/30"
                  title="Pop-out Terminal"
                >
                  <ExternalLink size={10} strokeWidth={2} />
                </button>
                <button
                  onClick={handleRemovePane}
                  className="text-slate-500 hover:text-red-400 transition-colors bg-app-bg hover:bg-red-400/10 p-1 rounded-sm border border-app-border hover:border-red-400/30"
                  title="Terminate Agent"
                >
                  <X size={10} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminal Find */}
      {showTerminalFind && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-app-border bg-zinc-900/60 shrink-0">
          <Search size={12} className="text-zinc-500 shrink-0" />
          <input
            type="text"
            value={terminalFindQuery}
            onChange={e => handleTerminalFindChange(e.target.value)}
            onKeyDown={handleTerminalFindKeyDown}
            placeholder="Find in terminal..."
            className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none border-none"
            autoFocus
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => terminalSearch?.findPrevious(terminalFindQuery)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Previous (Shift+Enter)"
            >
              <ChevronRight size={12} className="rotate-180" />
            </button>
            <button
              onClick={() => terminalSearch?.findNext(terminalFindQuery)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Next (Enter)"
            >
              <ChevronRight size={12} />
            </button>
            <button
              onClick={() => { setShowTerminalFind(false); setTerminalFindQuery(""); }}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Terminal Content */}
      <div className={`flex-1 overflow-hidden relative group ${isPulsing ? 'animate-flash-bg' : ''}`}>
        {!isTerminalReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent z-20">
            <div className="animate-pulse text-zinc-500 text-xs tracking-widest uppercase">Loading Engine...</div>
          </div>
        )}
        <div className={`absolute terminal-surface bg-transparent overflow-hidden ${isZenMode ? 'inset-0' : 'inset-1.5'}`} ref={terminalRef} onClick={handleContainerClick}></div>
      </div>

    </div>
  );
}
