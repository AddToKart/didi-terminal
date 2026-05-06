import { useEffect, useRef, useState, FormEvent } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal as TerminalIcon, X, Zap, Search, ChevronUp, ChevronDown, Eraser, Play, ExternalLink } from "lucide-react";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import "@xterm/xterm/css/xterm.css";

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
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export function TerminalInstance({ agentName, cwd, onRemove, onDetach, onDragStart, onDrop, onDragOver }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const searchAddon = useRef<SearchAddon | null>(null);
  
  const [isPulsing, setIsPulsing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ cpu: 0, mem: 0 });
  const [sentinelPaused, setSentinelPaused] = useState(false);

  const executeMacro = (command: string) => {
    const agent = agentName.toLowerCase();
    invoke("write_pty", { agent, data: command + "\r" }).catch(console.error);
    emit("agent-input", { agent, data: command + "\r" }).catch(console.error);
  };

  const handlePopOut = async () => {
    // Generate a unique label for the window
    const label = `agent-${agentName.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;
    const popoutWindow = new WebviewWindow(label, {
      url: `/?agent=${encodeURIComponent(agentName)}`,
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
        const result: [number, number] = await invoke("get_process_stats", { agent: agentName.toLowerCase() });
        setStats({ cpu: result[0], mem: result[1] });
      } catch (e) {
        // Ignore errors
      }
    }, 4000);
    return () => clearInterval(statInterval);
  }, [agentName]);

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
      if (event.payload.agent !== agentName.toLowerCase()) return;
      setIsReady(false);
      setStats({ cpu: 0, mem: 0 });
    });

    return () => {
      unlistenExit.then(f => f());
    };
  }, [agentName]);

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

  useEffect(() => {
    if (!terminalRef.current) return;

    term.current = new Terminal({
      theme: {
        background: '#020202',
        foreground: '#e2e8f0',
        cursor: '#00f0ff',
        selectionBackground: "#00f0ff40",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      cursorBlink: true,
      fontSize: 13,
      allowTransparency: true,
    });
    
    const fitAddon = new FitAddon();
    term.current.loadAddon(fitAddon);

    searchAddon.current = new SearchAddon();
    term.current.loadAddon(searchAddon.current);

    term.current.open(terminalRef.current);
    
    try {
      const webglAddon = new WebglAddon();
      term.current.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon failed to load", e);
    }

    fitAddon.fit();

    let resizeFrame: number | null = null;
    const fitTerminal = () => {
      resizeFrame = null;
      fitAddon.fit();
      if (term.current) {
        invoke("resize_pty", {
           agent: agentName.toLowerCase(),
           cols: term.current.cols,
           rows: term.current.rows
        }).catch(console.error);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(fitTerminal);
    });
    resizeObserver.observe(terminalRef.current);

    term.current.onData((data) => {
      const agent = agentName.toLowerCase();
      invoke("write_pty", { agent, data }).catch(console.error);
      emit("agent-input", { agent, data }).catch(console.error);
    });

    term.current.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === "f" && e.type === "keydown") {
        e.preventDefault();
        setShowSearch(true);
        return false;
      }
      if (e.key === "Escape" && e.type === "keydown") {
        setShowSearch(false);
        searchAddon.current?.clearDecorations();
      }
      if (e.ctrlKey && e.key === "v" && e.type === "keydown") {
        readText().then((text) => {
          if (text) {
            const agent = agentName.toLowerCase();
            invoke("write_pty", { agent, data: text }).catch(console.error);
            emit("agent-input", { agent, data: text }).catch(console.error);
          }
        }).catch(console.error);
        return false;
      }
      return true;
    });

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text");
      if (text) {
        const agent = agentName.toLowerCase();
        invoke("write_pty", { agent, data: text }).catch(console.error);
        emit("agent-input", { agent, data: text }).catch(console.error);
      }
    };

    const container = terminalRef.current;
    container?.addEventListener("paste", handlePaste);

    const outputBuffer = { current: "" };
    const lastReadyEmitAt = { current: 0 };

    const unlistenPty = listen<{ agent: string, data: string }>("pty-output", (event) => {
      if (event.payload.agent === agentName.toLowerCase()) {
        term.current?.write(event.payload.data);

        const text = stripTerminalControls(event.payload.data).replace(/\s+/g, " ");
        outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);

        if (isPromptReady(outputBuffer.current)) {
          const now = Date.now();
          setIsReady(true);

          if (now - lastReadyEmitAt.current > 1000) {
            lastReadyEmitAt.current = now;
            emit("agent-prompt-ready", { agent: agentName.toLowerCase() });
          }
        }
      }
    });

    invoke("spawn_pty", { agent: agentName.toLowerCase(), cwd: cwd || null }).catch(console.error);

    return () => {
      container?.removeEventListener("paste", handlePaste);
      resizeObserver.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      unlistenPty.then(f => f());
      term.current?.dispose();
    };
  }, [agentName, cwd]);

  const handleSearch = (e: FormEvent, direction: 'next' | 'prev' = 'next') => {
    e.preventDefault();
    if (!searchAddon.current || !searchQuery) return;
    
    // searchAddon decorations are an object not boolean in newer versions
    if (direction === 'next') {
      searchAddon.current.findNext(searchQuery, { decorations: { matchBackground: '#ffb000', matchBorder: '#ffb000', activeMatchBackground: '#00f0ff', activeMatchBorder: '#00f0ff', matchOverviewRuler: '#ffb000', activeMatchColorOverviewRuler: '#00f0ff' } });
    } else {
      searchAddon.current.findPrevious(searchQuery, { decorations: { matchBackground: '#ffb000', matchBorder: '#ffb000', activeMatchBackground: '#00f0ff', activeMatchBorder: '#00f0ff', matchOverviewRuler: '#ffb000', activeMatchColorOverviewRuler: '#00f0ff' } });
    }
  };

  return (
    <div className={`flex flex-col h-full w-full bg-[#020202] border transition-colors duration-300 ${sentinelPaused ? 'border-red-400 shadow-[0_0_18px_rgba(248,113,113,0.22)] z-10 relative' : isPulsing ? 'border-brand-cyan animate-pulse-border shadow-[0_0_15px_rgba(0,240,255,0.2)] z-10 relative' : 'border-app-border z-0'}`}>
      
      {/* Terminal Header & Macros */}
      <div 
        className={`flex items-center justify-between px-3 py-1.5 border-b transition-colors duration-300 cursor-grab active:cursor-grabbing ${sentinelPaused ? 'bg-red-500/10 border-red-400/50' : isPulsing ? 'bg-brand-cyan/10 border-brand-cyan/50' : 'bg-[#080809] border-app-border'}`}
        draggable
        onDragStart={onDragStart}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className={sentinelPaused ? 'text-red-300' : isPulsing ? 'text-brand-cyan' : 'text-slate-500'} />
          <span className={`text-[11px] font-bold tracking-widest uppercase ${sentinelPaused ? 'text-red-200' : isPulsing ? 'text-brand-cyan' : 'text-slate-300'}`}>
            {agentName}
          </span>
          {(isPulsing || sentinelPaused) && <Zap size={12} className="text-brand-amber animate-pulse" />}
        </div>
        
        {/* Macro Bar */}
        <div className="flex flex-1 mx-4 justify-end gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
           <button onClick={() => executeMacro("clear")} className="px-1.5 py-0.5 text-[9px] bg-[#111] hover:bg-[#1a1a1a] text-slate-400 hover:text-brand-cyan border border-app-border rounded flex items-center gap-1">
             <Eraser size={9} /> CLEAR
           </button>
           <button onClick={() => executeMacro("npm run dev")} className="px-1.5 py-0.5 text-[9px] bg-[#111] hover:bg-[#1a1a1a] text-slate-400 hover:text-brand-cyan border border-app-border rounded flex items-center gap-1">
             <Play size={9} /> DEV
           </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-[9px] font-mono text-slate-600 mr-2">
             <span title="CPU Usage">{stats.cpu.toFixed(1)}% CPU</span>
             <span title="Memory Usage">{(stats.mem / 1024 / 1024).toFixed(0)} MB</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-brand-amber animate-pulse'}`}></div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              {sentinelPaused ? 'PAUSED' : isReady ? 'IDLE' : 'INIT'}
            </span>
          </div>
          {onRemove && (
            <div className="flex items-center gap-1 ml-2">
              <button 
                onClick={handlePopOut}
                className="text-slate-500 hover:text-brand-cyan transition-colors bg-app-bg hover:bg-brand-cyan/10 p-1 rounded-sm border border-app-border hover:border-brand-cyan/30"
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

        {/* Search Overlay */}
        {showSearch && (
          <div className="absolute top-2 right-4 z-20 bg-app-panel border border-app-border shadow-lg p-1.5 flex items-center gap-2 rounded text-xs animate-in fade-in slide-in-from-top-2">
            <Search size={12} className="text-slate-500" />
            <form onSubmit={(e) => handleSearch(e, 'next')} className="flex items-center gap-1">
              <input 
                autoFocus
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..." 
                className="bg-black border border-app-border text-slate-200 px-2 py-0.5 outline-none focus:border-brand-cyan w-32"
              />
              <button type="button" onClick={(e) => handleSearch(e, 'prev')} className="p-1 text-slate-500 hover:text-slate-200 bg-black border border-app-border hover:border-slate-500"><ChevronUp size={12}/></button>
              <button type="submit" className="p-1 text-slate-500 hover:text-slate-200 bg-black border border-app-border hover:border-slate-500"><ChevronDown size={12}/></button>
            </form>
            <button onClick={() => { setShowSearch(false); searchAddon.current?.clearDecorations(); }} className="p-1 text-slate-500 hover:text-red-400 ml-1"><X size={12}/></button>
          </div>
        )}

        <div className="h-full w-full terminal-surface" ref={terminalRef}></div>
      </div>

    </div>
  );
}
