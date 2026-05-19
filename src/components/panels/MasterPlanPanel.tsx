import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, ClipboardList, Loader2, Plus, RefreshCw, X, Clock, ListOrdered } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { eventBus } from "../../services/event-bus";

type PlanStatus = "todo" | "in_queue" | "in_progress" | "waiting_completion" | "done";

interface PlanTask {
  id: string;
  line: number;
  text: string;
  section: string;
  status: PlanStatus;
  children: PlanChild[];
}

interface PlanChild {
  id: string;
  line: number;
  text: string;
  depth: number;
  status?: PlanStatus;
}

interface Props {
  currentProject: string | null;
  onDispatchTask: (task: PlanTask) => void | Promise<void>;
  activeTaskLine: number | null;
  queuedTaskLines: number[];
  onClose: () => void;
}

interface DragState {
  task: PlanTask;
  startX: number;
  startY: number;
  x: number;
  y: number;
}

const taskPattern = /^(\s*)-\s+\[([ xX])\]\s+(.+?)\s*$/;
const statusPattern = /<!--\s*didi:status=(todo|in_queue|in_progress|waiting_completion|done)\s*-->/i;

const getTaskStatus = (checked: string, text: string): PlanStatus => {
  if (checked.toLowerCase() === "x") return "done";
  const marker = text.match(statusPattern)?.[1];
  if (marker === "in_progress") return "in_progress";
  if (marker === "waiting_completion") return "waiting_completion";
  if (marker === "in_queue") return "in_queue";
  return "todo";
};

const notePattern = /^(\s*)-\s+(.+?)\s*$/;

const parseMasterPlan = (markdown: string): PlanTask[] => {
  let section = "";
  let inAgentQueue = false;
  const tasks: PlanTask[] = [];
  let currentTask: PlanTask | null = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].replace(/#+$/, "").trim();
      inAgentQueue = section === "Agent Queue";
      currentTask = null;
      return;
    }

    // Only parse tasks inside ### Agent Queue
    if (!inAgentQueue) return;

    const task = line.match(taskPattern);
    if (task) {
      const indent = task[1].length;
      const rawText = task[3].replace(statusPattern, "").trim();
      if (indent === 0) {
        currentTask = {
          id: `${index}-${rawText}`,
          line: index,
          text: rawText,
          section,
          status: getTaskStatus(task[2], task[3]),
          children: [],
        };
        tasks.push(currentTask);
        return;
      }

      currentTask?.children.push({
        id: `${index}-${rawText}`,
        line: index,
        text: rawText,
        depth: indent,
        status: getTaskStatus(task[2], task[3]),
      });
      return;
    }

    const note = line.match(notePattern);
    if (!note || note[1].length === 0) return;
    currentTask?.children.push({
      id: `${index}-${note[2]}`,
      line: index,
      text: note[2].trim(),
      depth: note[1].length,
    });
  });

  return tasks;
};

const columns: Array<{ status: PlanStatus; label: string; icon: typeof Circle }> = [
  { status: "todo", label: "Todo", icon: Circle },
  { status: "in_queue", label: "In Queue", icon: ListOrdered },
  { status: "in_progress", label: "In Progress", icon: Loader2 },
  { status: "waiting_completion", label: "Waiting", icon: Clock },
  { status: "done", label: "Done", icon: CheckCircle2 },
];

// Extracted column component to support per-column virtualization
const PlanColumn = ({ 
  column, 
  columnTasks, 
  isDropTarget, 
  activeTaskLine, 
  queuedTaskSet, 
  dragState, 
  handlePointerDown, 
  setSelectedTask, 
  setTaskStatus, 
  isBusy,
  getQueueLabel
}: {
  column: { status: PlanStatus; label: string; icon: typeof Circle },
  columnTasks: PlanTask[],
  isDropTarget: boolean,
  activeTaskLine: number | null,
  queuedTaskSet: Set<number>,
  dragState: DragState | null,
  handlePointerDown: (e: React.PointerEvent, task: PlanTask) => void,
  setSelectedTask: (task: PlanTask) => void,
  setTaskStatus: (task: PlanTask, status: PlanStatus) => void,
  isBusy: boolean,
  getQueueLabel: (task: PlanTask) => string | null
}) => {
  const Icon = column.icon;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: columnTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Approximate height of a task card
    overscan: 5,
  });

  return (
    <div
      className={`flex-1 flex flex-col border rounded-xl transition-all duration-300 min-w-[200px] ${
        isDropTarget
          ? "border-brand-accent/50 bg-brand-accent/5 shadow-inner"
          : "border-zinc-800/50 bg-zinc-900/30"
      }`}
    >
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between bg-app-panel/50">
        <div className="flex items-center gap-2">
          <Icon size={14} className={
              column.status === "in_progress" ? "text-amber-500" :
              column.status === "waiting_completion" ? "text-blue-500" :
              column.status === "in_queue" ? "text-purple-500" :
              column.status === "done" ? "text-emerald-500" :
              "text-zinc-500"
          } />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">{column.label}</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-zinc-500 bg-app-panel px-2 py-0.5 rounded-xl border border-zinc-800/50">
          {columnTasks.length}
        </span>
      </div>

      <div ref={parentRef} className="p-3 overflow-y-auto min-h-0 flex-1 custom-scrollbar">
        {columnTasks.length === 0 ? (
          <div className={`text-[10px] font-bold uppercase tracking-wider px-1 py-8 text-center rounded-xl transition-all border border-dashed ${
            isDropTarget
              ? "text-brand-accent border-brand-accent/40 bg-brand-accent/5"
              : "text-zinc-600 border-zinc-800/50"
          }`}>
            {isDropTarget ? "↓ Drop here" : "Empty"}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow: any) => {
              const task = columnTasks[virtualRow.index];
              const queueLabel = getQueueLabel(task);
              return (
                <div
                  key={task.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '12px', // space-y-3 equivalent
                  }}
                >
                  <div
                    onPointerDown={e => handlePointerDown(e, task)}
                    className={`h-full group bg-app-panel hover:bg-zinc-900/40 border px-3 py-3 rounded-xl shadow-sm hover:shadow-md transition-all select-none ${
                      dragState?.task.id === task.id
                        ? "opacity-30 cursor-grabbing"
                        : task.status === "done"
                        ? "cursor-default border-zinc-800/50"
                        : "cursor-grab hover:border-zinc-600 border-zinc-800/50"
                    } ${task.line === activeTaskLine ? "border-emerald-500/50" : queuedTaskSet.has(task.line) ? "border-amber-500/50" : ""}`}
                  >
                    <div className="pointer-events-none h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 truncate">{task.section}</div>
                          {queueLabel && (
                            <div className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-xl border shrink-0 uppercase ${
                              task.line === activeTaskLine
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            }`}>
                              {queueLabel}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-medium text-zinc-200 leading-snug break-words">{task.text}</div>
                      </div>
                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-zinc-800/80 pointer-events-auto">
                        <button
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={() => setSelectedTask(task)}
                          className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-brand-accent transition-colors flex items-center gap-1.5"
                        >
                          Details
                        </button>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {columns.filter(c => c.status !== task.status).map(c => {
                            const CIcon = c.icon;
                            return (
                              <button
                                key={c.status}
                                type="button"
                                disabled={isBusy}
                                onPointerDown={e => e.stopPropagation()}
                                onClick={() => setTaskStatus(task, c.status)}
                                className="p-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800/50 text-zinc-500 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors shadow-sm"
                                title={`Move to ${c.label}`}
                              >
                                <CIcon size={12} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const MasterPlanPanel = ({ currentProject, onDispatchTask, activeTaskLine, queuedTaskLines, onClose }: Props) => {
  const [markdown, setMarkdown] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedTask, setSelectedTask] = useState<PlanTask | null>(null);

  // Refs to avoid stale closures in global listeners
  const dragStateRef = useRef<DragState | null>(null);
  const columnRefs = useRef<Map<PlanStatus, HTMLElement | null>>(new Map());
  const setTaskStatusRef = useRef<((task: PlanTask, status: PlanStatus) => Promise<void>) | null>(null);

  const tasks = useMemo(() => parseMasterPlan(markdown), [markdown]);
  const doneCount = tasks.filter(t => t.status === "done").length;
  const progress = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const activeTasks = tasks.filter(t => t.status === "in_progress");
  const queuedTaskSet = useMemo(() => new Set(queuedTaskLines), [queuedTaskLines]);
  const queuedTasks = tasks.filter(t => queuedTaskSet.has(t.line));
  const activeQueueTask = tasks.find(t => t.line === activeTaskLine);
  const getQueueLabel = (task: PlanTask) => {
    if (task.line === activeTaskLine) return "Active";
    const queueIndex = queuedTaskLines.indexOf(task.line);
    return queueIndex >= 0 ? `Queued #${queueIndex + 1}` : null;
  };

  const refreshPlan = async () => {
    if (!currentProject) { setMarkdown(""); return; }
    const contents = await invoke<string>("read_master_plan", { cwd: currentProject });
    setMarkdown(contents);
  };

  useEffect(() => {
    refreshPlan().catch(console.error);
    if (!currentProject) return;

    const unsub = eventBus.subscribe("master-plan-changed", () => refreshPlan().catch(console.error));
    return () => unsub();
  }, [currentProject]);

  const setTaskStatus = async (task: PlanTask, status: PlanStatus) => {
    if (!currentProject || isBusy) return;
    setIsBusy(true);
    try {
      const updated = await invoke<string>("set_master_plan_task_status", {
        cwd: currentProject,
        line: task.line,
        status,
      });
      setMarkdown(updated);
      if (status === "in_progress") await onDispatchTask(task);
    } finally {
      setIsBusy(false);
    }
  };

  // Keep setTaskStatus in a ref so pointer-event listeners can call latest version
  setTaskStatusRef.current = setTaskStatus;

  // --- Pointer-based drag (bypasses broken WebView2 HTML5 DnD) ---
  const handlePointerDown = (e: React.PointerEvent, task: PlanTask) => {
    if (isBusy) return;
    if (task.status === "done") {
      setSelectedTask(task);
      return;
    }
    e.preventDefault();
    const state: DragState = { task, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY };
    dragStateRef.current = state;
    setDragState(state);
  };

  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: PointerEvent) => {
      const next = { ...dragStateRef.current!, x: e.clientX, y: e.clientY };
      dragStateRef.current = next;
      setDragState({ ...next });
    };

    const onUp = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      dragStateRef.current = null;
      setDragState(null);
      if (!drag) return;
      const moved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (moved < 5) {
        setSelectedTask(drag.task);
        return;
      }

      // Hit-test each column rect to find the drop target
      let targetStatus: PlanStatus | null = null;
      columnRefs.current.forEach((el, status) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom
        ) {
          targetStatus = status;
        }
      });

      if (targetStatus && targetStatus !== drag.task.status) {
        setTaskStatusRef.current?.(drag.task, targetStatus).catch(console.error);
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [!!dragState]); // only re-subscribe when drag starts/stops

  const handleAddTask = async (event: FormEvent) => {
    event.preventDefault();
    const text = newTask.trim();
    if (!currentProject || !text || isBusy) return;
    setIsBusy(true);
    try {
      const updated = await invoke<string>("append_master_plan_task", {
        cwd: currentProject,
        text,
        status: "todo",
      });
      setMarkdown(updated);
      setNewTask("");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-app-panel/90 backdrop-blur-md flex items-center justify-center p-6">

      {/* Floating ghost card rendered outside any overflow:hidden ancestor */}
      {dragState && createPortal(
        <div
          style={{
            position: "fixed",
            left: dragState.x + 14,
            top: dragState.y - 18,
            pointerEvents: "none",
            zIndex: 99999,
            width: 260,
            opacity: 0.95,
            transform: "rotate(2deg)",
          }}
          className="bg-app-panel border border-brand-accent shadow-2xl px-4 py-3 rounded-xl"
        >
          <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">{dragState.task.section}</div>
          <div className="text-sm font-medium text-zinc-200 leading-snug line-clamp-2">{dragState.task.text}</div>
        </div>,
        document.body
      )}

      {selectedTask && createPortal(
        <div className="fixed inset-0 z-[100000] bg-app-panel/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-2xl max-h-[85vh] bg-app-panel border border-zinc-800/50 shadow-2xl overflow-hidden flex flex-col rounded-xl">
            <div className="px-6 py-5 border-b border-zinc-800/50 bg-zinc-900/50 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1.5">{selectedTask.section}</div>
                <h3 className="text-lg text-zinc-100 font-semibold leading-snug">{selectedTask.text}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/40 rounded-xl transition-colors shrink-0"
                title="Close details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto min-h-0 space-y-6 bg-app-bg">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="border border-zinc-800/50 bg-app-panel rounded-xl p-3 shadow-sm">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Status</div>
                  <div className="text-zinc-200 capitalize font-medium mt-1.5">{selectedTask.status.replace("_", " ")}</div>
                </div>
                <div className="border border-zinc-800/50 bg-app-panel rounded-xl p-3 shadow-sm">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Line Number</div>
                  <div className="text-zinc-200 font-medium mt-1.5">{selectedTask.line + 1}</div>
                </div>
                <div className="border border-zinc-800/50 bg-app-panel rounded-xl p-3 shadow-sm">
                  <div className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Subtasks</div>
                  <div className="text-zinc-200 font-medium mt-1.5">{selectedTask.children.filter(child => child.status).length}</div>
                </div>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Subtasks & Notes</div>
                {selectedTask.children.length === 0 ? (
                  <div className="text-sm text-zinc-600 border border-dashed border-zinc-800/50 bg-app-panel/50 rounded-xl py-8 text-center font-medium">
                    No subtasks or notes under this task.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTask.children.map(child => (
                      <div
                        key={child.id}
                        className="border border-zinc-800/50 bg-app-panel rounded-xl px-3 py-2 shadow-sm"
                        style={{ marginLeft: Math.min(child.depth, 24) }}
                      >
                        <div className="flex items-start gap-2.5">
                          {child.status === "done" ? (
                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                          ) : child.status === "in_progress" ? (
                            <Loader2 size={14} className="text-amber-500 mt-0.5 shrink-0" />
                          ) : child.status === "waiting_completion" ? (
                            <Clock size={14} className="text-blue-500 mt-0.5 shrink-0" />
                          ) : child.status === "in_queue" ? (
                            <ListOrdered size={14} className="text-purple-500 mt-0.5 shrink-0" />
                          ) : child.status === "todo" ? (
                            <Circle size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-xl bg-zinc-600 mt-2 shrink-0" />
                          )}
                          <div className="text-sm text-zinc-300 leading-snug break-words font-medium">{child.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div
        className="w-full max-w-[98vw] xl:max-w-[1800px] h-[92vh] border border-zinc-800/50 bg-app-panel shadow-2xl flex flex-col rounded-xl overflow-hidden"
        style={{ cursor: dragState ? "grabbing" : "default", userSelect: dragState ? "none" : "auto" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg text-zinc-100 font-semibold tracking-tight flex items-center gap-2.5">
              <ClipboardList className="text-brand-accent" size={18} />
              Master Plan
            </h2>
            <div className="text-[10px] text-zinc-500 mt-1 truncate font-mono">
              {currentProject ? `${currentProject}\\MASTER_PLAN.md` : "Select a workspace to load the board"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!currentProject || isBusy}
              onClick={() => refreshPlan().catch(console.error)}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 disabled:opacity-40 rounded-xl transition-all"
              title="Refresh MASTER_PLAN.md"
            >
              <RefreshCw size={16} className={isBusy ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 rounded-xl transition-all"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 min-h-0 flex-1 overflow-hidden flex flex-col bg-app-bg">
          {!currentProject ? (
            <div className="h-full border border-dashed border-zinc-800/50 rounded-xl flex items-center justify-center text-sm text-zinc-500 font-medium">
              Select a workspace to load MASTER_PLAN.md
            </div>
          ) : tasks.length === 0 ? (
            <div className="h-full border border-dashed border-zinc-800/50 rounded-xl flex items-center justify-center text-sm text-zinc-500 font-medium">
              No markdown tasks found
            </div>
          ) : (
            <>
              {/* Progress bar + add task */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
                <div className="flex-1 max-w-md space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
                    <span>{doneCount} of {tasks.length} tasks complete</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-zinc-900/40 border border-zinc-800/50 overflow-hidden rounded-xl">
                    <div className="h-full bg-brand-accent transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <form onSubmit={handleAddTask} className="flex items-center gap-2 w-full md:w-80 relative group">
                  <input
                    type="text"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    placeholder="Add a new task..."
                    className="w-full bg-app-panel border border-zinc-800/50 focus:border-brand-accent text-zinc-200 px-4 py-2 text-sm outline-none rounded-xl transition-all placeholder:text-zinc-600 font-medium shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!newTask.trim() || isBusy}
                    className="absolute right-1.5 p-1 text-zinc-500 hover:text-brand-accent disabled:opacity-40 transition-colors"
                    title="Add task"
                  >
                    <Plus size={16} />
                  </button>
                </form>
              </div>

              {/* Active tasks banner */}
              {(activeQueueTask || queuedTasks.length > 0 || activeTasks.length > 0) && (
                <div className="border border-amber-500/30 bg-amber-500/5 px-5 py-3 rounded-xl shrink-0 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Pipeline Status</div>
                    {queuedTasks.length > 0 && <div className="text-[10px] text-amber-500/70 font-bold tracking-wider">{queuedTasks.length} waiting</div>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {activeQueueTask && (
                      <div className="text-xs text-zinc-200 truncate border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 rounded-xl shadow-sm font-medium">
                        <span className="text-emerald-400 font-bold mr-2 uppercase tracking-wide text-[10px]">Active</span>
                        {activeQueueTask.text}
                      </div>
                    )}
                    {queuedTasks.slice(0, 5).map((task, index) => (
                      <div key={task.id} className="text-xs text-zinc-300 truncate border border-amber-500/20 bg-app-panel px-3 py-2 rounded-xl font-medium">
                        <span className="text-amber-500 font-bold mr-2 uppercase tracking-wide text-[10px]">Q#{index + 1}</span>
                        {task.text}
                      </div>
                    ))}
                    {!activeQueueTask && queuedTasks.length === 0 && activeTasks.slice(0, 6).map(task => (
                      <div key={task.id} className="text-xs text-zinc-300 truncate border border-amber-500/20 bg-app-panel px-3 py-2 rounded-xl font-medium">
                        {task.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kanban columns - Flex evenly without scrollbars */}
              <div className="flex flex-1 gap-4 pb-2 min-h-0">
                {columns.map(column => {
                  const columnTasks = tasks.filter(t => t.status === column.status);
                  const isDropTarget = dragState !== null && dragState.task.status !== column.status;

                  return (
                    <div key={column.status} className="flex-1 flex flex-col min-w-[200px]" ref={el => { columnRefs.current.set(column.status, el); }}>
                      <PlanColumn
                        column={column}
                        columnTasks={columnTasks}
                        isDropTarget={isDropTarget}
                        activeTaskLine={activeTaskLine}
                        queuedTaskSet={queuedTaskSet}
                        dragState={dragState}
                        handlePointerDown={handlePointerDown}
                        setSelectedTask={setSelectedTask}
                        setTaskStatus={(t, s) => setTaskStatusRef.current?.(t, s)}
                        isBusy={isBusy}
                        getQueueLabel={getQueueLabel}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};