import { useCallback, useEffect, useRef, useState, type FormEvent, lazy } from "react";
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

import { AppTerminalTabs } from "./app/components/AppTerminalTabs";

const NetworkGraph = lazy(() => import("./components/NetworkGraph").then(module => ({ default: module.NetworkGraph })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(module => ({ default: module.SettingsModal })));

export interface TerminalTab {
  id: string;
  name: string;
  agents: string[];
  layoutOrientation: "horizontal" | "vertical" | "grid";
}

export interface WorkspaceState {
  id: string;
  name: string;
  directory: string | null;
  tabs: TerminalTab[];
  activeTabId: string;
}

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
  
  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>(() => {
    const saved = localStorage.getItem("didi_workspaces");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn("Failed to parse saved workspaces", e);
      }
    }
    // Fallback migration
    const legacyTabs = localStorage.getItem("didi_tabs");
    const legacyProject = localStorage.getItem("didi_project");
    let initialTabs = [{ id: crypto.randomUUID(), name: "Workspace", agents: ["Terminal 1"], layoutOrientation: "horizontal" as const }];
    if (legacyTabs) {
      try {
        const parsed = JSON.parse(legacyTabs);
        if (Array.isArray(parsed) && parsed.length > 0) initialTabs = parsed;
      } catch(e) {}
    }
    return [{
      id: crypto.randomUUID(),
      name: "Workspace 1",
      directory: legacyProject || null,
      tabs: initialTabs,
      activeTabId: localStorage.getItem("didi_active_tab") || initialTabs[0].id
    }];
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const saved = localStorage.getItem("didi_active_workspace");
    return saved || (workspaces.length > 0 ? workspaces[0].id : "");
  });

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = activeWorkspace?.directory || null;
  const tabs = activeWorkspace?.tabs || [];
  const activeTabId = activeWorkspace?.activeTabId || "";

  const setTabs = (val: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      return { ...w, tabs: typeof val === "function" ? val(w.tabs) : val };
    }));
  };

  const setActiveTabId = (val: string) => {
    setWorkspaces(prev => prev.map(w => w.id === activeWorkspaceId ? { ...w, activeTabId: val } : w));
  };

  // Derived state for legacy compatibility
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const allAgents = getUniqueAgents(tabs.flatMap(t => t.agents));
  const agents = activeTab ? activeTab.agents : [];
  const layoutOrientation = activeTab ? activeTab.layoutOrientation : "horizontal";

  const [newAgentName, setNewAgentName] = useState("");
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
  const agentsRef = useRef(allAgents);
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
    agentsRef.current = allAgents;
  }, [allAgents]);

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
  }), [writeHandoff, queueHandoff, flushQueuedHandoff]);

  useEffect(() => {
    localStorage.setItem("didi_tabs", JSON.stringify(tabs));
    localStorage.setItem("didi_active_tab", activeTabId);
  }, [tabs, activeTabId]);

  const handleWorkspaceSelect = (id: string) => {
    setActiveWorkspaceId(id);
  };

  const handleWorkspaceReorder = (dragIndex: number, dropIndex: number) => {
    setWorkspaces(prev => {
      const next = [...prev];
      const [draggedWs] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, draggedWs);
      return next;
    });
  };

  const handleWorkspaceRename = (id: string, newName: string) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: newName } : w));
  };

  const handleWorkspaceDelete = (id: string) => {
    const newWs = workspaces.filter(w => w.id !== id);
    if (newWs.length === 0) {
      const defaultWs: WorkspaceState = {
        id: crypto.randomUUID(),
        name: `Workspace 1`,
        directory: null,
        tabs: [{ id: crypto.randomUUID(), name: "Tab 1", agents: ["Terminal 1"], layoutOrientation: "horizontal" }],
        activeTabId: ""
      };
      defaultWs.activeTabId = defaultWs.tabs[0].id;
      setWorkspaces([defaultWs]);
      setActiveWorkspaceId(defaultWs.id);
    } else {
      setWorkspaces(newWs);
      if (activeWorkspaceId === id) setActiveWorkspaceId(newWs[0].id);
    }
  };

  const handleCreateWorkspace = () => {
    const newWs: WorkspaceState = {
      id: crypto.randomUUID(),
      name: `Workspace ${workspaces.length + 1}`,
      directory: null,
      tabs: [{ id: crypto.randomUUID(), name: "Tab 1", agents: ["Terminal 1"], layoutOrientation: "horizontal" }],
      activeTabId: ""
    };
    newWs.activeTabId = newWs.tabs[0].id;
    setWorkspaces([...workspaces, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleOpenDirectory = async (id: string) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, directory: selected as string } : w));
      addLog(`Opened workspace directory: ${selected}`, "system");
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

  const handleReorderAgents = (oldIndex: number, newIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const newAgents = [...t.agents];
      const [moved] = newAgents.splice(oldIndex, 1);
      newAgents.splice(newIndex, 0, moved);
      return { ...t, agents: newAgents };
    }));
  };

  const handleTabCreate = () => {
    const newTab: TerminalTab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      agents: ["Main Terminal"],
      layoutOrientation: "horizontal",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleTabSelect = (id: string) => {
    setActiveTabId(id);
  };

  const handleTabRename = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleTabClose = (id: string) => {
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      const fallbackTab: TerminalTab = {
        id: crypto.randomUUID(),
        name: "Tab 1",
        agents: ["Main Terminal"],
        layoutOrientation: "horizontal",
      };
      setTabs([fallbackTab]);
      setActiveTabId(fallbackTab.id);
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const spawnAgent = (e: FormEvent) => {
    e.preventDefault();
    let name = newAgentName.trim();
    if (!name) {
      let counter = 1;
      name = `Terminal ${counter}`;
      while (allAgents.includes(name)) {
        counter++;
        name = `Terminal ${counter}`;
      }
    }
    if (!findMatchingAgent(allAgents, name)) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, name] } : t));
      setNewAgentName("");
      addLog(`Spawned terminal: ${name}`, "system");
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
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a !== agentToRemove) } : t));
    addLog(`Terminated agent: ${agentToRemove}`, "system");
  };

  const detachAgent = (agentToDetach: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a !== agentToDetach) } : t));
    addLog(`Detached agent: ${agentToDetach}`, "system");
  };


  const handleSetLayoutOrientation = (orientation: "horizontal" | "vertical" | "grid") => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, layoutOrientation: orientation } : t));
  };

  const handleSplit = (agentToSplit: string) => {
    // Generate a unique name for the split terminal
    const baseName = agentToSplit.replace(/-\d+$/, "");
    let counter = 1;
    let newName = `${baseName}-${counter}`;
    while (allAgents.includes(newName)) {
      counter++;
      newName = `${baseName}-${counter}`;
    }
    
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const index = t.agents.indexOf(agentToSplit);
      if (index === -1) return { ...t, agents: [...t.agents, newName] };
      const newAgents = [...t.agents];
      newAgents.splice(index + 1, 0, newName);
      return { ...t, agents: newAgents };
    }));
    
    addLog(`Split terminal: ${newName}`, "system");
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
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceSelect={handleWorkspaceSelect}
        onCreateWorkspace={handleCreateWorkspace}
        onOpenDirectory={handleOpenDirectory}
        onOpenSettings={() => setShowSettings(true)}
        onWorkspaceReorder={handleWorkspaceReorder}
        onWorkspaceRename={handleWorkspaceRename}
        onWorkspaceDelete={handleWorkspaceDelete}
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
          onSetLayoutOrientation={handleSetLayoutOrientation}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <AppTerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabCreate={handleTabCreate}
          onTabRename={handleTabRename}
        />

        <AppTerminalArea
          agents={agents}
          currentProject={currentProject}
          layoutOrientation={layoutOrientation}
          onRemoveAgent={removeAgent}
          onDetachAgent={detachAgent}
          onReorderAgents={handleReorderAgents}
          onSplit={handleSplit}
          onOpenDirectory={() => handleOpenDirectory(activeWorkspaceId)}
        />
      </section>

      {isSidebarOpen && appMode === "orchestrator" && (
        <AppSidebar
          sidecarStatus={sidecarStatus}
          currentProject={currentProject}
          onOpenProject={() => handleOpenDirectory(activeWorkspaceId)}
          onInitialize={handleInitialize}
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
    </main>
  );
}

export default App;
