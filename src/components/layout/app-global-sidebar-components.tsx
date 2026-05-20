import { useState, useRef, useEffect, type RefObject } from "react";
import { FolderOpen, MoreVertical, Pencil, Trash2, Shield, GitBranch, Plus, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkspaceState, SectionState } from "@/types/workspace";
import type { TaskRecord } from "@/services/app-core";
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
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
          ? "bg-zinc-900/40 border-brand-accent shadow-[inset_1px_0_0_0_rgba(255,255,255,0.01)]"
          : "border-transparent hover:bg-zinc-900/20 hover:border-zinc-800 hover:pl-[38px]"
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
            className="text-xs font-bold bg-zinc-950/80 border border-zinc-800 rounded-md px-1 py-0.5 outline-none text-white w-full focus:ring-1 focus:ring-brand-accent"
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
            <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-2xl border-zinc-800 bg-zinc-950">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="gap-2 cursor-pointer text-xs focus:bg-zinc-900 focus:text-white">
                <Pencil size={14} className="text-zinc-400" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenSecurity(workspaceId); }} className="gap-2 cursor-pointer text-xs focus:bg-zinc-900 focus:text-white">
                <Shield size={14} className="text-zinc-400" /> Security
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(workspaceId, section.id); }} className="gap-2 cursor-pointer text-xs text-red-400 focus:bg-red-500/10 focus:text-red-300">
                <Trash2 size={14} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
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

interface SortableWorkspaceItemProps {
  ws: WorkspaceState;
  isActive: boolean;
  activeSectionId: string;
  editingWsId: string | null;
  editWsName: string;
  inputRef: RefObject<HTMLInputElement | null>;
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
        const key = `${ws.id || "default"}::${agent.name}`;
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
            ? "bg-zinc-900 shadow-2xl border-brand-accent/50 scale-105" 
            : isDragging
            ? "opacity-40 scale-95 grayscale"
            : isActive
            ? "bg-[#111216] border-zinc-800 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] shadow-zinc-950/80 ring-1 ring-white/5 hover:border-zinc-700/80"
            : "border-transparent hover:bg-zinc-900/60"
        )}
      >
        {isActive && !isDragging && !isDragOverlay && (
          <div className="absolute left-0 top-3.5 w-0.5 h-7 bg-brand-accent rounded-r-full shadow-[0_0_10px_#00f0ff] z-10" />
        )}
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0 pl-1">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6 rounded-md hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 p-0 shrink-0 transition-colors" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
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
                  className="text-sm font-bold bg-zinc-950/80 border border-zinc-800 rounded-md px-1.5 py-0.5 outline-none text-white w-full focus:ring-1 focus:ring-brand-accent"
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
                        className="flex items-center gap-1 font-mono tracking-tighter truncate rounded-md bg-zinc-900/60 px-1 text-zinc-400"
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
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    ws.directory
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
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
              <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-2xl border-zinc-800 bg-zinc-950">
                <DropdownMenuItem onClick={() => onOpenDirectory(ws.id)} className="gap-2 cursor-pointer text-xs focus:bg-zinc-900 focus:text-white">
                  <FolderOpen size={14} className="text-zinc-400" /> Open Directory
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onRenameStart(ws.id, ws.name)}
                  className="gap-2 cursor-pointer text-xs focus:bg-zinc-900 focus:text-white"
                >
                  <Pencil size={14} className="text-zinc-400" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onOpenSecurity(ws.id)}
                  className="gap-2 cursor-pointer text-xs focus:bg-zinc-900 focus:text-white"
                >
                  <Shield size={14} className="text-zinc-400" /> Security
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
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

export { SectionItem, SortableWorkspaceItem };
export type { SectionItemProps, SortableWorkspaceItemProps };
