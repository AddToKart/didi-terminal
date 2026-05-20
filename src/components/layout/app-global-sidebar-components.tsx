import { useState, useRef, useEffect, type RefObject } from "react";
import { FolderOpen, Folder, Layers, Terminal, MoreVertical, Pencil, Trash2, Shield, GitBranch, Plus, ChevronRight, Activity } from "lucide-react";
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
      const key = `${workspaceId || "default"}::${typeof agent === "string" ? agent : (agent as any).name}`;
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
      onPointerDown={(e) => e.stopPropagation()} // Prevent sortable dragging from nested sections
      className={cn(
        "px-2.5 py-1.5 flex items-center justify-between group cursor-pointer transition-all duration-150 rounded-md relative select-none",
        isActive
          ? "bg-zinc-900/60 text-cyan-400"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/20"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Terminal size={12} className={cn("shrink-0", isActive ? "text-cyan-400 animate-pulse" : "text-zinc-500 group-hover:text-zinc-400")} />
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
            className="text-[11px] font-mono bg-zinc-950 border border-zinc-900 rounded px-1.5 py-0.5 outline-none text-white w-full min-w-0 focus:ring-1 focus:ring-zinc-800"
          />
        ) : (
          <div className="flex flex-col min-w-0 flex-1">
            <span
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className={cn(
                "text-[11px] font-mono truncate transition-colors",
                isActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-300"
              )}
            >
              {section.name}
            </span>
            {(runningTask || isTerminalRunning) && !isEditing && (
              <div className="flex items-center gap-1 opacity-90 transition-opacity mt-0.5 animate-in fade-in duration-200">
                <Activity size={9} className="text-emerald-500 animate-pulse shrink-0" />
                <span className="text-[9px] text-emerald-500/80 truncate font-mono tracking-tight" title={runningTask ? runningTask.summary : "Terminal Running"}>
                  {runningTask ? runningTask.summary : "active"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-800 -mr-1 shrink-0",
                menuOpen && "opacity-100 bg-zinc-800"
              )}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={11} className="text-zinc-500 hover:text-zinc-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-lg border-zinc-900 bg-zinc-950 p-1">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="gap-2 cursor-pointer text-[11px] focus:bg-zinc-900 focus:text-white rounded py-1">
              <Pencil size={12} className="text-zinc-400" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenSecurity(workspaceId); }} className="gap-2 cursor-pointer text-[11px] focus:bg-zinc-900 focus:text-white rounded py-1">
              <Shield size={12} className="text-zinc-400" /> Security
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-900 my-1" />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(workspaceId, section.id); }} className="gap-2 cursor-pointer text-[11px] text-red-400 focus:bg-red-950 focus:text-red-300 rounded py-1">
              <Trash2 size={12} /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        const key = `${ws.id || "default"}::${typeof agent === "string" ? agent : (agent as any).name}`;
        return agentReadyStates?.[key] === false;
      })
    )
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragOverlay ? undefined : transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const getDirBasename = (dir: string | null) => {
    if (!dir) return "";
    const parts = dir.replace(/\\/g, "/").split("/");
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return parts[parts.length - 1] || "";
  };

  const dirBasename = getDirBasename(ws.directory);

  return (
    <Collapsible open={isOpen && !isDragging && !isDragOverlay} onOpenChange={setIsOpen} className="relative group/ws mb-2">
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
          "flex items-center justify-between py-2.5 px-3 cursor-pointer select-none transition-all duration-155 rounded-lg border border-transparent group",
          isDragOverlay
            ? "bg-zinc-900 border border-zinc-800 shadow-2xl scale-[1.02]"
            : isDragging
            ? "opacity-30 scale-[0.98] grayscale"
            : isActive
            ? "bg-zinc-900/30 text-zinc-100 border-zinc-900/40"
            : "hover:bg-zinc-900/15 text-zinc-400 hover:text-zinc-200"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Chevron (blocks DND dragging to ensure click actions work) */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 p-0 shrink-0 transition-transform duration-200"
              style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <ChevronRight size={13} />
            </Button>
          </CollapsibleTrigger>

          {/* Icon */}
          <div className="relative shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            {ws.directory ? (
              isOpen ? (
                <FolderOpen size={14} className={cn(isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-400")} />
              ) : (
                <Folder size={14} className={cn(isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-400")} />
              )
            ) : (
              <Layers size={14} className={cn(isActive ? "text-cyan-400" : "text-zinc-500 group-hover:text-zinc-400")} />
            )}
            {isAnySectionRunning && (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>

          {/* Title and metadata */}
          <div className="min-w-0 flex flex-col flex-1 leading-tight">
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
                className="text-[11px] font-mono bg-zinc-950 border border-zinc-900 rounded px-1.5 py-0.5 outline-none text-white w-full min-w-0 focus:ring-1 focus:ring-zinc-800"
              />
            ) : (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    "text-[11px] font-mono font-semibold truncate tracking-tight",
                    isActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-300"
                  )}>
                    {ws.name}
                  </span>
                  {isAnySectionRunning && (
                    <Activity size={10} className="text-emerald-500 animate-pulse shrink-0" />
                  )}
                </div>
                {ws.directory && (
                  <div className="flex items-center gap-1 mt-0.5 min-w-0">
                    <span className="text-[9px] font-mono text-zinc-500 truncate" title={ws.directory}>
                      {dirBasename}
                    </span>
                    {branch && (
                      <>
                        <span className="text-zinc-700 font-mono text-[8px]">•</span>
                        <span className="flex items-center gap-0.5 font-mono text-[9px] text-cyan-500/80 bg-cyan-950/20 px-1 py-0.2 rounded border border-cyan-900/30 truncate" title={`Branch: ${branch}`}>
                          <GitBranch size={8} className="text-cyan-500/70" />
                          {branch}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Directory status dot & menu */}
        <div className="flex items-center gap-1 shrink-0 pr-0.5 ml-1" onPointerDown={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "size-1.5 rounded-full transition-colors duration-200 shrink-0",
                  ws.directory ? "bg-emerald-500/80" : "bg-amber-500/80"
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-[10px] font-mono bg-zinc-950 border-zinc-900">
              {ws.directory ? `Connected: ${ws.directory}` : "No Directory"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-800 shrink-0",
                  menuOpen && "opacity-100 bg-zinc-800"
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical size={11} className="text-zinc-500 hover:text-zinc-300" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg border-zinc-900 bg-zinc-950 p-1">
              <DropdownMenuItem onClick={() => onOpenDirectory(ws.id)} className="gap-2 cursor-pointer text-[11px] focus:bg-zinc-900 focus:text-white rounded py-1">
                <FolderOpen size={12} className="text-zinc-400" /> Open Directory
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onRenameStart(ws.id, ws.name)}
                className="gap-2 cursor-pointer text-[11px] focus:bg-zinc-900 focus:text-white rounded py-1"
              >
                <Pencil size={12} className="text-zinc-400" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onOpenSecurity(ws.id)}
                className="gap-2 cursor-pointer text-[11px] focus:bg-zinc-900 focus:text-white rounded py-1"
              >
                <Shield size={12} className="text-zinc-400" /> Security
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-900 my-1" />
              <DropdownMenuItem
                onClick={() => onDelete(ws.id)}
                className="gap-2 cursor-pointer text-[11px] text-red-400 focus:bg-red-950 focus:text-red-300 rounded py-1"
              >
                <Trash2 size={12} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sections and Collapsible Tree Line */}
      {isOpen && !isDragging && !isDragOverlay && (
        <CollapsibleContent className="animate-in slide-in-from-top-1 fade-in duration-150 pb-1.5 ml-[24px] pl-3.5 border-l border-zinc-900 space-y-1.5 mt-1">
          {ws.sections &&
            ws.sections.map((section) => (
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
          <div className="pl-2 pr-4 pt-2 pb-1" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSectionCreate(ws.id);
              }}
              className="flex items-center gap-1.5 text-[9px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-mono tracking-wider py-1 px-1.5 hover:bg-zinc-900/30 rounded"
            >
              <Plus size={10} strokeWidth={2.5} /> Add section
            </button>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export { SectionItem, SortableWorkspaceItem };
export type { SectionItemProps, SortableWorkspaceItemProps };
