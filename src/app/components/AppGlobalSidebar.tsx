import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Code2, FolderOpen, Settings, Bell, Palette, Plus, TerminalSquare, Workflow, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkspaceState } from "../../App";

interface AppGlobalSidebarProps {
  appMode: "terminal" | "orchestrator";
  onSetAppMode: (mode: "terminal" | "orchestrator") => void;
  workspaces: WorkspaceState[];
  activeWorkspaceId: string;
  onWorkspaceSelect: (id: string) => void;
  onCreateWorkspace: () => void;
  onOpenDirectory: (id: string) => void;
  onOpenSettings: () => void;
  onWorkspaceReorder: (dragIndex: number, dropIndex: number) => void;
  onWorkspaceRename: (id: string, newName: string) => void;
  onWorkspaceDelete: (id: string) => void;
}

// ── Sortable workspace item ───────────────────────────────────────────────────

interface SortableWorkspaceItemProps {
  ws: WorkspaceState;
  isActive: boolean;
  editingWsId: string | null;
  editWsName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onEditWsName: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onOpenMenu: (e: React.MouseEvent, wsId: string) => void;
  isDragOverlay?: boolean;
}

function SortableWorkspaceItem({
  ws,
  isActive,
  editingWsId,
  editWsName,
  inputRef,
  onSelect,
  onEditWsName,
  onRenameSubmit,
  onRenameCancel,
  onOpenMenu,
  isDragOverlay = false,
}: SortableWorkspaceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ws.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    // Ghost: nearly invisible placeholder where the item was
    opacity: isDragging && !isDragOverlay ? 0.15 : 1,
  };

  const containerClass = isDragOverlay
    ? `flex items-center justify-between px-3 py-2.5 rounded-lg shadow-2xl border border-brand-accent/50 bg-zinc-900 ring-1 ring-brand-accent/30 cursor-grabbing select-none`
    : `group relative flex items-center justify-between px-3 py-2.5 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragging
          ? "border border-transparent bg-transparent"
          : isActive
          ? "bg-brand-accent/5 border border-brand-accent/20"
          : "hover:bg-zinc-900/50 border border-transparent"
      }`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={containerClass}
    >
      <div className="flex items-center gap-3 truncate flex-1 min-w-0">
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-brand-accent/20 text-brand-accent" : "bg-zinc-800 text-zinc-400"}`}>
          <FolderOpen size={12} />
        </div>
        <div className="min-w-0 flex flex-col flex-1">
          {editingWsId === ws.id ? (
            <input
              ref={inputRef}
              value={editWsName}
              onChange={(e) => onEditWsName(e.target.value)}
              onBlur={onRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit();
                if (e.key === "Escape") onRenameCancel();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-bold bg-zinc-950 border border-brand-accent/50 rounded px-1 outline-none text-brand-accent w-full"
            />
          ) : (
            <div className={`text-xs font-bold truncate transition-colors ${isActive ? "text-brand-accent" : "text-zinc-400 group-hover:text-zinc-300"}`}>
              {ws.name}
            </div>
          )}
          {ws.directory ? (
            <div className="text-[9px] text-zinc-500 truncate" title={ws.directory}>{ws.directory.split("\\").pop()?.split("/").pop()}</div>
          ) : (
            <div className="text-[9px] text-zinc-500 italic">No directory</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-2 h-2 rounded-full ${ws.directory ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"}`} title={ws.directory ? "Configured" : "Unconfigured"} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e, ws.id); }}
          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Workspace Options"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function AppGlobalSidebar({
  appMode,
  onSetAppMode,
  workspaces,
  activeWorkspaceId,
  onWorkspaceSelect,
  onCreateWorkspace,
  onOpenDirectory,
  onOpenSettings,
  onWorkspaceReorder,
  onWorkspaceRename,
  onWorkspaceDelete,
}: AppGlobalSidebarProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  useEffect(() => {
    if (editingWsId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingWsId]);

  const handleRenameSubmit = () => {
    if (editingWsId && editWsName.trim()) {
      onWorkspaceRename(editingWsId, editWsName.trim());
    }
    setEditingWsId(null);
  };

  const openMenu = useCallback((e: React.MouseEvent, wsId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ top: rect.top, left: rect.right + 8 });
    setMenuOpenId((prev) => (prev === wsId ? null : wsId));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = workspaces.findIndex((w) => w.id === active.id);
    const newIndex = workspaces.findIndex((w) => w.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onWorkspaceReorder(oldIndex, newIndex);
    }
  };

  return (
    <>
      {menuOpenId &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setMenuOpenId(null)} />
            <div
              className="fixed w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl py-1 z-[91]"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {(() => {
                const ws = workspaces.find((w) => w.id === menuOpenId);
                if (!ws) return null;
                return (
                  <>
                    <button onClick={() => { onOpenDirectory(ws.id); setMenuOpenId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 flex items-center gap-2 transition-colors">
                      <FolderOpen size={12} /> Open Directory
                    </button>
                    <button onClick={() => { setEditingWsId(ws.id); setEditWsName(ws.name); setMenuOpenId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 flex items-center gap-2 transition-colors">
                      <Pencil size={12} /> Rename
                    </button>
                    <div className="my-1 border-t border-zinc-800" />
                    <button onClick={() => { onWorkspaceDelete(ws.id); setMenuOpenId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors">
                      <Trash2 size={12} /> Delete
                    </button>
                  </>
                );
              })()}
            </div>
          </>,
          document.body
        )}

      <aside className="w-64 border-r border-app-border bg-[#0d0d0f] flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-4 border-b border-app-border/50">
          <div className="flex items-center gap-2.5 text-zinc-200 font-bold tracking-wide">
            <Code2 className="text-brand-accent" size={22} />
            <span>DidiTerminal</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <div>
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Workspaces</div>
            <div className="space-y-1">
      <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={workspaces.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                  {workspaces.map((ws) => (
                    <SortableWorkspaceItem
                      key={ws.id}
                      ws={ws}
                      isActive={ws.id === activeWorkspaceId}
                      editingWsId={editingWsId}
                      editWsName={editWsName}
                      inputRef={inputRef}
                      onSelect={() => onWorkspaceSelect(ws.id)}
                      onEditWsName={setEditWsName}
                      onRenameSubmit={handleRenameSubmit}
                      onRenameCancel={() => setEditingWsId(null)}
                      onOpenMenu={openMenu}
                      isDragOverlay={false}
                    />
                  ))}
                </SortableContext>

                <DragOverlay dropAnimation={null}>
                  {activeId ? (() => {
                    const ws = workspaces.find(w => w.id === activeId);
                    return ws ? (
                      <SortableWorkspaceItem
                        ws={ws}
                        isActive={ws.id === activeWorkspaceId}
                        editingWsId={null}
                        editWsName=""
                        inputRef={inputRef}
                        onSelect={() => {}}
                        onEditWsName={() => {}}
                        onRenameSubmit={() => {}}
                        onRenameCancel={() => {}}
                        onOpenMenu={() => {}}
                        isDragOverlay
                      />
                    ) : null;
                  })() : null}
                </DragOverlay>
              </DndContext>

              <button
                onClick={onCreateWorkspace}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-800 mt-2"
              >
                <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                  <Plus size={12} />
                </div>
                New Workspace
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-app-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between bg-zinc-950/50 p-1.5 rounded-xl border border-zinc-800/50">
            <button
              onClick={() => onSetAppMode("terminal")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === "terminal" ? "bg-zinc-800 text-zinc-200 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <TerminalSquare size={14} /> Terminal
            </button>
            <button
              onClick={() => onSetAppMode("orchestrator")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === "orchestrator" ? "bg-purple-500/20 text-purple-400 shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <Workflow size={14} /> Orchestrator
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
                <Palette size={16} />
              </button>
              <button className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
                <Bell size={16} />
              </button>
            </div>
            <button onClick={onOpenSettings} className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
