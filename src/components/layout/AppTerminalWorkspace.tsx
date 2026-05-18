import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { AppTerminalArea } from "@/components/layout/AppTerminalArea";
import type { TerminalTab } from "@/types/workspace";

interface AppTerminalWorkspaceProps {
  tabs: TerminalTab[];
  activeTabId: string;
  mergedTabPair: readonly [string, string] | null;
  currentProject: string | null;
  workspaceName?: string;
  workspaceId: string;
  isGlass?: boolean;
  onActivateTab: (tabId: string) => void;
  onAddAgentToTab: (tabId: string) => void;
  onRemoveAgentForTab: (tabId: string, agentId: string) => void;
  onDetachAgentForTab: (tabId: string, agentId: string) => void;
  onReorderAgentsForTab: (tabId: string, oldIndex: number, newIndex: number) => void;
  onSplitForTab: (tabId: string, agentId: string) => void;
  onOpenDirectory: () => void;
  onUnmerge: () => void;
}

const getPaneStyle = (
  tabId: string,
  activeTabId: string,
  mergedTabPair: readonly [string, string] | null,
  splitPct: number
): CSSProperties => {
  const hidden: CSSProperties = {
    inset: 0,
    pointerEvents: "none",
    visibility: "hidden",
    zIndex: 0,
  };

  if (!mergedTabPair) {
    return tabId === activeTabId
      ? { inset: 0, pointerEvents: "auto", visibility: "visible", zIndex: 1 }
      : hidden;
  }

  const [leftTabId, rightTabId] = mergedTabPair;
  if (tabId === leftTabId) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      width: `${splitPct}%`,
      pointerEvents: "auto",
      visibility: "visible",
      zIndex: 2,
    };
  }

  if (tabId === rightTabId) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: `calc(${splitPct}% + 2px)`,
      pointerEvents: "auto",
      visibility: "visible",
      zIndex: 2,
    };
  }

  return hidden;
};

export function AppTerminalWorkspace({
  tabs,
  activeTabId,
  mergedTabPair,
  currentProject,
  workspaceName,
  workspaceId,
  isGlass,
  onActivateTab,
  onAddAgentToTab,
  onRemoveAgentForTab,
  onDetachAgentForTab,
  onReorderAgentsForTab,
  onSplitForTab,
  onOpenDirectory,
  onUnmerge,
}: AppTerminalWorkspaceProps) {
  const [splitPct, setSplitPct] = useState(50);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabName: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const mergedTabIds = mergedTabPair ? new Set(mergedTabPair) : null;

  const handleSplitterMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    isDragging.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
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

  useEffect(() => {
    if (!contextMenu) return;
    const closeContextMenu = () => setContextMenu(null);
    window.addEventListener("click", closeContextMenu);
    return () => window.removeEventListener("click", closeContextMenu);
  }, [contextMenu]);

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 min-w-0 overflow-hidden">
      {tabs.map((tab) => {
        const isMergedPane = mergedTabIds?.has(tab.id) ?? false;
        const paneStyle = getPaneStyle(tab.id, activeTabId, mergedTabPair, splitPct);

        return (
          <div
            key={tab.id}
            className="absolute flex min-h-0 min-w-0 flex-col"
            style={paneStyle}
            onMouseDown={() => onActivateTab(tab.id)}
          >
            {isMergedPane && (
              <div
                className="group flex h-6 shrink-0 cursor-context-menu items-center border-b border-app-border bg-app-bg px-3"
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ x: event.clientX, y: event.clientY, tabName: tab.name });
                }}
              >
                <span className="flex-1 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {tab.name}
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddAgentToTab(tab.id);
                  }}
                  className="rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-brand-primary group-hover:opacity-100"
                  title={`Add terminal to ${tab.name}`}
                >
                  <Plus size={11} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUnmerge();
                  }}
                  title="Unmerge tab"
                  className="ml-1 rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-red-400 group-hover:opacity-100"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              </div>
            )}
            <AppTerminalArea
              agents={tab.agents}
              currentProject={currentProject}
              layoutOrientation={tab.layoutOrientation}
              onRemoveAgent={(id) => onRemoveAgentForTab(tab.id, id)}
              onDetachAgent={(id) => onDetachAgentForTab(tab.id, id)}
              onReorderAgents={(oldIndex, newIndex) => onReorderAgentsForTab(tab.id, oldIndex, newIndex)}
              onSplit={(id) => onSplitForTab(tab.id, id)}
              onOpenDirectory={onOpenDirectory}
              workspaceName={workspaceName}
              workspaceId={workspaceId}
              isGlass={isGlass}
            />
          </div>
        );
      })}

      {mergedTabPair && (
        <div
          className="absolute bottom-0 top-0 z-10 w-[2px] cursor-col-resize bg-app-border transition-colors hover:bg-indigo-500/60 active:bg-indigo-500"
          style={{ left: `${splitPct}%` }}
          onMouseDown={handleSplitterMouseDown}
        />
      )}

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-[1000] min-w-[160px] animate-in fade-in rounded-lg border border-zinc-700/60 bg-zinc-900 py-1 shadow-2xl duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="mb-1 border-b border-zinc-800 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {contextMenu.tabName}
            </div>
            <button
              type="button"
              onClick={() => {
                onUnmerge();
                setContextMenu(null);
              }}
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
