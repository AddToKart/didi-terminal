/**
 * MergedTabView
 *
 * Renders two AppTerminalAreas side-by-side with a draggable splitter.
 * Left = current active tab's terminals.
 * Right = merged tab's terminals.
 * Right-click the merged panel header → context menu → Unmerge.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { AppTerminalArea } from "../layout/AppTerminalArea";
import type { AgentInstance, TerminalLayoutOrientation } from "../../types/workspace";
import { X } from "lucide-react";

interface MergedTabViewProps {
  leftAgents: AgentInstance[];
  leftLayout: TerminalLayoutOrientation;
  leftTabName: string;
  rightAgents: AgentInstance[];
  rightLayout: TerminalLayoutOrientation;
  rightTabName: string;
  currentProject: string | null;
  workspaceName?: string;
  workspaceId: string;
  isGlass?: boolean;
  onRemoveAgent: (id: string) => void;
  onDetachAgent: (id: string) => void;
  onReorderAgents: (oldIndex: number, newIndex: number) => void;
  onSplit: (agentId: string) => void;
  onUnmerge: () => void;
}

export function MergedTabView({
  leftAgents,
  leftLayout,
  leftTabName,
  rightAgents,
  rightLayout,
  rightTabName,
  currentProject,
  workspaceName,
  workspaceId,
  isGlass,
  onRemoveAgent,
  onDetachAgent,
  onReorderAgents,
  onSplit,
  onUnmerge,
}: MergedTabViewProps) {
  const [splitPct, setSplitPct] = useState(50);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // ── Drag-to-resize splitter ──────────────────────────────────────────────
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;

    const onMouseMove = (mv: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((mv.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(80, Math.max(20, pct)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // ── Right-click context menu ─────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => closeContextMenu();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenu, closeContextMenu]);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 min-w-0 flex flex-row select-none"
    >
      {/* ── Left pane ── */}
      <div
        className="flex flex-col min-h-0 min-w-0"
        style={{ width: `${splitPct}%` }}
      >
        <div className="h-6 flex items-center px-3 border-b border-r border-app-border bg-app-bg shrink-0">
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
            {leftTabName}
          </span>
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <AppTerminalArea
            agents={leftAgents}
            currentProject={currentProject}
            layoutOrientation={leftLayout}
            onRemoveAgent={onRemoveAgent}
            onDetachAgent={onDetachAgent}
            onReorderAgents={onReorderAgents}
            onSplit={onSplit}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            isGlass={isGlass}
          />
        </div>
      </div>

      {/* ── Draggable splitter ── */}
      <div
        className="w-[2px] shrink-0 bg-app-border hover:bg-indigo-500/60 transition-colors cursor-col-resize active:bg-indigo-500"
        onMouseDown={handleSplitterMouseDown}
      />

      {/* ── Right pane ── */}
      <div
        className="flex flex-col min-h-0 min-w-0 flex-1"
      >
        <div
          className="h-6 flex items-center px-3 border-b border-app-border bg-app-bg shrink-0 cursor-context-menu group"
          onContextMenu={handleContextMenu}
        >
          <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest flex-1">
            {rightTabName}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUnmerge(); }}
            title="Unmerge tab"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-red-400"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 min-h-0 min-w-0">
          <AppTerminalArea
            agents={rightAgents}
            currentProject={currentProject}
            layoutOrientation={rightLayout}
            onRemoveAgent={onRemoveAgent}
            onDetachAgent={onDetachAgent}
            onReorderAgents={onReorderAgents}
            onSplit={onSplit}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            isGlass={isGlass}
          />
        </div>
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="fixed z-[1000] bg-zinc-900 border border-zinc-700/60 rounded-lg shadow-2xl py-1 min-w-[160px] animate-in fade-in duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-widest border-b border-zinc-800 mb-1">
              {rightTabName}
            </div>
            <button
              onClick={() => { onUnmerge(); closeContextMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/8 hover:text-white transition-colors text-left"
            >
              <X size={12} />
              Unmerge Tab
            </button>
          </div>
        </>
      )}
    </div>
  );
}
