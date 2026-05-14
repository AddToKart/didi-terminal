import { useState, useRef, useEffect } from "react";
import { FolderOpen, Settings, Bell, Palette, Plus, TerminalSquare, Workflow, MoreVertical, Pencil, Trash2, Globe, Copy, Check, GitBranch, Share2, Focus, Shield, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
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
import type { AppMode, WorkspaceState, SectionState } from "../../types/workspace";
import type { TaskRecord } from "../../services/app-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AppGlobalSidebarProps {
  appMode: AppMode;
  onSetAppMode: (mode: AppMode) => void;
  workspaces: WorkspaceState[];
  activeWorkspaceId: string;
  activeSectionId: string;
  onWorkspaceSelect: (id: string) => void;
  onCreateWorkspace: () => void;
  onOpenDirectory: (id: string) => void;
  onOpenSettings: () => void;
  onWorkspaceReorder: (dragIndex: number, dropIndex: number) => void;
  onWorkspaceRename: (id: string, newName: string) => void;
  onWorkspaceDelete: (id: string) => void;
  onOpenSecurity: (id: string) => void;
  onSectionCreate: (workspaceId: string) => void;
  onSectionRename: (workspaceId: string, sectionId: string, newName: string) => void;
  onSectionDelete: (workspaceId: string, sectionId: string) => void;
  onSectionSelect: (workspaceId: string, sectionId: string) => void;
  tasks?: TaskRecord[];
  agentReadyStates?: Record<string, boolean>;
}

interface SectionItemProps {
  workspaceId: string;
  section: SectionState;
  isActive: boolean;
  tasks?: TaskRecord[];
  agentReadyStates?: Record<string, boolean>;
  onSelect: () => void;
  onRename: (workspaceId: string, sectionId: string, newName: string) => void;
  onDelete: (workspaceId: string, sectionId: string) => void;
  onOpenSecurity: (id: string) => void;
}

function SectionItem({ workspaceId, section, isActive, tasks, agentReadyStates, onSelect, onRename, onDelete, onOpenSecurity }: SectionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(section.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runningTask = tasks?.find(t => t.status === "in_progress");
  const isTerminalRunning = section.tabs.some(tab => 
    tab.agents.some(agent => {
      const key = `${workspaceId || "default"}::${agent}`;
      return agentReadyStates?.[key] === false;
    })
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    if (editName.trim()) onRename(workspaceId, section.id, editName.trim());
    setIsEditing(false);
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={cn(
        "pl-9 pr-2 py-2 flex flex-col gap-1 group cursor-pointer transition-all duration-300 relative border-l-2 ml-1 mr-2 my-0.5 rounded-r-lg",
        isActive
          ? "bg-zinc-800/60 border-brand-accent shadow-[inset_1px_0_0_0_rgba(255,255,255,0.05)]"
          : "border-transparent hover:bg-zinc-800/30 hover:border-zinc-700"
      )}
    >
      <div className="flex items-center justify-between">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-xs font-bold bg-zinc-950/80 border border-white/10 rounded-md px-1 py-0.5 outline-none text-white w-full focus:ring-1 focus:ring-brand-accent"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className={cn(
              "text-[11px] font-bold tracking-widest uppercase truncate transition-colors",
              isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"
            )}
          >
            {section.name}
          </span>
        )}

        {!isEditing && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700/50 -mr-1",
                  menuOpen && "opacity-100 bg-zinc-700/50"
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical size={12} className="text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-2xl border-white/10 bg-zinc-900/95 backdrop-blur-md">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="gap-2 cursor-pointer text-xs focus:bg-white/10">
                <Pencil size={14} className="text-zinc-400" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenSecurity(workspaceId); }} className="gap-2 cursor-pointer text-xs focus:bg-white/10">
                <Shield size={14} className="text-zinc-400" /> Security
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(workspaceId, section.id); }} className="gap-2 cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-300">
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {/* Preview Running Task or Terminal Activity */}
      {(runningTask || isTerminalRunning) && !isEditing && (
        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity mt-0.5">
          <Activity size={10} className="text-emerald-400 animate-pulse shrink-0" />
          <span className="text-[10px] text-emerald-500/80 truncate font-medium tracking-tight" title={runningTask ? runningTask.summary : "Terminal Running"}>
            {runningTask ? runningTask.summary : "Running..."}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sortable workspace item ───────────────────────────────────────────────────

interface SortableWorkspaceItemProps {
  ws: WorkspaceState;
  isActive: boolean;
  activeSectionId: string;
  editingWsId: string | null;
  editWsName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: () => void;
  onEditWsName: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onOpenDirectory: (id: string) => void;
  onRenameStart: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onOpenSecurity: (id: string) => void;
  onSectionCreate: (workspaceId: string) => void;
  onSectionRename: (workspaceId: string, sectionId: string, newName: string) => void;
  onSectionDelete: (workspaceId: string, sectionId: string) => void;
  onSectionSelect: (workspaceId: string, sectionId: string) => void;
  isDragOverlay?: boolean;
  tasks?: TaskRecord[];
  agentReadyStates?: Record<string, boolean>;
}

function SortableWorkspaceItem({
  ws,
  isActive,
  activeSectionId,
  editingWsId,
  editWsName,
  inputRef,
  onSelect,
  onEditWsName,
  onRenameSubmit,
  onRenameCancel,
  onOpenDirectory,
  onRenameStart,
  onDelete,
  onOpenSecurity,
  onSectionCreate,
  onSectionRename,
  onSectionDelete,
  onSectionSelect,
  isDragOverlay = false,
  tasks,
  agentReadyStates,
}: SortableWorkspaceItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ws.id });

  const [branch, setBranch] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    if (ws.directory) {
      invoke("get_git_branch", { cwd: ws.directory })
        .then((res) => setBranch(res as string))
        .catch(() => setBranch(null));
    } else {
      setBranch(null);
    }
  }, [ws.directory]);

  const isAnySectionRunning = ws.sections.some(section => 
    section.tabs.some(tab => 
      tab.agents.some(agent => {
        const key = `${ws.id || "default"}::${agent}`;
        return agentReadyStates?.[key] === false;
      })
    )
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <Collapsible open={isOpen && !isDragging && !isDragOverlay} onOpenChange={setIsOpen} className="mb-3 relative">
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => {
          onSelect();
          setIsOpen(true);
        }}
        className={cn(
          "group relative flex flex-col justify-between rounded-xl cursor-pointer select-none transition-all duration-300 ease-out border",
          isDragOverlay
            ? "bg-zinc-900 shadow-2xl border-brand-accent/50 backdrop-blur-xl scale-105" 
            : isDragging
            ? "opacity-40 scale-95 grayscale"
            : isActive
            ? "bg-zinc-900/80 border-white/10 shadow-lg"
            : "border-transparent hover:bg-zinc-800/40"
        )}
      >
        {/* Active Indicator Bar on the far left */}
        {isActive && !isDragging && !isDragOverlay && (
          <div className="absolute left-0 top-3 w-1 h-8 bg-brand-accent rounded-r-full shadow-[0_0_12px_rgba(var(--brand-accent-rgb),0.8)] z-10" />
        )}
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0 pl-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 rounded-md hover:bg-white/10 text-zinc-500 hover:text-zinc-300 p-0 shrink-0 transition-colors" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </Button>
            </CollapsibleTrigger>

            <div className="min-w-0 flex flex-col flex-1 justify-center">              {editingWsId === ws.id ? (
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
                  className="text-sm font-bold bg-zinc-950/80 border border-white/10 rounded-md px-1.5 py-0.5 outline-none text-white w-full focus:ring-1 focus:ring-brand-accent"
                />
              ) : (
                <div
                  className={cn(
                    "text-sm font-bold truncate transition-colors tracking-tight flex items-center gap-2",
                    isActive ? "text-zinc-100" : "text-zinc-300 group-hover:text-zinc-100"
                  )}
                >
                  {ws.name}
                  {isAnySectionRunning && (
                    <Activity size={12} className="text-emerald-400 animate-pulse shrink-0" />
                  )}
                </div>
              )}
              {ws.directory && !editingWsId && (
                <div className="flex items-center gap-1.5 text-[10px] truncate mt-0.5 opacity-60">
                  <span className="truncate">
                    {ws.directory.split("\\").pop()?.split("/").pop()}
                  </span>
                  {branch && (
                    <>
                      <span className="text-zinc-700 mx-0.5">•</span>
                      <span
                        className="flex items-center gap-1 font-mono tracking-tighter truncate rounded-md bg-white/5 px-1 text-zinc-400"
                        title={`Branch: ${branch}`}
                      >
                        <GitBranch size={9} />
                        {branch}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    ws.directory
                      ? "bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                      : "bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                {ws.directory ? "Configured" : "Unconfigured"}
              </TooltipContent>
            </Tooltip>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "size-5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-700/50",
                    menuOpen && "opacity-100 bg-zinc-700/50"
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={14} className="text-zinc-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl border-white/10 bg-zinc-900/95 backdrop-blur-md">
                <DropdownMenuItem onClick={() => onOpenDirectory(ws.id)} className="gap-2 cursor-pointer text-xs focus:bg-white/10">
                  <FolderOpen size={14} className="text-zinc-400" /> Open Directory
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onRenameStart(ws.id, ws.name)}
                  className="gap-2 cursor-pointer text-xs focus:bg-white/10"
                >
                  <Pencil size={14} className="text-zinc-400" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onOpenSecurity(ws.id)}
                  className="gap-2 cursor-pointer text-xs focus:bg-white/10"
                >
                  <Shield size={14} className="text-zinc-400" /> Security
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem
                  onClick={() => onDelete(ws.id)}
                  className="gap-2 cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-300"
                >
                  <Trash2 size={14} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Render Sections when expanded */}
        {(!isDragging && !isDragOverlay) && (
          <CollapsibleContent className="animate-in slide-in-from-top-2 fade-in duration-200 pb-2">
            {ws.sections && ws.sections.map((section) => (
              <SectionItem 
                key={section.id} 
                workspaceId={ws.id}
                section={section} 
                isActive={isActive && section.id === activeSectionId} 
                tasks={tasks}
                agentReadyStates={agentReadyStates}
                onSelect={() => onSectionSelect(ws.id, section.id)}
                onRename={onSectionRename}
                onDelete={onSectionDelete}
                onOpenSecurity={onOpenSecurity}
              />
            ))}
            {/* Add Section Button */}
            <div className="pl-10 pr-4 mt-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onSectionCreate(ws.id); }}
                className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-bold tracking-widest"
              >
                <Plus size={10} strokeWidth={3} /> Add section
              </button>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export function AppGlobalSidebar({
  appMode,
  onSetAppMode,
  workspaces,
  activeWorkspaceId,
  activeSectionId,
  onWorkspaceSelect,
  onCreateWorkspace,
  onOpenDirectory,
  onOpenSettings,
  onWorkspaceReorder,
  onWorkspaceRename,
  onWorkspaceDelete,
  onOpenSecurity,
  onSectionCreate,
  onSectionRename,
  onSectionDelete,
  onSectionSelect,
  tasks,
  agentReadyStates,
}: AppGlobalSidebarProps) {
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
    <TooltipProvider delayDuration={300}>
      <aside className="w-80 border-r border-white/5 bg-[#0b0c0e] flex flex-col shadow-2xl z-20 shrink-0 relative overflow-hidden">
        {/* Removed Logo and Text, maximized workspace space */}
        
        <ScrollArea className="flex-1 px-3 mt-4">
          <div className="space-y-6 pb-6">
            <div>
              <div className="flex items-center justify-between px-2 mb-3">
                <span className="text-[11px] font-bold text-zinc-500 tracking-widest uppercase">Workspaces</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCreateWorkspace}
                      className="size-5 rounded-md hover:bg-white/10 text-zinc-400 hover:text-zinc-200"
                    >
                      <Plus size={12} strokeWidth={3} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">New Workspace</TooltipContent>
                </Tooltip>
              </div>

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
                        activeSectionId={activeSectionId}
                        editingWsId={editingWsId}
                        editWsName={editWsName}
                        inputRef={inputRef}
                        onSelect={() => onWorkspaceSelect(ws.id)}
                        onEditWsName={setEditWsName}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={() => setEditingWsId(null)}
                        onOpenDirectory={onOpenDirectory}
                        onRenameStart={(id, name) => {
                          setEditingWsId(id);
                          setEditWsName(name);
                        }}
                        onDelete={onWorkspaceDelete}
                        onOpenSecurity={onOpenSecurity}
                        onSectionCreate={onSectionCreate}
                        onSectionRename={onSectionRename}
                        onSectionDelete={onSectionDelete}
                        onSectionSelect={onSectionSelect}
                        tasks={tasks}
                        agentReadyStates={agentReadyStates}
                      />
                    ))}
                  </SortableContext>

                  <DragOverlay dropAnimation={null}>
                    {activeId ? (() => {
                      const ws = workspaces.find((w) => w.id === activeId);
                      return ws ? (
                        <SortableWorkspaceItem
                          ws={ws}
                          isActive={ws.id === activeWorkspaceId}
                          activeSectionId={activeSectionId}
                          editingWsId={null}
                          editWsName=""
                          inputRef={inputRef}
                          onSelect={() => {}}
                          onEditWsName={() => {}}
                          onRenameSubmit={() => {}}
                          onRenameCancel={() => {}}
                          onOpenDirectory={() => {}}
                          onRenameStart={() => {}}
                          onDelete={() => {}}
                          onOpenSecurity={() => {}}
                          onSectionCreate={() => {}}
                          onSectionRename={() => {}}
                          onSectionDelete={() => {}}
                          onSectionSelect={() => {}}
                          isDragOverlay
                          agentReadyStates={agentReadyStates}
                        />
                      ) : null;
                    })() : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 bg-[#0b0c0e]/90 border-t border-white/5 backdrop-blur-md relative z-10 space-y-4">
          <div className="bg-zinc-900/50 p-1 rounded-xl flex gap-1 ring-1 ring-white/5 shadow-inner">
            <Button
              variant={appMode === "terminal" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSetAppMode("terminal")}
              className={cn(
                "flex-1 min-w-0 h-8 px-2 rounded-lg text-[11px] font-semibold transition-all",
                appMode === "terminal"
                  ? "bg-white/10 text-white shadow-sm hover:bg-white/15"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <TerminalSquare size={14} className="mr-1 shrink-0" strokeWidth={2.5} /> <span className="truncate">Terminal</span>
            </Button>
            <Button
              variant={appMode === "orchestrator" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSetAppMode("orchestrator")}
              className={cn(
                "flex-1 min-w-0 h-8 px-2 rounded-lg text-[11px] font-semibold transition-all",
                appMode === "orchestrator"
                  ? "bg-purple-500/20 text-purple-200 shadow-sm ring-1 ring-purple-500/30 hover:bg-purple-500/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <Workflow size={14} className="mr-1 shrink-0" strokeWidth={2.5} /> <span className="truncate">Orchestrator</span>
            </Button>
            <Button
              variant={appMode === "zen" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onSetAppMode("zen")}
              className={cn(
                "w-8 h-8 shrink-0 rounded-lg transition-all",
                appMode === "zen"
                  ? "bg-emerald-500/20 text-emerald-200 shadow-sm ring-1 ring-emerald-500/30 hover:bg-emerald-500/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
              title="Zen Mode"
            >
              <Focus size={14} strokeWidth={2.5} />
            </Button>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 data-[state=open]:bg-white/10 data-[state=open]:text-white">
                        <Share2 size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Remote Dashboard</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" sideOffset={12} className="w-64 p-3 rounded-2xl border-white/10 shadow-2xl bg-zinc-950/95 backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe size={14} className="text-brand-accent" />
                    <p className="text-xs font-semibold text-zinc-200">Local Network Access</p>
                  </div>
                  <div className="bg-black/50 p-2 rounded-xl border border-white/5 flex items-center justify-between gap-2 group">
                    <p className="text-[10px] font-mono text-zinc-400 truncate pl-1">http://localhost:1420/dashboard</p>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-6 rounded-md shrink-0 bg-white/5 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText("http://localhost:1420/dashboard");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} className="text-zinc-400 group-hover:text-white" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed px-1">Open this URL on any device in your network to monitor agents live.</p>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
                    <Palette size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Theme</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
                    <Bell size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                >
                  <Settings size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
