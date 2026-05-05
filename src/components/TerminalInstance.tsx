import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import "@xterm/xterm/css/xterm.css";

const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

interface Props {
  agentName: string;
  cwd?: string | null;
}

export function TerminalInstance({ agentName, cwd }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    term.current = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        selectionBackground: "#334155",
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      cursorBlink: true,
      fontSize: 13,
      letterSpacing: 0.5,
    });
    
    const fitAddon = new FitAddon();
    term.current.loadAddon(fitAddon);
    term.current.open(terminalRef.current);
    fitAddon.fit();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (term.current) {
        invoke("resize_pty", {
           agent: agentName.toLowerCase(),
           cols: term.current.cols,
           rows: term.current.rows
        }).catch(console.error);
      }
    });
    resizeObserver.observe(terminalRef.current);

    term.current.onData((data) => {
      invoke("write_pty", { agent: agentName.toLowerCase(), data }).catch(console.error);
    });

    // Custom key handler to intercept Ctrl+V
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

    // Strings that indicate the terminal/agent is at an interactive prompt and ready for input.
    // OpenCode shows "Ask anything", PowerShell shows "PS ", bash shows "$ ".
    const READY_PATTERNS = ["Ask anything", "PS ", "$ ", ">>> "];

    const unlistenPty = listen<{ agent: string, data: string }>("pty-output", (event) => {
      if (event.payload.agent === agentName.toLowerCase()) {
        term.current?.write(event.payload.data);

        // Detect when the agent's prompt is ready and notify App.tsx
        if (!promptReadySent.current) {
          const text = stripTerminalControls(event.payload.data).replace(/\s+/g, " ");
          outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);
          if (READY_PATTERNS.some(p => outputBuffer.current.includes(p))) {
            promptReadySent.current = true;
            console.log(`[TerminalInstance] ${agentName} prompt is ready`);
            emit("agent-prompt-ready", { agent: agentName.toLowerCase() });
          }
        }
      }
    });

    // Initialize PTY
    invoke("spawn_pty", { agent: agentName.toLowerCase(), cwd: cwd || null }).catch(console.error);

    return () => {
      container?.removeEventListener("paste", handlePaste);
      resizeObserver.disconnect();
      unlistenPty.then(f => f());
      term.current?.dispose();
    };
  }, [agentName, cwd]);

  return (
    <div className="flex flex-col h-full w-full border-zinc-900 border">
      <div className="bg-zinc-900/50 text-sky-400 p-1 px-3 text-[10px] font-black border-b border-zinc-800 uppercase tracking-tighter flex justify-between items-center">
        <span>{agentName}</span>
        <span className="opacity-30 tracking-widest font-mono">DIDI_PTY_v2</span>
      </div>
      <div className="flex-1 overflow-hidden p-1 bg-black" ref={terminalRef}></div>
    </div>
  );
}
