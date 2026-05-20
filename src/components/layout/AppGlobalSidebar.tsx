import { useState, useRef, useEffect } from "react";
import { Bell, Settings, Palette, Plus, TerminalSquare, Workflow, Focus, Code2, Share2, Globe, Copy, Check, Command } from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { AppMode, WorkspaceState } from "@/types/workspace";
import type { TaskRecord } from "@/services/app-core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { SortableWorkspaceItem } from "./app-global-sidebar-components";

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

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("didi:sidebar-width");
    return saved ? parseInt(saved, 10) : 320;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(240, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem("didi:sidebar-width", sidebarWidth.toString());
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

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
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className="border-r border-zinc-900 bg-[#000000] flex flex-col z-20 shrink-0 relative select-none"
      >
        <ScrollArea className="flex-1 px-3 mt-4">
          <div className="space-y-6 pb-6">
            <div>
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="flex items-center gap-1.5 pl-0.5">
                  <Command size={11} className="text-zinc-500" />
                  <span className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase font-mono">Workspace Lanes</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onCreateWorkspace}
                      className="size-5 rounded hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    >
                      <Plus size={13} strokeWidth={2} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-950 border-zinc-900 text-xs font-mono" side="right">New Workspace</TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-2">
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

        <div className="p-3 bg-[#030303] border-t border-zinc-900/80 relative z-10 space-y-3">
          <div className="bg-zinc-950/80 backdrop-blur-md p-1 rounded-lg flex gap-1 border border-zinc-900/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetAppMode("terminal")}
              className={cn(
                "flex-1 min-w-0 h-7 px-2 rounded-md text-[10px] font-mono font-semibold transition-all duration-150 relative",
                appMode === "terminal"
                  ? "bg-zinc-900 text-cyan-400 border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              )}
            >
              {appMode === "terminal" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-cyan-500 animate-in fade-in duration-200" />}
              <TerminalSquare size={12} className="mr-1 shrink-0" strokeWidth={2} /> <span className="truncate">Terminal</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetAppMode("orchestrator")}
              className={cn(
                "flex-1 min-w-0 h-7 px-2 rounded-md text-[10px] font-mono font-semibold transition-all duration-150 relative",
                appMode === "orchestrator"
                  ? "bg-zinc-900 text-cyan-400 border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              )}
            >
              {appMode === "orchestrator" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full bg-cyan-500 animate-in fade-in duration-200" />}
              <Workflow size={12} className="mr-1 shrink-0" strokeWidth={2} /> <span className="truncate">Orchestrator</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSetAppMode("zen")}
              className={cn(
                "w-7 h-7 shrink-0 rounded-md transition-all duration-150 relative",
                appMode === "zen"
                  ? "bg-zinc-900 text-cyan-400 border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              )}
              title="Zen Mode"
            >
              {appMode === "zen" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-0.5 rounded-full bg-cyan-500 animate-in fade-in duration-200" />}
              <Focus size={12} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSetAppMode("editor")}
              className={cn(
                "w-7 h-7 shrink-0 rounded-md transition-all duration-150 relative",
                appMode === "editor"
                  ? "bg-zinc-900 text-cyan-400 border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              )}
              title="Editor Mode"
            >
              {appMode === "editor" && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-0.5 rounded-full bg-cyan-500 animate-in fade-in duration-200" />}
              <Code2 size={12} strokeWidth={2} />
            </Button>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 data-[state=open]:bg-zinc-900/50 data-[state=open]:text-zinc-200 transition-all">
                        <Share2 size={13} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="bg-zinc-950 border-zinc-900 text-xs font-mono">Remote Dashboard</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" sideOffset={10} className="w-60 p-3 rounded-lg border-zinc-900 shadow-2xl bg-zinc-950/95 backdrop-blur-md">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Globe size={12} className="text-cyan-400" />
                    <p className="text-[11px] font-mono font-bold text-zinc-300">SERVER CONTROL BRIDGE</p>
                  </div>
                  <div className="bg-black p-2 rounded-md border border-zinc-900 flex items-center justify-between gap-2 group">
                    <p className="text-[9px] font-mono text-zinc-400 truncate pl-1">http://localhost:1420/dashboard</p>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-5 rounded bg-zinc-900 hover:bg-zinc-800 shrink-0 border border-zinc-800/60"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText("http://localhost:1420/dashboard");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-zinc-400 group-hover:text-zinc-200" />}
                    </Button>
                  </div>
                  <p className="text-[9px] font-mono text-zinc-500 mt-2 leading-normal px-1">Bridge active on port :1421. Access globally to monitor terminal lanes.</p>
                </DropdownMenuContent>
              </DropdownMenu>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-all">
                    <Palette size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-950 border-zinc-900 text-xs font-mono">Theme Configuration</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-all">
                    <Bell size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-950 border-zinc-900 text-xs font-mono">System Notifications</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="size-7 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 transition-all"
                >
                  <Settings size={13} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-950 border-zinc-900 text-xs font-mono">Control Settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className={cn(
            "absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-30 transition-colors",
            isResizing ? "bg-cyan-500" : "hover:bg-zinc-800"
          )}
        />
      </aside>
    </TooltipProvider>
  );
}
