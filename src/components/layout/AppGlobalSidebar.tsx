import { useState, useRef, useEffect } from "react";
import { Bell, Settings, Palette, Plus, TerminalSquare, Workflow, Focus, Code2, Share2, Globe, Copy, Check } from "lucide-react";
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
      <aside className="w-80 border-r border-zinc-800/80 bg-[#0b0c0e] flex flex-col shadow-2xl z-20 shrink-0 relative overflow-hidden">
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
                      className="size-5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200"
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

        <div className="p-4 bg-[#08080a] border-t border-zinc-800/80 relative z-10 space-y-4">
          <div className="bg-zinc-950 p-1 rounded-xl flex gap-1 border border-zinc-800/80 shadow-inner">
            <Button
              variant={appMode === "terminal" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onSetAppMode("terminal")}
              className={cn(
                "flex-1 min-w-0 h-8 px-2 rounded-lg text-[11px] font-semibold transition-all",
                appMode === "terminal"
                  ? "bg-zinc-800 text-white border border-zinc-800/60 shadow-sm hover:bg-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
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
                  ? "bg-purple-500/20 text-purple-200 shadow-sm border border-purple-500/40 hover:bg-purple-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
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
                  ? "bg-emerald-500/20 text-emerald-200 shadow-sm border border-emerald-500/40 hover:bg-emerald-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              )}
              title="Zen Mode"
            >
              <Focus size={14} strokeWidth={2.5} />
            </Button>
            <Button
              variant={appMode === "editor" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => onSetAppMode("editor")}
              className={cn(
                "w-8 h-8 shrink-0 rounded-lg transition-all",
                appMode === "editor"
                  ? "bg-indigo-500/20 text-indigo-200 shadow-sm border border-indigo-500/40 hover:bg-indigo-500/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
              )}
              title="Editor Mode"
            >
              <Code2 size={14} strokeWidth={2.5} />
            </Button>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 data-[state=open]:bg-zinc-800/60 data-[state=open]:text-white">
                        <Share2 size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Remote Dashboard</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" sideOffset={12} className="w-64 p-3 rounded-2xl border-zinc-800 shadow-2xl bg-zinc-950">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe size={14} className="text-brand-accent" />
                    <p className="text-xs font-semibold text-zinc-200">Local Network Access</p>
                  </div>
                  <div className="bg-black/50 p-2 rounded-xl border border-zinc-900 flex items-center justify-between gap-2 group">
                    <p className="text-[10px] font-mono text-zinc-400 truncate pl-1">http://localhost:1420/dashboard</p>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-6 rounded-md shrink-0 bg-zinc-900 hover:bg-zinc-800"
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
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60">
                    <Palette size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Theme</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60">
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
                  className="size-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60"
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
