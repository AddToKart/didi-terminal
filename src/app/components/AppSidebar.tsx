import { Activity, ChevronDown, ChevronRight, Cpu, FolderOpen, Server, ShieldAlert, X } from "lucide-react";
import { SentinelPanel, type SentinelIncident } from "../../components/SentinelPanel";
import { SnapshotPanel, type GitSnapshotRecord } from "../../components/SnapshotPanel";
import { getPtyKey, type ActivityLog, type TaskRecord } from "../../services/app-core";

interface AppSidebarProps {
  sidecarStatus: string;
  currentProject: string | null;
  onOpenProject: () => void;
  onInitialize: () => void;
  sentinelEnabled: boolean;
  sentinelIncidents: SentinelIncident[];
  onToggleSentinel: () => void;
  hitlEnabled: boolean;
  onToggleHitl: () => void;
  agents: string[];
  agentQueueCounts: Record<string, number>;
  onRemoveAgent: (agent: string) => void;
  snapshots: GitSnapshotRecord[];
  snapshotBusy: boolean;
  onManualSnapshot: () => void;
  onRewindSnapshot: (snapshot: GitSnapshotRecord) => void;
  isTasksCollapsed: boolean;
  onToggleTasksCollapsed: () => void;
  tasks: TaskRecord[];
  isActivityCollapsed: boolean;
  onToggleActivityCollapsed: () => void;
  activity: ActivityLog[];
}

export function AppSidebar({
  sidecarStatus,
  currentProject,
  onOpenProject,
  onInitialize,
  sentinelEnabled,
  sentinelIncidents,
  onToggleSentinel,
  hitlEnabled,
  onToggleHitl,
  agents,
  agentQueueCounts,
  onRemoveAgent,
  snapshots,
  snapshotBusy,
  onManualSnapshot,
  onRewindSnapshot,
  isTasksCollapsed,
  onToggleTasksCollapsed,
  tasks,
  isActivityCollapsed,
  onToggleActivityCollapsed,
  activity,
}: AppSidebarProps) {
  return (
    <aside className="w-72 border-l border-app-border bg-app-panel flex flex-col shadow-md z-10 shrink-0">
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="shrink-0 p-4 border-b border-app-border space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
            <div className="flex items-center gap-2"><Server size={14} /> LLM API</div>
            <span className={sidecarStatus === "Connected" ? "text-emerald-400" : "text-amber-400"}>{sidecarStatus}</span>
          </div>

          <div>
            <div className="text-xs font-semibold text-zinc-400 flex items-center gap-2 mb-2">
              <FolderOpen size={14} /> Workspace
            </div>
            <button
              onClick={onOpenProject}
              className="w-full bg-app-panel hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 flex items-center justify-between transition-colors group rounded-lg"
            >
              <span className="truncate">{currentProject ? currentProject.split("\\").pop() : "Select Directory..."}</span>
              <FolderOpen size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </button>
          </div>

          {currentProject && (
            <button
              onClick={onInitialize}
              className="w-full bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-primary border border-brand-accent/30 hover:border-brand-accent/50 px-3 py-2 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 rounded-lg"
            >
              <ShieldAlert size={14} /> Initialize Didi Protocol
            </button>
          )}
        </div>

        <SentinelPanel
          enabled={sentinelEnabled}
          incidents={sentinelIncidents}
          onToggle={onToggleSentinel}
        />

        <div className="shrink-0 border-b border-app-border bg-app-panel flex flex-col">
          <div className="px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 text-zinc-400">
              <ShieldAlert size={14} className={hitlEnabled ? "text-amber-400" : "text-zinc-600"} />
              HITL Approvals
            </div>
            <button
              onClick={onToggleHitl}
              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${hitlEnabled ? "bg-amber-500" : "bg-zinc-700"}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${hitlEnabled ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>
          {hitlEnabled && (
            <div className="px-4 pb-3 text-[10px] text-zinc-500 leading-tight">
              Intercepts task completions flagged with <code className="text-amber-400/70 font-mono">&lt;!-- didi:requires_approval --&gt;</code> in MASTER_PLAN.md.
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border">
          <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-app-panel flex items-center justify-between border-b border-app-border">
            <span className="flex items-center gap-2"><Cpu size={14} /> Active Agents</span>
            <span>{agents.length}</span>
          </div>
          <div className="p-3 space-y-2">
            {agents.map(agent => (
              <div key={agent} className="group flex items-center justify-between px-3 py-2 bg-app-panel border border-zinc-800/50 hover:border-zinc-700 transition-colors rounded-lg">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                  <span className="text-xs font-medium text-zinc-300 truncate">{agent}</span>
                </div>
                {agentQueueCounts[getPtyKey(agent)] ? (
                  <span className="text-[10px] text-amber-400 border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 rounded-lg">
                    {agentQueueCounts[getPtyKey(agent)]} queued
                  </span>
                ) : null}
                <button
                  onClick={() => onRemoveAgent(agent)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                  title="Terminate Agent"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <SnapshotPanel
          currentProject={currentProject}
          snapshots={snapshots}
          isBusy={snapshotBusy}
          onSnapshot={onManualSnapshot}
          onRewind={onRewindSnapshot}
        />

        <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border bg-zinc-900/10">
          <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-app-panel flex items-center justify-between border-b border-app-border">
            <div className="flex items-center gap-2">
              <button onClick={onToggleTasksCollapsed} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                {isTasksCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <span>Task State</span>
            </div>
            <span className="text-zinc-500 font-normal">{tasks.filter(task => task.status !== "complete").length} active</span>
          </div>
          {!isTasksCollapsed && (
            <div className="p-3 space-y-2">
              {tasks.length === 0 ? (
                <div className="text-xs text-zinc-500">No tracked tasks</div>
              ) : (
                tasks.slice(0, 8).map(task => (
                  <div key={task.id} className="border border-zinc-800/50 bg-app-panel/50 px-3 py-2 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-brand-primary truncate">{task.target}</span>
                      <span className={`text-[10px] uppercase ${task.status === "complete" ? "text-emerald-400" : "text-amber-400"}`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate mt-1">{task.summary || "Delegated task"}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col min-h-0 bg-zinc-900/10 pb-4">
          <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-app-panel flex items-center gap-2 border-b border-app-border">
            <button onClick={onToggleActivityCollapsed} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              {isActivityCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            <Activity size={14} /> System Feed
          </div>
          {!isActivityCollapsed && (
            <div className="p-3 space-y-2">
              {activity.map(log => (
                <div key={log.id} className="text-xs leading-tight flex gap-2">
                  <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                  <span className={log.type === "handoff" ? "text-amber-400 font-medium" : "text-zinc-400"}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
