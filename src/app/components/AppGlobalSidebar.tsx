import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Code2, FolderOpen, Settings, Bell, Palette, Plus, TerminalSquare, Workflow, MoreVertical, Pencil, Trash2, Globe, Copy, Check } from "lucide-react";
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
    ? `flex items-center justify-between px-3 py-2.5 rounded-lg shadow-2xl border border-brand-accent/50 bg-app-panel ring-1 ring-brand-accent/30 cursor-grabbing select-none`
    : `group relative flex items-center justify-between px-3 py-2.5 rounded-lg shadow-sm cursor-grab active:cursor-grabbing transition-all select-none ${
        isDragging
          ? "border border-transparent bg-transparent"
          : isActive
          ? "bg-brand-accent/5 border border-brand-accent/20"
          : "hover:bg-app-panel/50 border border-transparent"
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
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-brand-accent/20 text-brand-accent" : "bg-zinc-800/40 text-zinc-400"}`}>
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
              className="text-xs font-bold bg-app-panel border border-brand-accent/50 rounded px-1 outline-none text-brand-accent w-full"
            />
          ) : (
            <div className={`text-xs font-bold truncate transition-colors ${isActive ? "text-white" : "text-zinc-300 group-hover:text-white"}`}>
              {ws.name}
            </div>
          )}
          {ws.directory ? (
            <div className={`text-[9px] truncate font-bold ${isActive ? "text-brand-accent/80" : "text-zinc-400"}`} title={ws.directory}>{ws.directory.split("\\").pop()?.split("/").pop()}</div>
          ) : (
            <div className="text-[9px] text-zinc-500 italic font-medium">No directory</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-2 h-2 rounded-full ${ws.directory ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"}`} title={ws.directory ? "Configured" : "Unconfigured"} />
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e, ws.id); }}
          className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 rounded transition-colors opacity-0 group-hover:opacity-100"
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
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Localhost only for now
  }, []);

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
              className="fixed w-44 bg-app-panel border border-zinc-700/50 rounded-lg shadow-2xl py-1 z-[91]"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {(() => {
                const ws = workspaces.find((w) => w.id === menuOpenId);
                if (!ws) return null;
                return (
                  <>
                    <button onClick={() => { onOpenDirectory(ws.id); setMenuOpenId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800/40 hover:text-zinc-100 flex items-center gap-2 transition-colors">
                      <FolderOpen size={12} /> Open Directory
                    </button>
                    <button onClick={() => { setEditingWsId(ws.id); setEditWsName(ws.name); setMenuOpenId(null); }} className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-300 hover:bg-zinc-800/40 hover:text-zinc-100 flex items-center gap-2 transition-colors">
                      <Pencil size={12} /> Rename
                    </button>
                    <div className="my-1 border-t border-zinc-800/50" />
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

      <aside className="w-64 border-r border-app-border bg-app-panel flex flex-col shadow-xl z-20 shrink-0">
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
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-800/50 mt-2"
              >
                <div className="w-5 h-5 rounded-md bg-zinc-800/40 flex items-center justify-center shrink-0">
                  <Plus size={12} />
                </div>
                New Workspace
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-app-border/50 flex flex-col gap-3">
          <div className="flex items-center justify-between bg-app-panel/50 p-1.5 rounded-xl border border-zinc-700/30 shadow-inner">
            <button
              onClick={() => onSetAppMode("terminal")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === "terminal" ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10" : "text-zinc-400 hover:text-white"}`}
            >
              <TerminalSquare size={14} strokeWidth={2.5} /> Terminal
            </button>
            <button
              onClick={() => onSetAppMode("orchestrator")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${appMode === "orchestrator" ? "bg-purple-500/30 text-white shadow-sm ring-1 ring-purple-500/20" : "text-zinc-400 hover:text-white"}`}
            >
              <Workflow size={14} strokeWidth={2.5} /> Orchestrator
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowShareTooltip(!showShareTooltip)}
                className={`p-2 rounded-lg transition-all relative ${showShareTooltip ? "bg-brand-accent/20 text-brand-accent" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"}`}
                title="Remote Access Dashboard"
              >
                <Globe size={16} />
                {showShareTooltip && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 p-3 bg-[#18181b] border border-brand-accent/30 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-accent mb-2">Local Dashboard</p>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5 mb-2 group/url relative">
                      <p className="text-[10px] font-mono break-all text-zinc-300 pr-8">http://localhost:1420/dashboard</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = `http://localhost:1420/dashboard`;
                          navigator.clipboard.writeText(url);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-white transition-all border border-zinc-700/50 shadow-lg"
                      >
                        {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                      </button>
                    </div>
                    <p className="text-[9px] text-zinc-500 leading-relaxed">Open this URL on any device in your network to monitor your agents live.</p>
                  </div>
                )}
              </button>
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
