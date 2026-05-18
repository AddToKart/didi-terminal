import { useState, useCallback, useRef, useEffect } from "react";
import { AppTerminalArea } from "../layout/AppTerminalArea";
import type { AgentInstance, TerminalLayoutOrientation } from "../../types/workspace";
import { X } from "lucide-react";

interface MergedTabViewProps {
  leftAgents: AgentInstance[];
  leftLayout: TerminalLayoutOrientation;
  leftTabName: string;
  leftTabId: string;
  rightAgents: AgentInstance[];
  rightLayout: TerminalLayoutOrientation;
  rightTabName: string;
  rightTabId: string;
  currentProject: string | null;
  workspaceName?: string;
  workspaceId: string;
  isGlass?: boolean;
  onRemoveAgentForTab: (tabId: string, agentId: string) => void;
  onDetachAgentForTab: (tabId: string, agentId: string) => void;
  onReorderAgentsForTab: (tabId: string, oldIndex: number, newIndex: number) => void;
  onSplitForTab: (tabId: string, agentId: string) => void;
  onUnmerge: () => void;
}

export function MergedTabView({
  leftAgents,
  leftLayout,
  leftTabName,
  leftTabId,
  rightAgents,
  rightLayout,
  rightTabName,
  rightTabId,
  currentProject,
  workspaceName,
  workspaceId,
  isGlass,
  onRemoveAgentForTab,
  onDetachAgentForTab,
  onReorderAgentsForTab,
  onSplitForTab,
  onUnmerge,
}: MergedTabViewProps) {
  const [splitPct, setSplitPct] = useState(50);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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
      className="flex h-full w-full flex-row select-none"
    >
      {/* Left pane */}
      <div className="flex h-full flex-col" style={{ width: `${splitPct}%` }}>
        <div className="flex h-6 shrink-0 items-center border-b border-r border-app-border bg-app-bg px-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {leftTabName}
          </span>
        </div>
        <div className="flex-1 min-h-0">
          <AppTerminalArea
            agents={leftAgents}
            currentProject={currentProject}
            layoutOrientation={leftLayout}
            onRemoveAgent={(id) => onRemoveAgentForTab(leftTabId, id)}
            onDetachAgent={(id) => onDetachAgentForTab(leftTabId, id)}
            onReorderAgents={(oldIndex, newIndex) => onReorderAgentsForTab(leftTabId, oldIndex, newIndex)}
            onSplit={(id) => onSplitForTab(leftTabId, id)}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            isGlass={isGlass}
          />
        </div>
      </div>

      {/* Splitter */}
      <div
        className="w-[2px] shrink-0 cursor-col-resize bg-app-border transition-colors hover:bg-indigo-500/60 active:bg-indigo-500"
        onMouseDown={handleSplitterMouseDown}
      />

      {/* Right pane */}
      <div className="flex h-full flex-col flex-1">
        <div
          className="flex h-6 shrink-0 cursor-context-menu items-center border-b border-app-border bg-app-bg px-3 group"
          onContextMenu={handleContextMenu}
        >
          <span className="flex-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {rightTabName}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUnmerge(); }}
            title="Unmerge tab"
            className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 text-zinc-500 hover:text-red-400"
          >
            <X size={11} strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <AppTerminalArea
            agents={rightAgents}
            currentProject={currentProject}
            layoutOrientation={rightLayout}
            onRemoveAgent={(id) => onRemoveAgentForTab(rightTabId, id)}
            onDetachAgent={(id) => onDetachAgentForTab(rightTabId, id)}
            onReorderAgents={(oldIndex, newIndex) => onReorderAgentsForTab(rightTabId, oldIndex, newIndex)}
            onSplit={(id) => onSplitForTab(rightTabId, id)}
            workspaceName={workspaceName}
            workspaceId={workspaceId}
            isGlass={isGlass}
          />
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="fixed z-[1000] min-w-[160px] animate-in fade-in rounded-lg border border-zinc-700/60 bg-zinc-900 py-1 shadow-2xl duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="mb-1 border-b border-zinc-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {rightTabName}
            </div>
            <button
              onClick={() => { onUnmerge(); closeContextMenu(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-zinc-300 transition-colors hover:bg-white/8 hover:text-white"
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
