import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from "lucide-react";
import { useXTerm } from "@/components/terminal/useXTerm";
import { createXtermWriteQueue } from "@/lib/xterm-write-queue";

const EDITOR_PTY_AGENT = "editor-terminal";

interface EditorTerminalPaneProps {
  cwd: string | null;
  onClose?: () => void;
}

interface PtyOutputPayload {
  agent: string;
  data: string;
}

export function EditorTerminalPane({ cwd, onClose }: EditorTerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const writeQueueRef = useRef<ReturnType<typeof createXtermWriteQueue> | null>(null);
  const spawnedRef = useRef(false);

  const { terminal, isReady } = useXTerm(containerRef, {
    agentName: EDITOR_PTY_AGENT,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
    scrollback: 2000,
    theme: {
      background: "#0a0a0c",
      cursor: "#22d3ee",
      selectionBackground: "#22d3ee30",
    },
    onData: (data: string) => {
      if (spawnedRef.current) {
        invoke("write_pty", { agentName: EDITOR_PTY_AGENT, data }).catch(console.error);
      }
    },
    onResize: (cols: number, rows: number) => {
      if (spawnedRef.current) {
        invoke("resize_pty", { agentName: EDITOR_PTY_AGENT, cols, rows }).catch(console.error);
      }
    },
  });

  // terminal.open() is handled internally by useXTerm via containerRef
  // Set up write queue once terminal is ready
  useEffect(() => {
    if (!isReady || !terminal) return;
    writeQueueRef.current = createXtermWriteQueue(terminal);
  }, [isReady, terminal]);

  // Spawn the PTY once
  useEffect(() => {
    if (spawnedRef.current) return;
    spawnedRef.current = true;

    const spawnDir = cwd ?? undefined;
    invoke("spawn_pty", { agentName: EDITOR_PTY_AGENT, cwd: spawnDir })
      .catch(console.error);

    return () => {
      invoke("close_pty", { agentName: EDITOR_PTY_AGENT }).catch(() => {});
      spawnedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stream PTY output to the terminal
  useEffect(() => {
    const unlisten = listen<PtyOutputPayload>(
      `pty-output-agent-${EDITOR_PTY_AGENT}`,
      (event) => {
        writeQueueRef.current?.write(event.payload.data);
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);


  return (
    <div
      className={`flex flex-col bg-[#0a0a0c] border-t border-zinc-800 ${
        isMaximized ? "fixed inset-0 z-[200]" : "h-full"
      }`}
    >
      {/* Pane header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-950/60 shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon size={12} className="text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Terminal
          </span>
          {cwd && (
            <span className="text-[10px] font-mono text-zinc-600 truncate max-w-[200px]">
              {cwd.split(/[\\/]/).pop()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsMaximized((v) => !v)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-all"
              title="Hide Terminal"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* xterm.js container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-2 py-1"
        style={{ minHeight: 0 }}
      />
    </div>
  );
}
