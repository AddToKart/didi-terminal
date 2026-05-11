import { memo, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal as TerminalIcon, X, Zap, ExternalLink, Plus, GripVertical } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Terminal } from "ghostty-web";
import { useGhosttyTerminal } from "./useGhosttyTerminal";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadTerminalLanes,
  saveTerminalLanes,
  type TerminalLane,
} from "../services/terminal-lanes";

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
const RESIZE_DEBOUNCE_MS = 500;
const TERMINAL_OUTPUT_DECODER = new TextDecoder("utf-8", { fatal: false });
const SUSPICIOUS_TERMINAL_GLYPHS = /[\uFFFD\u2500-\u25FF\u2E80-\u2EFF\u2F00-\u2FDF\u3000-\u303F\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/gu;
const POWERSHELL_PROMPT = /PS\s+[A-Za-z]:\\[^\r\n>]*>/g;

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

const getTerminalWriteText = (payload: Pick<PtyOutputPayload, "data" | "bytes">) => {
  const text = (() => {
    if (typeof payload.bytes === "string" && payload.bytes.length > 0) {
      return TERMINAL_OUTPUT_DECODER.decode(decodeBase64Bytes(payload.bytes));
    }

    if (Array.isArray(payload.bytes) && payload.bytes.length > 0) {
      return TERMINAL_OUTPUT_DECODER.decode(new Uint8Array(payload.bytes));
    }

    return payload.data;
  })();

  return stripGarbledConptyRepaint(text);
};

const stripDisallowedControls = (value: string) =>
  value.replace(/[\x00-\x06\x0E-\x1A\x1C-\x1F\x7F]/g, "");

const isGarbledTerminalLine = (line: string) => {
  const visible = stripTerminalControls(line);
  const meaningfulChars = visible.replace(/\s/g, "");
  if (meaningfulChars.length < 24) return false;

  const suspiciousCount = [...visible.matchAll(SUSPICIOUS_TERMINAL_GLYPHS)].length;
  if (suspiciousCount < 8) return false;

  const asciiTextCount = (visible.match(/[A-Za-z0-9_./\\:-]/g) ?? []).length;
  return suspiciousCount / meaningfulChars.length > 0.2 || suspiciousCount > asciiTextCount;
};

const keepLastPromptFromNoisyLine = (line: string) => {
  const visible = stripTerminalControls(line);
  const prompts = [...visible.matchAll(POWERSHELL_PROMPT)];
  return prompts.length > 0 ? prompts[prompts.length - 1][0] : "";
};

const stripGarbledConptyRepaint = (value: string) => {
  const cleaned = stripDisallowedControls(value);
  const lines = cleaned.split(/(\r\n|\n|\r)/);

  return lines
    .map((line) => {
      if (line === "\r\n" || line === "\n" || line === "\r") return line;
      if (!isGarbledTerminalLine(line)) return line;
      return keepLastPromptFromNoisyLine(line);
    })
    .join("");
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
      title="New Lane"
    >
      <Plus size={16} strokeWidth={2.5} />
    </button>
  </div>
));

export function TerminalInstance({ agentName, cwd, onRemove, onDetach, onSplit, dragAttributes, dragListeners, workspaceName, workspaceId, isZenMode }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);

  const [isPulsing, setIsPulsing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState({ cpu: 0, mem: 0 });
  const [sentinelPaused, setSentinelPaused] = useState(false);
  const [lanes, setLanes] = useState<TerminalLane[]>(() => loadTerminalLanes(agentName, workspaceId));
  const [activeLaneId, setActiveLaneId] = useState(ROOT_TERMINAL_LANE_ID);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editLaneLabel, setEditLaneLabel] = useState("");

  const [isFocused, setIsFocused] = useState(false);
  const isReadyRef = useRef(isReady);
  const statsRef = useRef(stats);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPtyResizeRef = useRef<{ ptyKey: string; cols: number; rows: number } | null>(null);
  const suppressTerminalInputRef = useRef(false);
  const lanesRef = useRef(lanes);
  const terminalApiRef = useRef<Terminal | null>(null);

  const activeLane = lanes.find(lane => lane.id === activeLaneId) ?? lanes[0] ?? { id: ROOT_TERMINAL_LANE_ID, label: "Main", agentName };
  const getLanePtyKey = useCallback((laneAgentName: string) => {
    return getTerminalLanePtyKey(workspaceId, laneAgentName);
  }, [workspaceId]);

  // The globally unique identifier for the active lane's process in the Rust backend
  const ptyKey = getLanePtyKey(activeLane.agentName);
  const ptyEventKey = getPtyEventKey(ptyKey);

  const setReadyState = useCallback((nextReady: boolean) => {
    if (isReadyRef.current === nextReady) return;
    isReadyRef.current = nextReady;
    setIsReady(nextReady);
  }, []);

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
    const restoredLanes = loadTerminalLanes(agentName, workspaceId);
    setLanes(restoredLanes);
    setActiveLaneId(ROOT_TERMINAL_LANE_ID);
    setEditingLaneId(null);
    setEditLaneLabel("");
    setReadyState(false);
    setStatsState({ cpu: 0, mem: 0 });
  }, [agentName, workspaceId, setReadyState, setStatsState]);

  useEffect(() => {
    saveTerminalLanes(agentName, workspaceId, lanes);
  }, [agentName, workspaceId, lanes]);

  const handleSelectLane = useCallback((laneId: string) => {
    if (laneId === activeLaneId) return;
    setActiveLaneId(laneId);
    setReadyState(false);
    setStatsState({ cpu: 0, mem: 0 });
  }, [activeLaneId, setReadyState, setStatsState]);

  const handleAddLane = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    const nextIndex = getNextLaneIndex(lanesRef.current);

    const lane: TerminalLane = {
      id: crypto.randomUUID(),
      label: `Lane ${nextIndex}`,
      agentName: `${agentName} lane ${nextIndex}`,
    };

    setLanes(prev => [...prev, lane]);
    setActiveLaneId(lane.id);
    setReadyState(false);
    setStatsState({ cpu: 0, mem: 0 });
  }, [agentName, setReadyState, setStatsState]);

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

    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(() => {
      lastPtyResizeRef.current = { ptyKey, cols, rows };
      invoke("resize_pty", {
        agent: ptyKey,
        cols,
        rows
      }).catch(console.error);
    }, RESIZE_DEBOUNCE_MS);
  }, [ptyKey]);

  useEffect(() => () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, [ptyKey]);

  const handleTerminalKey = useCallback((e: KeyboardEvent) => {
    // Allow Zen Mode shortcut (Alt + Q) to bubble up
    if (e.altKey && e.code === "KeyQ") {
      return false;
    }

    if (e.ctrlKey && e.key === "v" && e.type === "keydown") {
      readText().then((text) => {
        pasteTerminalInput(text);
      }).catch(console.error);
      return true; // prevent default
    }
    return false; // allow default
  }, [pasteTerminalInput]);

  const { terminal, isReady: isTerminalReady } = useGhosttyTerminal(terminalRef, {
    agentName,
    onData: handleTerminalData,
    onResize: handleTerminalResize,
    onKey: handleTerminalKey,
  });

  terminalApiRef.current = terminal;

  const handleContainerClick = () => {
    if (terminal) {
      terminal.focus();
    }
    setIsFocused(true);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only unfocus if focus actually moved outside this pane
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsFocused(false);
    }
  };

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
        terminal.write(getTerminalWriteText(event.payload));
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
            terminal.write(getTerminalWriteText(scrollback), () => {
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
          if (isPromptReady(outputBuffer.current)) {
            setReadyState(true);
          }
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
    >

      {/* Terminal Header & Macros */}
      {!isZenMode && (
        <div
          className={`h-9 flex items-center border-b overflow-hidden transition-colors duration-300 ${sentinelPaused ? 'bg-red-500/10 border-red-400/50' : isPulsing ? 'bg-brand-accent/10 border-brand-accent/50' : isFocused ? 'bg-brand-accent/5 border-brand-accent/40' : 'bg-app-panel border-app-border'}`}
          onContextMenu={handleContextMenu}
          title={dragListeners ? "Drag to reorder • Right-click to split pane" : "Right-click to split pane"}
        >
          <div
            className={`h-full flex items-center gap-2 px-3 shrink-0 select-none ${dragListeners ? 'cursor-grab active:cursor-grabbing' : ''}`}
            title={dragListeners ? "Drag to reorder" : undefined}
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

      {/* Terminal Content */}
      <div className={`flex-1 overflow-hidden p-1.5 relative group ${isPulsing ? 'animate-flash-bg' : ''}`}>
        {!isTerminalReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent z-20">
            <div className="animate-pulse text-zinc-500 text-xs tracking-widest uppercase">Loading Engine...</div>
          </div>
        )}
        <div className="h-full w-full terminal-surface bg-[#09090b]" ref={terminalRef} onClick={handleContainerClick}></div>
      </div>

    </div>
  );
}
