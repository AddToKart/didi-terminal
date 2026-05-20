import {
  ArrowLeft,
  Save,
  SaveAll,
  TerminalSquare,
  PanelLeft,
  PanelLeftClose,
  Search,
  Code2,
} from "lucide-react";
import { WindowControls } from "@/components/layout/WindowControls";
import type { AppMode } from "@/types/workspace";

interface EditorTopbarProps {
  prevMode: AppMode;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  isDirtyCount: number;
  onGoBack: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onQuickOpen: () => void;
}

export function EditorTopbar({
  prevMode,
  isSidebarOpen,
  isTerminalOpen,
  isDirtyCount,
  onGoBack,
  onToggleSidebar,
  onToggleTerminal,
  onSave,
  onSaveAll,
  onQuickOpen,
}: EditorTopbarProps) {
  const modeLabels: Record<string, string> = {
    terminal: "Terminal",
    orchestrator: "Orchestrator",
    zen: "Zen",
  };

  return (
    <div
      className="h-10 border-b border-zinc-800 bg-black flex items-center justify-between px-2 shrink-0 select-none z-10"
      data-tauri-drag-region
    >
      {/* Left: Back + mode name + sidebar toggle */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onGoBack}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 text-[11px] font-medium transition-all active:scale-95"
          title={`Back to ${modeLabels[prevMode] ?? "Terminal"} Mode`}
        >
          <ArrowLeft size={13} />
          <span>{modeLabels[prevMode] ?? "Back"}</span>
        </button>

        <div className="w-px h-4 bg-zinc-800" />

        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all active:scale-95"
          title="Toggle File Tree"
        >
          {isSidebarOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>

        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-zinc-800/60 bg-zinc-900/40">
          <Code2 size={12} className="text-sky-400" />
          <span className="text-[11px] font-bold text-zinc-300 tracking-tight">Editor</span>
        </div>
      </div>

      {/* Center: Quick-open search bar */}
      <button
        onClick={onQuickOpen}
        className="flex items-center gap-2 px-3 py-1 rounded-lg border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-800/60 hover:border-zinc-700 text-zinc-600 hover:text-zinc-400 transition-all text-[11px] min-w-[180px] max-w-xs"
        title="Quick Open (Ctrl+P)"
      >
        <Search size={12} />
        <span className="flex-1 text-left">Quick open file…</span>
        <kbd className="text-[9px] font-mono bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-zinc-600">
          Ctrl+P
        </kbd>
      </button>

      {/* Right: save actions + terminal toggle + window controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 text-[11px] font-medium transition-all active:scale-95"
          title="Save Current File (Ctrl+S)"
        >
          <Save size={13} />
          <span>Save</span>
        </button>

        {isDirtyCount > 1 && (
          <button
            onClick={onSaveAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-zinc-800 text-amber-500/80 hover:text-amber-400 text-[11px] font-medium transition-all active:scale-95"
            title="Save All Dirty Files"
          >
            <SaveAll size={13} />
            <span>Save All ({isDirtyCount})</span>
          </button>
        )}

        <div className="w-px h-4 bg-zinc-800" />

        <button
          onClick={onToggleTerminal}
          className={`p-1.5 rounded-md transition-all active:scale-95 ${
            isTerminalOpen
              ? "bg-zinc-800 text-zinc-200"
              : "hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
          }`}
          title="Toggle Terminal (Ctrl+`)"
        >
          <TerminalSquare size={14} />
        </button>

        <div className="w-px h-4 bg-zinc-800" />

        <WindowControls />
      </div>
    </div>
  );
}
