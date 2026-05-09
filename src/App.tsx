import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, lazy } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { TerminalInstance } from "./components/TerminalInstance";
import { type SentinelIncident } from "./components/SentinelPanel";
import { type GitSnapshotRecord } from "./components/SnapshotPanel";
import { type BrainstormSession } from "./components/BrainstormModal";
import {
  findMatchingAgent,
  getPtyKey,
  getUniqueAgents,
  type ActiveMasterPlanTask,
  type ActivityLog,
  type HitlApprovalRequest,
  type MasterPlanTaskDispatch,
  type SentinelAgentState,
  type TaskRecord,
} from "./services/app-core";
import { registerSentinelMonitoring } from "./services/sentinel-service";
import { registerHandoffListeners } from "./services/handoff-service";
import { createHandoffQueueService } from "./services/handoff-queue-service";
import { createMasterPlanWorkflow } from "./app/workflows/master-plan-workflow";
import { createBrainstormWorkflow } from "./app/workflows/brainstorm-workflow";
import { AppOverlays } from "./app/components/AppOverlays";
import { AppSidebar } from "./app/components/AppSidebar";
import { AppGlobalSidebar } from "./app/components/AppGlobalSidebar";
import { AppTopbar } from "./app/components/AppTopbar";
import { AppTerminalArea } from "./app/components/AppTerminalArea";

const NetworkGraph = lazy(() => import("./components/NetworkGraph").then(module => ({ default: module.NetworkGraph })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(module => ({ default: module.SettingsModal })));

function App() {
  const params = new URLSearchParams(window.location.search);
  const standaloneAgent = params.get("agent");
  const standaloneCwd = params.get("cwd") || localStorage.getItem("didi_project");

  if (standaloneAgent) {
    return (
      <div className="h-screen w-screen bg-app-bg">
        <TerminalInstance agentName={standaloneAgent} cwd={standaloneCwd} />
      </div>
    );
  }

  const [appMode, setAppMode] = useState<"terminal" | "orchestrator">(() => {
    return (localStorage.getItem("didi_app_mode") as "terminal" | "orchestrator") || "orchestrator";
  });
  const [agents, setAgents] = useState<string[]>(() => {
    const saved = localStorage.getItem("didi_agents");
    return saved ? getUniqueAgents(JSON.parse(saved)) : ["Main Terminal"];
  });
  const [newAgentName, setNewAgentName] = useState("");
  const [currentProject, setCurrentProject] = useState<string | null>(() => localStorage.getItem("didi_project"));
  const [layoutOrientation, setLayoutOrientation] = useState<"horizontal" | "vertical" | "grid">(() => {
    return (localStorage.getItem("didi_layout") as "horizontal" | "vertical" | "grid") || "horizontal";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem("didi_sidebar") !== "false");
  const [showNetworkGraph, setShowNetworkGraph] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showMasterPlan, setShowMasterPlan] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState("Checking...");
  const [activity, setActivity] = useState<ActivityLog[]>([{ id: 0, time: new Date().toLocaleTimeString(), message: "System initialized", type: "system" }]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [agentQueueCounts, setAgentQueueCounts] = useState<Record<string, number>>({});
  const [masterPlanQueueState, setMasterPlanQueueState] = useState<{ activeLine: number | null; queuedLines: number[] }>({
    activeLine: null,
    queuedLines: [],
  });
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [sentinelEnabled, setSentinelEnabled] = useState(() => localStorage.getItem("didi_sentinel") !== "false");
  const [hitlEnabled, setHitlEnabled] = useState(() => localStorage.getItem("didi_hitl") !== "false");
  const [approvalRequest, setApprovalRequest] = useState<HitlApprovalRequest | null>(null);
  const [sentinelIncidents, setSentinelIncidents] = useState<SentinelIncident[]>([]);
  const [snapshots, setSnapshots] = useState<GitSnapshotRecord[]>([]);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [brainstormSessions, setBrainstormSessions] = useState<BrainstormSession[]>([]);

  const pendingHandoffs = useRef<Map<string, string[]>>(new Map());
  const readyAgents = useRef<Set<string>>(new Set());
  const agentsRef = useRef(agents);
  const currentProjectRef = useRef(currentProject);
  const logIdCounter = useRef(1);
  const sentinelEnabledRef = useRef(sentinelEnabled);
  const hitlEnabledRef = useRef(hitlEnabled);
  const sentinelStates = useRef<Map<string, SentinelAgentState>>(new Map());
  const brainstormSessionsRef = useRef<BrainstormSession[]>([]);
  const activeMasterPlanTask = useRef<ActiveMasterPlanTask | null>(null);
  const queuedMasterPlanTasks = useRef<MasterPlanTaskDispatch[]>([]);
  const activeAgentPlanTasks = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    localStorage.setItem("didi_app_mode", appMode);
  }, [appMode]);

  useEffect(() => {
    hitlEnabledRef.current = hitlEnabled;
    localStorage.setItem("didi_hitl", String(hitlEnabled));
  }, [hitlEnabled]);

  const addLog = (message: string, type: "system" | "handoff" = "system") => {
    setActivity(prev => {
      const newLog = { id: logIdCounter.current++, time: new Date().toLocaleTimeString(), message, type };
      return [newLog, ...prev].slice(0, 50);
    });
  };

  const refreshSnapshots = useCallback(async (project = currentProjectRef.current) => {
    if (!project) {
      setSnapshots([]);
      return;
    }

    try {
      const records = await invoke<GitSnapshotRecord[]>("list_git_snapshots", { cwd: project });
      setSnapshots(records);
    } catch (err) {
      console.warn("Failed to list git snapshots", err);
      setSnapshots([]);
    }
  }, []);

  const {
    syncMasterPlanQueueState,
    dispatchNextMasterPlanTask,
    syncPlanTaskStatusByText,
    trackAgentPlanTask,
    popAgentPlanTask,
    handleDispatchMasterPlanTask,
    resetMasterPlanWorkflow,
  } = createMasterPlanWorkflow({
    currentProjectRef,
    agentsRef,
    activeMasterPlanTask,
    queuedMasterPlanTasks,
    activeAgentPlanTasks,
    setMasterPlanQueueState,
    addLog,
  });

  const {
    recordBrainstormResponse,
    handleStartBrainstorm,
  } = createBrainstormWorkflow({
    currentProjectRef,
    brainstormSessionsRef,
    setBrainstormSessions,
    addLog,
  });

  useEffect(() => {
    const uniqueAgents = getUniqueAgents(agents);
    if (uniqueAgents.length !== agents.length) {
      setAgents(uniqueAgents);
      return;
    }

    agentsRef.current = uniqueAgents;
    localStorage.setItem("didi_agents", JSON.stringify(uniqueAgents));
  }, [agents]);

  useEffect(() => {
    sentinelEnabledRef.current = sentinelEnabled;
    localStorage.setItem("didi_sentinel", String(sentinelEnabled));
  }, [sentinelEnabled]);

  useEffect(() => {
    brainstormSessionsRef.current = brainstormSessions;
  }, [brainstormSessions]);

  useEffect(() => {
    localStorage.setItem("didi_layout", layoutOrientation);
  }, [layoutOrientation]);

  useEffect(() => {
    localStorage.setItem("didi_sidebar", String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem("didi_project", currentProject);
    } else {
      localStorage.removeItem("didi_project");
    }
    currentProjectRef.current = currentProject;
    resetMasterPlanWorkflow();
    refreshSnapshots(currentProject);
  }, [currentProject, refreshSnapshots]);

  useEffect(() => {
    invoke<any>("get_config").then(config => {
      document.documentElement.style.setProperty("--tw-colors-brand-accent", config.theme_cyan);
      document.documentElement.style.setProperty("--tw-colors-brand-warn", config.theme_amber);
    }).catch(console.error);

    const interval = setInterval(() => {
      invoke<string>("get_sidecar_status").then(setSidecarStatus).catch(() => setSidecarStatus("Error"));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => registerSentinelMonitoring({
    sentinelEnabledRef,
    sentinelStates,
    setSentinelIncidents,
    addLog,
  }), []);

  const { writeHandoff, queueHandoff, flushQueuedHandoff } = createHandoffQueueService({
    pendingHandoffs,
    readyAgents,
    setAgentQueueCounts,
  });

  useEffect(() => registerHandoffListeners({
    currentProjectRef,
    agentsRef,
    pendingHandoffs,
    readyAgents,
    hitlEnabledRef,
    activeMasterPlanTask,
    setTasks,
    setSnapshots,
    setApprovalRequest,
    addLog,
    trackAgentPlanTask,
    popAgentPlanTask,
    syncPlanTaskStatusByText,
    syncMasterPlanQueueState,
    dispatchNextMasterPlanTask,
    recordBrainstormResponse,
    writeHandoff,
    queueHandoff,
    flushQueuedHandoff,
  }), []);

  const spawnAgent = (e: FormEvent) => {
    e.preventDefault();
    const name = newAgentName.trim();
    if (name && !findMatchingAgent(agents, name)) {
      setAgents([...agents, name]);
      setNewAgentName("");
      addLog(`Spawned agent: ${name}`, "system");
    }
  };

  const removeAgent = (agentToRemove: string) => {
    const agentKey = getPtyKey(agentToRemove);
    invoke("close_pty", { agent: agentKey }).catch(console.error);
    pendingHandoffs.current.delete(agentKey);
    readyAgents.current.delete(agentKey);
    setAgentQueueCounts(prev => {
      const next = { ...prev };
      delete next[agentKey];
      return next;
    });
    setAgents(agents.filter(a => a !== agentToRemove));
    addLog(`Terminated agent: ${agentToRemove}`, "system");
  };

  const detachAgent = (agentToDetach: string) => {
    setAgents(agents.filter(a => a !== agentToDetach));
    addLog(`Detached agent: ${agentToDetach}`, "system");
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setCurrentProject(selected as string);
      addLog(`Opened workspace: ${selected}`, "system");
    }
  };

  const handleInitialize = async () => {
    if (!currentProject) return;

    try {
      await invoke("initialize_project", { cwd: currentProject });
      addLog("Project initialized for Didi orchestration.", "system");
    } catch (err) {
      addLog(`Init failed: ${err}`, "system");
    }
  };

  const handleManualSnapshot = async () => {
    if (!currentProject) return;

    setSnapshotBusy(true);
    try {
      const snapshot = await invoke<GitSnapshotRecord>("create_git_snapshot", {
        cwd: currentProject,
        taskId: `manual-${Date.now()}`,
        label: "Manual checkpoint",
        agent: "Manual",
      });
      setSnapshots(prev => [snapshot, ...prev.filter(item => item.id !== snapshot.id)].slice(0, 40));
      addLog(`Manual snapshot ${snapshot.commit.slice(0, 8)} created`, "system");
    } catch (err) {
      addLog(`Manual snapshot failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleRewindSnapshot = async (snapshot: GitSnapshotRecord) => {
    if (!currentProject) return;
    const confirmed = window.confirm(`Rewind workspace files to snapshot ${snapshot.commit.slice(0, 8)}? This will overwrite current working tree changes.`);
    if (!confirmed) return;

    setSnapshotBusy(true);
    try {
      await invoke("rewind_git_snapshot", { cwd: currentProject, commit: snapshot.commit });
      addLog(`Rewound workspace to ${snapshot.commit.slice(0, 8)}`, "system");
      await refreshSnapshots(currentProject);
    } catch (err) {
      addLog(`Rewind failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleDragStart = (e: DragEvent, index: number) => {
    e.dataTransfer.setData("agentIndex", index.toString());
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    const dragIndex = parseInt(e.dataTransfer.getData("agentIndex"));
    if (isNaN(dragIndex) || dragIndex === dropIndex) return;

    const newAgents = [...agents];
    const [draggedAgent] = newAgents.splice(dragIndex, 1);
    newAgents.splice(dropIndex, 0, draggedAgent);
    setAgents(newAgents);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleKillAgent = (agent: string) => {
    invoke("close_pty", { agent: getPtyKey(agent) }).catch(console.error);
    addLog(`Sent kill signal to ${agent}`, "system");
  };

  const handleInterruptAgent = (agent: string) => {
    invoke("write_pty", { agent: getPtyKey(agent), data: "\x03" }).catch(console.error);
    addLog(`Sent SIGINT to ${agent}`, "system");
  };

  const handleInjectHint = (agent: string, hint: string) => {
    invoke("write_pty", { agent: getPtyKey(agent), data: `${hint}\r` }).catch(console.error);
    addLog(`Injected hint to ${agent}`, "system");
  };

  const handleQuickDispatch = (target: string, task: string) => {
    emit("agent-handoff", { sender: "Orchestrator", target, payload: task, kind: "task" });
    addLog(`Quick dispatch from Orchestrator -> ${target}`, "handoff");
  };

  const handleHitlApprove = () => {
    if (!approvalRequest) return;
    if (readyAgents.current.has(approvalRequest.target)) {
      writeHandoff(approvalRequest.target, approvalRequest.payload);
    } else {
      queueHandoff(approvalRequest.target, approvalRequest.payload);
    }
    setApprovalRequest(null);
  };

  const handleHitlReject = (feedback: string) => {
    if (!approvalRequest) return;
    const senderKey = getPtyKey(approvalRequest.agent);
    let rejectionPayload = "[SYSTEM] The human rejected your completion. Please fix the issues and try again.";
    if (feedback.trim()) {
      rejectionPayload = `[SYSTEM] The human rejected your completion with the following feedback:\n${feedback}\n\nPlease fix the issues and try again.`;
    }

    if (readyAgents.current.has(senderKey)) {
      writeHandoff(senderKey, rejectionPayload);
    } else {
      queueHandoff(senderKey, rejectionPayload);
    }

    setTasks(prev => prev.map(t => t.id === approvalRequest.taskId ? { ...t, status: "in_progress" } : t));
    setApprovalRequest(null);
  };

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 overflow-hidden flex selection:bg-brand-accent/20 relative">
      <AppGlobalSidebar
        appMode={appMode}
        onSetAppMode={setAppMode}
        currentProject={currentProject}
        onOpenProject={handleOpenProject}
        onOpenSettings={() => setShowSettings(true)}
      />

      <AppOverlays
        showNetworkGraph={showNetworkGraph}
        NetworkGraphComponent={NetworkGraph}
        agents={agents}
        tasks={tasks}
        onCloseNetworkGraph={() => setShowNetworkGraph(false)}
        onKillAgent={handleKillAgent}
        onInterruptAgent={handleInterruptAgent}
        onInjectHint={handleInjectHint}
        onQuickDispatch={handleQuickDispatch}
        showSettings={showSettings}
        SettingsModalComponent={SettingsModal}
        onCloseSettings={() => setShowSettings(false)}
        showBrainstorm={showBrainstorm}
        brainstormSessions={brainstormSessions}
        onStartBrainstorm={handleStartBrainstorm}
        onCloseBrainstorm={() => setShowBrainstorm(false)}
        showMasterPlan={showMasterPlan}
        currentProject={currentProject}
        onDispatchMasterPlanTask={handleDispatchMasterPlanTask}
        activeTaskLine={masterPlanQueueState.activeLine}
        queuedTaskLines={masterPlanQueueState.queuedLines}
        onCloseMasterPlan={() => setShowMasterPlan(false)}
        approvalRequest={approvalRequest}
        onApproveHitl={handleHitlApprove}
        onRejectHitl={handleHitlReject}
      />

      {isSidebarOpen && appMode === "orchestrator" && (
        <AppSidebar
          sidecarStatus={sidecarStatus}
          currentProject={currentProject}
          onOpenProject={handleOpenProject}
          onInitialize={handleInitialize}
          onOpenSettings={() => setShowSettings(true)}
          sentinelEnabled={sentinelEnabled}
          sentinelIncidents={sentinelIncidents}
          onToggleSentinel={() => setSentinelEnabled(value => !value)}
          hitlEnabled={hitlEnabled}
          onToggleHitl={() => setHitlEnabled(!hitlEnabled)}
          agents={agents}
          agentQueueCounts={agentQueueCounts}
          onRemoveAgent={removeAgent}
          snapshots={snapshots}
          snapshotBusy={snapshotBusy}
          onManualSnapshot={handleManualSnapshot}
          onRewindSnapshot={handleRewindSnapshot}
          isTasksCollapsed={isTasksCollapsed}
          onToggleTasksCollapsed={() => setIsTasksCollapsed(!isTasksCollapsed)}
          tasks={tasks}
          isActivityCollapsed={isActivityCollapsed}
          onToggleActivityCollapsed={() => setIsActivityCollapsed(!isActivityCollapsed)}
          activity={activity}
        />
      )}

      <section className="flex-1 flex flex-col min-w-0">
        <AppTopbar
          appMode={appMode}
          onSpawnAgent={spawnAgent}
          newAgentName={newAgentName}
          onChangeNewAgentName={setNewAgentName}
          onOpenBrainstorm={() => setShowBrainstorm(true)}
          onOpenMasterPlan={() => setShowMasterPlan(true)}
          onOpenNetworkGraph={() => setShowNetworkGraph(true)}
          layoutOrientation={layoutOrientation}
          onSetLayoutOrientation={setLayoutOrientation}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <AppTerminalArea
          agents={agents}
          currentProject={currentProject}
          layoutOrientation={layoutOrientation}
          onRemoveAgent={removeAgent}
          onDetachAgent={detachAgent}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        />
      </section>
    </main>
  );
}

export default App;
