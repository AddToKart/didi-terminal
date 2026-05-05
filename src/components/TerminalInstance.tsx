import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { Terminal as TerminalIcon, X, Zap } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

const READY_PATTERNS = [
  "Ask anything",
  "Type your message",
  "Type your message or @path/to/file",
  "PS ",
  "$ ",
  ">>> ",
];

interface Props {
  agentName: string;
  cwd?: string | null;
  onRemove?: () => void;
}

export function TerminalInstance({ agentName, cwd, onRemove }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unlistenHandoff = listen<{ target: string, payload: string }>("agent-handoff", (event) => {
      if (event.payload.target.trim().toLowerCase() === agentName.toLowerCase()) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 3000);
      }
    });

    return () => {
      unlistenHandoff.then(f => f());
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
      customGlyphs: true,
    });
    
    const fitAddon = new FitAddon();
    term.current.loadAddon(fitAddon);
    term.current.open(terminalRef.current);
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
      invoke("write_pty", { agent: agentName.toLowerCase(), data }).catch(console.error);
    });

    term.current.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.key === "v" && e.type === "keydown") {
        readText().then((text) => {
          if (text) {
            invoke("write_pty", { agent: agentName.toLowerCase(), data: text }).catch(console.error);
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
        invoke("write_pty", { agent: agentName.toLowerCase(), data: text }).catch(console.error);
      }
    };

    const container = terminalRef.current;
    container?.addEventListener("paste", handlePaste);

    const promptReadySent = { current: false };
    const outputBuffer = { current: "" };

    const unlistenPty = listen<{ agent: string, data: string }>("pty-output", (event) => {
      if (event.payload.agent === agentName.toLowerCase()) {
        term.current?.write(event.payload.data);

        if (!promptReadySent.current) {
          const text = stripTerminalControls(event.payload.data).replace(/\s+/g, " ");
          outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);
          if (READY_PATTERNS.some(p => outputBuffer.current.includes(p))) {
            promptReadySent.current = true;
            setIsReady(true);
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

  return (
    <div className={`flex flex-col h-full w-full bg-[#020202] border transition-colors duration-300 ${isPulsing ? 'border-brand-cyan animate-pulse-border shadow-[0_0_15px_rgba(0,240,255,0.2)] z-10 relative' : 'border-app-border z-0'}`}>
      {/* Terminal Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b transition-colors duration-300 ${isPulsing ? 'bg-brand-cyan/10 border-brand-cyan/50' : 'bg-[#080809] border-app-border'}`}>
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className={isPulsing ? 'text-brand-cyan' : 'text-slate-500'} />
          <span className={`text-[11px] font-bold tracking-widest uppercase ${isPulsing ? 'text-brand-cyan' : 'text-slate-300'}`}>
            {agentName}
          </span>
          {isPulsing && <Zap size={12} className="text-brand-amber animate-pulse" />}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-brand-amber animate-pulse'}`}></div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              {isReady ? 'IDLE' : 'INIT'}
            </span>
          </div>
          {onRemove && (
            <button 
              onClick={onRemove}
              className="text-slate-500 hover:text-red-400 transition-colors bg-app-bg hover:bg-red-400/10 p-1 rounded-sm border border-app-border hover:border-red-400/30"
              title="Terminate Agent"
            >
              <X size={10} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>
      
      {/* Terminal Content */}
      <div className={`flex-1 overflow-hidden p-1.5 ${isPulsing ? 'animate-flash-bg' : ''}`}>
        <div className="h-full w-full terminal-surface" ref={terminalRef}></div>
      </div>
    </div>
  );
}
