import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Terminal } from "@xterm/xterm";
import { createXtermWriteQueue } from "@/lib/xterm-write-queue";
import { useXTerm } from "./useXTerm";
import {
  stripTerminalControls,
  getTerminalWritePayload,
  isPromptReady,
  type PtyOutputPayload,
  type PtyScrollback,
} from "./terminal-helpers";
import { TerminalFindBar } from "./TerminalFindBar";
import { TerminalInstanceHeader } from "./TerminalInstanceHeader";
import { useTerminalLanes } from "./useTerminalLanes";
import { useTerminalFind } from "./useTerminalFind";
import { useContainerWidth } from "./useContainerWidth";
import { useTerminalEvents } from "./useTerminalEvents";

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
  onZoom?: () => void;
}

export function TerminalInstance({
  agentId,
  agentName,
  cwd,
  onRemove,
  onDetach,
  onSplit,
  dragAttributes,
  dragListeners,
  workspaceName,
  workspaceId,
  isZenMode,
  onFocus,
  onZoom,
}: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const [isReady, setIsReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const isReadyRef = useRef(isReady);
  const lastPtyResizeRef = useRef<{ ptyKey: string; cols: number; rows: number } | null>(null);
  const suppressTerminalInputRef = useRef(false);
  const terminalApiRef = useRef<Terminal | null>(null);

  const setReadyState = useCallback((nextReady: boolean) => {
    isReadyRef.current = nextReady;
    setIsReady(nextReady);
  }, []);

  const {
    lanes,
    activeLaneId,
    activeLane,
    editingLaneId,
    editLaneLabel,
    setEditLaneLabel,
    ptyKey,
    ptyEventKey,
    handleSelectShell,
    handleSelectLane,
    handleAddLane,
    handleCloseLane,
    handleRemovePane,
    handleStartRenameLane,
    handleCommitRenameLane,
    handleCancelRenameLane,
  } = useTerminalLanes({
    agentId,
    agentName,
    workspaceId,
    setReadyState,
    terminalApiRef,
    onRemove,
  });

  const { isPulsing, sentinelPaused } = useTerminalEvents({
    agentName,
    ptyKey,
    ptyEventKey,
    setReadyState,
  });

  useEffect(() => {
    emit("agent-state", { agent: ptyKey, isReady }).catch(console.error);
  }, [ptyKey, isReady]);

  const handlePopOut = async () => {
    const label = `agent-${ptyKey.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}`;
    const params = new URLSearchParams({ agent: agentName });
    if (cwd) params.set("cwd", cwd);
    const popoutWindow = new WebviewWindow(label, {
      url: `/?${params.toString()}`,
      title: `${agentName} - DidiTerminal`,
      width: 800,
      height: 600,
    });

    popoutWindow.once("tauri://created", function () {
      if (onDetach) onDetach();
    });
    popoutWindow.once("tauri://error", function (e) {
      console.error("Failed to create popout window:", e);
    });
  };

  const writeTerminalInput = useCallback(
    (data: string) => {
      if (!data) return;
      invoke("write_pty", { agent: ptyKey, data }).catch(console.error);
      emit("agent-input", { agent: ptyKey, data }).catch(console.error);
    },
    [ptyKey]
  );

  const pasteTerminalInput = useCallback(
    (text: string) => {
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
    },
    [writeTerminalInput]
  );

  const handleTerminalData = useCallback(
    (data: string) => {
      if (suppressTerminalInputRef.current) return;
      writeTerminalInput(data);
    },
    [writeTerminalInput]
  );

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      if (cols < 2 || rows < 2) return;
      const lastResize = lastPtyResizeRef.current;
      if (lastResize?.ptyKey === ptyKey && lastResize.cols === cols && lastResize.rows === rows)
        return;

      lastPtyResizeRef.current = { ptyKey, cols, rows };
      invoke("resize_pty", {
        agent: ptyKey,
        cols,
        rows,
      }).catch(console.error);
    },
    [ptyKey]
  );

  const handleTerminalKey = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.altKey &&
        (e.code === "KeyQ" ||
          e.code === "KeyV" ||
          e.code === "KeyH" ||
          e.code === "KeyG" ||
          e.code === "KeyW" ||
          e.code === "KeyF" ||
          e.code === "KeyN" ||
          e.code === "Enter" ||
          /^Digit[1-9]$/.test(e.code))
      ) {
        return false;
      }

      if (e.type === "keydown") {
        if (e.altKey && e.code === "KeyZ") {
          e.preventDefault();
          onZoom?.();
          return false;
        }

        if (e.ctrlKey && e.shiftKey && e.key === "f") {
          e.preventDefault();
          setShowTerminalFind((prev) => !prev);
          return false;
        }

        if (e.ctrlKey && e.key === "v") {
          readText()
            .then((text) => {
              pasteTerminalInput(text);
            })
            .catch(console.error);
          return false;
        }
      }

      return true;
    },
    [pasteTerminalInput, onZoom]
  );

  const {
    terminalFindQuery,
    showTerminalFind,
    setShowTerminalFind,
    terminalSearchRef,
    handleTerminalFindChange,
    handleTerminalFindKeyDown,
    handleCloseFind,
  } = useTerminalFind();

  const {
    terminal,
    search: terminalSearch,
    isReady: isTerminalReady,
  } = useXTerm(terminalRef, {
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
      unlistenFocus.then((f) => f());
    };
  }, [agentName, terminal]);

  useEffect(() => {
    if (!isTerminalReady || !terminal) return;

    let cancelled = false;
    const outputBuffer = { current: "" };
    const lastReadyEmitAt = { current: 0 };
    const writeQueue = createXtermWriteQueue(terminal);
    try {
      terminal.reset();
    } catch (error) {
      console.warn("Skipped reset for disposed terminal:", error);
      writeQueue.dispose();
      return;
    }
    setReadyState(false);

    const unlistenPty = listen<PtyOutputPayload>(`pty-output-agent-${ptyEventKey}`, (event) => {
      if (cancelled) return;

      writeQueue.write(getTerminalWritePayload(event.payload));

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

    invoke<PtyScrollback>("spawn_pty", {
      agent: ptyKey,
      cwd: cwd || null,
      workspace_name: workspaceName || null,
      shell: activeLane.shell || null,
    })
      .then((scrollback) => {
        if (cancelled || !terminal) return;

        if ((scrollback.bytes?.length ?? 0) > 0 || scrollback.data) {
          writeQueue.write(getTerminalWritePayload(scrollback), () => {
            if (!cancelled) terminal.scrollToBottom();
          });

          const text = stripTerminalControls(scrollback.data).replace(/\s+/g, " ");
          outputBuffer.current = `${outputBuffer.current}${text}`.slice(-4000);

          setReadyState(true);
        }

        if (terminal.cols && terminal.rows) {
          handleTerminalResize(terminal.cols, terminal.rows);
        }
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      writeQueue.dispose();
      suppressTerminalInputRef.current = false;
      unlistenPty.then((f) => f());
    };
  }, [
    isTerminalReady,
    terminal,
    ptyKey,
    ptyEventKey,
    cwd,
    workspaceName,
    setReadyState,
    handleTerminalResize,
    activeLane.shell,
  ]);

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
      ref={containerRef}
      className={`flex flex-col h-full w-full transition-colors duration-300 outline-none ${
        isZenMode
          ? "bg-black zen-terminal"
          : sentinelPaused
          ? "bg-transparent border border-red-400 shadow-sm z-10 relative"
          : isPulsing
          ? "bg-transparent border border-brand-accent animate-pulse-border shadow-sm z-10 relative"
          : isFocused
          ? "bg-transparent border border-brand-accent shadow-sm z-10 relative"
          : "bg-transparent border border-app-border z-0"
      }`}
      tabIndex={-1}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleContainerClick}
    >
      {!isZenMode && (
        <TerminalInstanceHeader
          agentName={agentName}
          agentId={agentId}
          ptyKey={ptyKey}
          isFocused={isFocused}
          isReady={isReady}
          sentinelPaused={sentinelPaused}
          isPulsing={isPulsing}
          containerWidth={containerWidth}
          lanes={lanes}
          activeLaneId={activeLaneId}
          activeLane={activeLane}
          editingLaneId={editingLaneId}
          editLaneLabel={editLaneLabel}
          dragAttributes={dragAttributes}
          dragListeners={dragListeners}
          onSelectShell={handleSelectShell}
          onSelectLane={handleSelectLane}
          onAddLane={handleAddLane}
          onCloseLane={handleCloseLane}
          onStartRenameLane={handleStartRenameLane}
          onEditLaneLabelChange={setEditLaneLabel}
          onCommitRenameLane={handleCommitRenameLane}
          onCancelRenameLane={handleCancelRenameLane}
          onPopOut={handlePopOut}
          onRemovePane={handleRemovePane}
          onSplit={onSplit}
        />
      )}

      <TerminalFindBar
        show={showTerminalFind}
        query={terminalFindQuery}
        onQueryChange={handleTerminalFindChange}
        onKeyDown={handleTerminalFindKeyDown}
        onFindNext={(q) => terminalSearch?.findNext(q)}
        onFindPrevious={(q) => terminalSearch?.findPrevious(q)}
        onClose={handleCloseFind}
      />

      {/* Terminal Content */}
      <div className={`flex-1 overflow-hidden relative group ${isPulsing ? "animate-flash-bg" : ""}`}>
        {!isTerminalReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent z-20">
            <div className="animate-pulse text-zinc-500 text-xs tracking-widest uppercase">
              Loading Engine...
            </div>
          </div>
        )}
        <div
          className={`absolute terminal-surface overflow-hidden ${isZenMode ? "inset-0" : "inset-1.5"}`}
          ref={terminalRef}
          onClick={handleContainerClick}
        ></div>
      </div>
    </div>
  );
}
