import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TerminalTab } from "../../types/workspace";

interface AppTerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabCreate: () => void;
  onTabRename: (id: string, newName: string) => void;
  onTabReorder: (oldIndex: number, newIndex: number) => void;
}

// ── Sortable Tab Item ─────────────────────────────────────────────────────────

interface SortableTabItemProps {
  tab: TerminalTab;
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
}

function SortableTabItem({
  tab,
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
}: SortableTabItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tab.id });

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
      className={`group flex items-center gap-2 px-4 h-full border-r border-app-border cursor-pointer select-none min-w-[120px] max-w-[200px] transition-all ${
        isDragOverlay
          ? "bg-app-panel text-white shadow-2xl border-y border-app-border ring-1 ring-brand-accent/50 z-[100]"
          : isActive
          ? "bg-app-panel text-white shadow-[inset_0_-2px_0_0_var(--tw-colors-brand-accent)]"
          : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
      }`}
    >
      {isEditing ? (
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
          {tab.name}
        </span>
      )}
      {!isEditing && (
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

// ── Main Tabs Component ───────────────────────────────────────────────────────

export function AppTerminalTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCreate,
  onTabRename,
  onTabReorder,
}: AppTerminalTabsProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex((t) => t.id === active.id);
    const newIndex = tabs.findIndex((t) => t.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onTabReorder(oldIndex, newIndex);
    }
  };

  return (
    <div className="h-8 flex items-center bg-app-bg border-b border-app-border shrink-0 overflow-x-auto custom-scrollbar">
      <div className="flex items-center h-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map((tab) => (
              <SortableTabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                editingTabId={editingTabId}
                editValue={editValue}
                inputRef={inputRef}
                onSelect={() => onTabSelect(tab.id)}
                onDoubleClick={() => handleDoubleClick(tab.id, tab.name)}
                onClose={() => onTabClose(tab.id)}
                onEditValueChange={setEditValue}
                onRenameSubmit={handleRenameSubmit}
                onKeyDown={handleKeyDown}
              />
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeDragId ? (() => {
              const tab = tabs.find(t => t.id === activeDragId);
              if (!tab) return null;
              return (
                <SortableTabItem
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  editingTabId={null}
                  editValue=""
                  inputRef={inputRef}
                  onSelect={() => {}}
                  onDoubleClick={() => {}}
                  onClose={() => {}}
                  onEditValueChange={() => {}}
                  onRenameSubmit={() => {}}
                  onKeyDown={() => {}}
                  isDragOverlay
                />
              );
            })() : null}
          </DragOverlay>
        </DndContext>
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
