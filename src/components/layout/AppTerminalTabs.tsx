import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Plus, X, Columns2 } from "lucide-react";
import {
  useSortable,
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getMergedSecondaryTabIds, getMergedTabName } from "@/lib/merged-tabs";
import type { MergedTabPair, TerminalTab } from "@/types/workspace";

export const TERMINAL_DROP_ID = "terminal-merge-drop";

interface AppTerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabCreate: () => void;
  onTabRename: (id: string, newName: string) => void;
  mergedTabPairs: readonly MergedTabPair[];
  onUnmerge: (tabId: string) => void;
}

interface SortableTabItemProps {
  tab: TerminalTab;
  displayName: string;
  isActive: boolean;
  editingTabId: string | null;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onDoubleClick: () => void;
  onClose: () => void;
  onEditValueChange: (val: string) => void;
  onRenameSubmit: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  isDragOverlay?: boolean;
  isMerged?: boolean;
  canRename?: boolean;
  canClose?: boolean;
  onUnmerge?: () => void;
}

function SortableTabItem({
  tab,
  displayName,
  isActive,
  editingTabId,
  editValue,
  inputRef,
  onSelect,
  onDoubleClick,
  onClose,
  onEditValueChange,
  onRenameSubmit,
  onKeyDown,
  isDragOverlay = false,
  isMerged = false,
  canRename = true,
  canClose = true,
  onUnmerge,
}: SortableTabItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id, data: { type: "tab" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    opacity: isDragging && !isDragOverlay ? 0.3 : 1,
    zIndex: isDragOverlay ? 100 : undefined,
  };

  const isEditing = tab.id === editingTabId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isEditing) onSelect(); }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => {
        if (isMerged && onUnmerge) {
          e.preventDefault();
          onUnmerge();
        }
      }}
      className={`group flex items-center gap-1 px-3 h-full border-r border-app-border cursor-pointer select-none min-w-[120px] max-w-[200px] transition-all ${
        isDragOverlay
          ? "bg-app-panel text-white shadow-2xl border-y border-app-border ring-1 ring-brand-accent/50 z-[100]"
          : isActive
          ? "bg-app-panel text-white shadow-[inset_0_-2px_0_0_var(--tw-colors-brand-accent)]"
          : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {isMerged && !isDragOverlay && (
        <div className="text-indigo-400 shrink-0" title="Merged tab. Right-click to unmerge.">
          <Columns2 size={10} strokeWidth={2} />
        </div>
      )}

      {isEditing && canRename ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onRenameSubmit}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          className="bg-transparent border-none outline-none text-xs font-bold text-white flex-1 min-w-0"
        />
      ) : (
        <span className={`text-xs truncate flex-1 ${isActive ? "font-bold" : "font-medium"}`}>
          {displayName}
        </span>
      )}
      {!isEditing && canClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`p-1 rounded-md transition-colors ${
            isActive
              ? "text-brand-primary/80 hover:text-white hover:bg-white/10"
              : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
          }`}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

export function AppTerminalTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCreate,
  onTabRename,
  mergedTabPairs,
  onUnmerge,
}: AppTerminalTabsProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (id: string, name: string) => {
    setEditingTabId(id);
    setEditValue(name);
  };

  const handleRenameSubmit = () => {
    if (editingTabId && editValue.trim()) {
      onTabRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  const mergedSecondaryIds = getMergedSecondaryTabIds(mergedTabPairs);

  return (
    <div className="h-8 flex items-center bg-app-bg border-b border-app-border shrink-0 overflow-x-auto custom-scrollbar">
      <div className="flex items-center h-full">
        <SortableContext
          items={tabs.filter(tab => !mergedSecondaryIds.has(tab.id)).map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          {tabs.map((tab) => {
            if (mergedSecondaryIds.has(tab.id)) return null;

            const mergedPair = mergedTabPairs.find(([primaryId]) => primaryId === tab.id);
            const mergedSecondary = mergedPair ? tabs.find(item => item.id === mergedPair[1]) : null;
            const isMergedDisplay = !!mergedPair && !!mergedSecondary;
            const isActive = isMergedDisplay
              ? mergedPair.includes(activeTabId)
              : tab.id === activeTabId;
            const displayName = isMergedDisplay
              ? getMergedTabName(tab.name, mergedSecondary.name)
              : tab.name;

            return (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                displayName={displayName}
                isActive={isActive}
                editingTabId={editingTabId}
                editValue={editValue}
                inputRef={inputRef}
                onSelect={() => onTabSelect(tab.id)}
                onDoubleClick={() => {
                  if (!isMergedDisplay) handleDoubleClick(tab.id, tab.name);
                }}
                onClose={() => onTabClose(tab.id)}
                onEditValueChange={setEditValue}
                onRenameSubmit={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                isMerged={isMergedDisplay}
                canRename={!isMergedDisplay}
                canClose={!isMergedDisplay}
                onUnmerge={isMergedDisplay ? () => onUnmerge(tab.id) : undefined}
              />
            );
          })}
        </SortableContext>
      </div>
      <button
        onClick={onTabCreate}
        className="h-full px-3 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-r border-app-border shrink-0"
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}
