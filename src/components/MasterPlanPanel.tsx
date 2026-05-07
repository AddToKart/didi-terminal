import { FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CheckCircle2, Circle, ClipboardList, Loader2, Plus, RefreshCw, X } from "lucide-react";

type PlanStatus = "todo" | "in_progress" | "done";

interface PlanTask {
  id: string;
  line: number;
  text: string;
  section: string;
  status: PlanStatus;
}

interface Props {
  currentProject: string | null;
  onDispatchTask: (task: PlanTask) => void | Promise<void>;
  onClose: () => void;
}

const taskPattern = /^(\s*)-\s+\[([ xX])\]\s+(.+?)\s*$/;
const statusPattern = /<!--\s*didi:status=(todo|in_progress|done)\s*-->/i;

const getTaskStatus = (checked: string, text: string): PlanStatus => {
  if (checked.toLowerCase() === "x") return "done";
  const marker = text.match(statusPattern)?.[1];
  return marker === "in_progress" ? "in_progress" : "todo";
};

const parseMasterPlan = (markdown: string): PlanTask[] => {
  let section = "Tasks";
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      section = heading[1].replace(/#+$/, "").trim();
      return [];
    }

    const task = line.match(taskPattern);
    if (!task) return [];

    const rawText = task[3].replace(statusPattern, "").trim();
    return [{
      id: `${index}-${rawText}`,
      line: index,
      text: rawText,
      section,
      status: getTaskStatus(task[2], task[3]),
    }];
  });
};

const columns: Array<{ status: PlanStatus; label: string; icon: typeof Circle }> = [
  { status: "todo", label: "Todo", icon: Circle },
  { status: "in_progress", label: "Doing", icon: Loader2 },
  { status: "done", label: "Done", icon: CheckCircle2 },
];

export const MasterPlanPanel = ({ currentProject, onDispatchTask, onClose }: Props) => {
  const [markdown, setMarkdown] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const tasks = useMemo(() => parseMasterPlan(markdown), [markdown]);
  const doneCount = tasks.filter(task => task.status === "done").length;
  const progress = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const activeTasks = tasks.filter(task => task.status === "in_progress");

  const refreshPlan = async () => {
    if (!currentProject) {
      setMarkdown("");
      return;
    }

    const contents = await invoke<string>("read_master_plan", { cwd: currentProject });
    setMarkdown(contents);
  };

  useEffect(() => {
    refreshPlan().catch(console.error);
    if (!currentProject) return;

    const interval = setInterval(() => {
      refreshPlan().catch(console.error);
    }, 1000);

    return () => clearInterval(interval);
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
      if (status === "in_progress") {
        await onDispatchTask(task);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDragStart = (event: React.DragEvent, task: PlanTask) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    event.dataTransfer.dropEffect = "move";
    setDraggedTaskId(task.id);
  };

  const handleDrop = (event: React.DragEvent, status: PlanStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    const task = tasks.find(item => item.id === taskId);
    setDraggedTaskId(null);
    if (!task || task.status === status) return;
    setTaskStatus(task, status).catch(console.error);
  };

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
    <div className="absolute inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-7xl h-[86vh] border border-zinc-800 bg-app-bg shadow-xl flex flex-col rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg text-zinc-100 font-semibold tracking-tight flex items-center gap-2">
              <ClipboardList className="text-brand-accent" size={20} />
              Master Plan Board
            </h2>
            <div className="text-xs text-zinc-500 mt-1 truncate">
              {currentProject ? `${currentProject}\\MASTER_PLAN.md` : "Select a workspace to load the board"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!currentProject || isBusy}
              onClick={() => refreshPlan().catch(console.error)}
              className="p-2 text-zinc-500 hover:text-zinc-300 disabled:opacity-40 border border-zinc-800 hover:border-zinc-600 rounded-sm transition-colors"
              title="Refresh MASTER_PLAN.md"
            >
              <RefreshCw size={16} className={isBusy ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600 rounded-sm transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 min-h-0 flex-1 overflow-hidden">
        {!currentProject ? (
          <div className="h-full border border-dashed border-zinc-800 rounded-md flex items-center justify-center text-sm text-zinc-500">
            Select a workspace to load MASTER_PLAN.md
          </div>
        ) : tasks.length === 0 ? (
          <div className="h-full border border-dashed border-zinc-800 rounded-md flex items-center justify-center text-sm text-zinc-500">
            No markdown tasks found
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{doneCount} / {tasks.length} complete</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-zinc-950 border border-zinc-800 overflow-hidden rounded-sm">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <form onSubmit={handleAddTask} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={event => setNewTask(event.target.value)}
                  placeholder="Add task to MASTER_PLAN.md"
                  className="min-w-0 flex-1 bg-zinc-950 border border-zinc-800 focus:border-brand-accent text-zinc-300 px-3 py-2 text-xs outline-none rounded-sm"
                />
                <button
                  type="submit"
                  disabled={!newTask.trim() || isBusy}
                  className="p-2 text-zinc-500 border border-zinc-800 hover:text-brand-primary hover:border-brand-accent disabled:opacity-40 rounded-sm transition-colors"
                  title="Add task"
                >
                  <Plus size={16} />
                </button>
              </form>
            </div>

            {activeTasks.length > 0 && (
              <div className="border border-amber-500/20 bg-amber-500/10 px-4 py-3 rounded-sm">
                <div className="text-[10px] uppercase tracking-wide text-amber-400 font-bold">Currently Working On</div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {activeTasks.slice(0, 6).map(task => (
                    <div key={task.id} className="text-xs text-zinc-300 truncate border border-amber-500/10 bg-zinc-950/30 px-2 py-1.5 rounded-sm">{task.text}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 h-[calc(86vh-250px)]">
              {columns.map(column => {
                const Icon = column.icon;
                const columnTasks = tasks.filter(task => task.status === column.status);
                return (
                  <div key={column.status} className="min-w-0 min-h-0 flex flex-col border border-zinc-800/70 bg-zinc-950/50 rounded-sm">
                    <div className="px-4 py-3 border-b border-zinc-800 text-xs text-zinc-400 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1 min-w-0">
                        <Icon size={14} className={column.status === "in_progress" ? "text-amber-400" : column.status === "done" ? "text-emerald-400" : "text-zinc-500"} />
                        <span className="truncate">{column.label}</span>
                      </span>
                      <span>{columnTasks.length}</span>
                    </div>
                    <div
                      className={`p-3 space-y-2 overflow-y-auto min-h-0 flex-1 transition-colors ${draggedTaskId ? "bg-zinc-900/20" : ""}`}
                      onDragOver={event => event.preventDefault()}
                      onDragEnter={event => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={event => handleDrop(event, column.status)}
                    >
                      {columnTasks.map(task => (
                        <div
                          key={task.id}
                          draggable={task.status !== "done"}
                          onDragStart={event => handleDragStart(event, task)}
                          onDragEnd={() => setDraggedTaskId(null)}
                          className={`bg-zinc-900/70 border border-zinc-800 px-3 py-2.5 rounded-sm select-none ${
                            task.status === "done" ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                          }`}
                        >
                          <div className="text-[10px] text-zinc-500 truncate">{task.section}</div>
                          <div className="text-sm text-zinc-300 leading-snug mt-1 break-words">{task.text}</div>
                          <div className="mt-2 flex items-center gap-1.5">
                            {columns.filter(item => item.status !== task.status).map(item => (
                              <button
                                key={item.status}
                                type="button"
                                disabled={isBusy}
                                onClick={() => setTaskStatus(task, item.status)}
                                className="text-[10px] px-2 py-1 border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 rounded-sm transition-colors"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {columnTasks.length === 0 && (
                        <div className="text-[10px] text-zinc-600 px-1 py-2 text-center">Empty</div>
                      )}
                    </div>
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
