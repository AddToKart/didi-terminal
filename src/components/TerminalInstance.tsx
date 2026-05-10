import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal as TerminalIcon, X, Zap, Eraser, Play, ExternalLink } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useGhosttyTerminal } from "./useGhosttyTerminal";

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
}

export function TerminalInstance({ agentName, cwd, onRemove, onDetach, onSplit, dragAttributes, dragListeners, workspaceName, workspaceId }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  
  const [isPulsing, setIsPulsing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState({ cpu: 0, mem: 0 });
  const [sentinelPaused, setSentinelPaused] = useState(false);

  const [isFocused, setIsFocused] = useState(false);

  // The globally unique identifier for this process in the Rust backend
  const ptyKey = workspaceId ? `${workspaceId}::${agentName}`.toLowerCase() : agentName.toLowerCase();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSplit) onSplit();
  };

  const executeMacro = (command: string) => {
    invoke("write_pty", { agent: ptyKey, data: command + "\r" }).catch(console.error);
    emit("agent-input", { agent: ptyKey, data: command + "\r" }).catch(console.error);
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
    const statInterval = setInterval(async () => {
      try {
        const result: [number, number] = await invoke("get_process_stats", { agent: ptyKey });
        setStats({ cpu: result[0], mem: result[1] });
      } catch (e) {
        // Ignore errors
      }
    }, 4000);
    return () => clearInterval(statInterval);
  }, [ptyKey]);

  useEffect(() => {
    const unlistenHandoff = listen<{ target: string, payload: string }>("agent-handoff", (event) => {
      if (getAgentId(event.payload.target) === getAgentId(agentName)) {
        setIsReady(false);
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 3000);
      }
    });

    return () => {
      unlistenHandoff.then(f => f());
    };
  }, [agentName]);

  useEffect(() => {
    const unlistenExit = listen<{ agent: string }>("pty-exit", (event) => {
      if (event.payload.agent !== ptyKey) return;
      setIsReady(false);
      setStats({ cpu: 0, mem: 0 });
    });

    return () => {
      unlistenExit.then(f => f());
    };
  }, [ptyKey]);

  useEffect(() => {
    const unlistenSentinel = listen<{ agent: string }>("sentinel-intervention", (event) => {
      if (getAgentId(event.payload.agent) !== getAgentId(agentName)) return;
      setSentinelPaused(true);
      setIsReady(false);
      setTimeout(() => setSentinelPaused(false), 7000);
    });

    return () => {
      unlistenSentinel.then(f => f());
    };
  }, [agentName]);

  const handleTerminalData = (data: string) => {
    invoke("write_pty", { agent: ptyKey, data }).catch(console.error);
    emit("agent-input", { agent: ptyKey, data }).catch(console.error);
  };

  const handleTerminalResize = (cols: number, rows: number) => {
    invoke("resize_pty", {
      agent: ptyKey,
      cols,
      rows
    }).catch(console.error);
  };

  const handleTerminalKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "v" && e.type === "keydown") {
      readText().then((text) => {
        if (text) {
          invoke("write_pty", { agent: ptyKey, data: text }).catch(console.error);
          emit("agent-input", { agent: ptyKey, data: text }).catch(console.error);
        }
      }).catch(console.error);
      return true; // prevent default
    }
    return false; // allow default
  };

  const { terminal, isReady: isTerminalReady } = useGhosttyTerminal(terminalRef, {
    agentName,
    onData: handleTerminalData,
    onResize: handleTerminalResize,
    onKey: handleTerminalKey,
  });

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

    const outputBuffer = { current: "" };
    const lastReadyEmitAt = { current: 0 };

    const unlistenPty = listen<{ agent: string, data: string }>("pty-output", (event) => {
      if (event.payload.agent === ptyKey) {
        terminal.write(event.payload.data);

        const text = stripTerminalControls(event.payload.data).replace(/\s+/g, " ");
        outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);

        if (isPromptReady(outputBuffer.current)) {
          const now = Date.now();
          setIsReady(true);

          if (now - lastReadyEmitAt.current > 1000) {
            lastReadyEmitAt.current = now;
            emit("agent-prompt-ready", { agent: ptyKey });
          }
        }
      }
    });

    invoke<string>("spawn_pty", { agent: ptyKey, cwd: cwd || null, workspace_name: workspaceName || null })
      .then((scrollback) => {
        if (terminal && scrollback) {
          terminal.write(scrollback, () => {
            terminal.scrollToBottom();
          });
          
          // Re-evaluate prompt readiness on scrollback restore
          const text = stripTerminalControls(scrollback).replace(/\s+/g, " ");
          outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);
          if (isPromptReady(outputBuffer.current)) {
            setIsReady(true);
          }
        }
        
        // Ensure the newly spawned PTY immediately gets the correct dimensions
        if (terminal && terminal.cols && terminal.rows) {
          invoke("resize_pty", {
            agent: ptyKey,
            cols: terminal.cols,
            rows: terminal.rows
          }).catch(console.error);
        }
      })
      .catch(console.error);

    return () => {
      unlistenPty.then(f => f());
    };
  }, [isTerminalReady, terminal, ptyKey, cwd, workspaceName]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text");
      if (text) {
        invoke("write_pty", { agent: ptyKey, data: text }).catch(console.error);
        emit("agent-input", { agent: ptyKey, data: text }).catch(console.error);
      }
    };

    const container = terminalRef.current;
    container?.addEventListener("paste", handlePaste);

    return () => {
      container?.removeEventListener("paste", handlePaste);
    };
  }, [ptyKey]);

  return (
    <div 
      className={`flex flex-col h-full w-full bg-transparent border transition-colors duration-300 ${sentinelPaused ? 'border-red-400 shadow-sm z-10 relative' : isPulsing ? 'border-brand-accent animate-pulse-border shadow-sm z-10 relative' : isFocused ? 'border-brand-accent shadow-sm z-10 relative' : 'border-app-border z-0'}`}
      tabIndex={-1}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      
      {/* Terminal Header & Macros */}
      <div 
        className={`flex items-center justify-between px-3 py-1.5 border-b transition-colors duration-300 ${dragListeners ? 'cursor-grab active:cursor-grabbing' : ''} ${sentinelPaused ? 'bg-red-500/10 border-red-400/50' : isPulsing ? 'bg-brand-accent/10 border-brand-accent/50' : isFocused ? 'bg-brand-accent/5 border-brand-accent/40' : 'bg-app-panel border-app-border'}`}
        onContextMenu={handleContextMenu}
        title={dragListeners ? "Drag to reorder • Right-click to split pane" : "Right-click to split pane"}
        {...dragAttributes}
        {...dragListeners}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className={sentinelPaused ? 'text-red-300' : isPulsing ? 'text-brand-primary' : isFocused ? 'text-brand-accent' : 'text-slate-500'} />
          <span className={`text-[11px] font-bold tracking-widest uppercase ${sentinelPaused ? 'text-red-200' : isPulsing ? 'text-brand-primary' : isFocused ? 'text-brand-primary' : 'text-zinc-200'}`}>
            {agentName}
          </span>
          {(isPulsing || sentinelPaused) && <Zap size={12} className="text-brand-warn animate-pulse" />}
        </div>
        
        {/* Macro Bar */}
        <div className="flex flex-1 mx-4 justify-end gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
           <button onClick={() => executeMacro("clear")} className="px-1.5 py-0.5 text-[9px] bg-app-panel hover:bg-zinc-800/60 text-zinc-300 hover:text-brand-primary border border-app-border rounded flex items-center gap-1 font-bold">
             <Eraser size={9} /> CLEAR
           </button>
           <button onClick={() => executeMacro("npm run dev")} className="px-1.5 py-0.5 text-[9px] bg-app-panel hover:bg-zinc-800/60 text-zinc-300 hover:text-brand-primary border border-app-border rounded flex items-center gap-1 font-bold">
             <Play size={9} /> DEV
           </button>
        </div>

        <div className="flex items-center gap-3">
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
                onClick={onRemove}
                className="text-slate-500 hover:text-red-400 transition-colors bg-app-bg hover:bg-red-400/10 p-1 rounded-sm border border-app-border hover:border-red-400/30"
                title="Terminate Agent"
              >
                <X size={10} strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </div>
      
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
