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
import { CodeReviewPanel } from "./app/components/CodeReviewPanel";
import { GitPanel } from "./app/components/GitPanel";
import { SourceControlFullscreen } from "./app/components/SourceControlFullscreen";
import { PersonalKanban } from "./app/components/PersonalKanban";
import { ProjectFileExplorer } from "./app/components/ProjectFileExplorer";
import { StatusBar } from "./app/components/StatusBar";
import { PortManager } from "./app/components/PortManager";
import { EnvManager } from "./app/components/EnvManager";
import { PackageManager } from "./app/components/PackageManager";
import { ApiLab } from "./app/components/ApiLab";
import { AppGlobalSidebar } from "./app/components/AppGlobalSidebar";
import { AppTopbar } from "./app/components/AppTopbar";
import { AppTerminalArea } from "./app/components/AppTerminalArea";

import { AppTerminalTabs } from "./app/components/AppTerminalTabs";
import { AmbientMode } from "./app/components/AmbientMode";
import { DbViewer } from "./app/components/DbViewer";
import { SecurityPanel } from "./app/components/SecurityPanel";
import { TwoFactorModal } from "./components/TwoFactorModal";
import { loadWorkspaces, saveWorkspaces, getSetting, setSetting } from "./services/db-service";

const NetworkGraph = lazy(() => import("./components/NetworkGraph").then(module => ({ default: module.NetworkGraph })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(module => ({ default: module.SettingsModal })));

export interface TerminalTab {
  id: string;
  name: string;
  agents: string[];
  layoutOrientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic";
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

  const [appMode, setAppMode] = useState<"terminal" | "orchestrator" | "zen">("terminal");

  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>(() => {
    return [{ id: crypto.randomUUID(), name: "Workspace 1", directory: null, tabs: [], activeTabId: "" }];
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => "");

  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const dbWorkspaces = await loadWorkspaces();
        if (dbWorkspaces && dbWorkspaces.length > 0) {
          setWorkspaces(dbWorkspaces);
          const savedActiveWs = await getSetting("activeWorkspaceId");
          const validId = dbWorkspaces.find(w => w.id === savedActiveWs)?.id;
          setActiveWorkspaceId(validId ?? dbWorkspaces[0].id);
        } else {
          // First launch: set activeWorkspaceId to the default workspace already in state.
          setWorkspaces(prev => {
            setActiveWorkspaceId(prev[0].id);
            return prev;
          });
        }
        const savedMode = await getSetting("appMode");
        if (savedMode === "terminal" || savedMode === "orchestrator" || savedMode === "zen") setAppMode(savedMode as any);
        const savedSidebar = await getSetting("isSidebarOpen");
        if (savedSidebar !== null) setIsSidebarOpen(savedSidebar === "true");
        const savedSentinel = await getSetting("sentinelEnabled");
        if (savedSentinel !== null) setSentinelEnabled(savedSentinel === "true");
        const savedHitl = await getSetting("hitlEnabled");
        if (savedHitl !== null) setHitlEnabled(savedHitl === "true");
      } catch (err) {
        console.error("[didi] Failed to load data from DB:", err);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadData();
  }, []);

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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
  const [showCodeReview, setShowCodeReview] = useState(false);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [showGitFullscreen, setShowGitFullscreen] = useState(false);
  const [showPersonalKanban, setShowPersonalKanban] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showPortManager, setShowPortManager] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [showPackageManager, setShowPackageManager] = useState(false);
  const [showApiLab, setShowApiLab] = useState(false);
  const [showMonorepoGraph, setShowMonorepoGraph] = useState(false);
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [showSecurityPanel, setShowSecurityPanel] = useState<string | null>(null);
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<string | null>(null);
  const [portCount, setPortCount] = useState(0);
  const [codeReviewStats, setCodeReviewStats] = useState({ additions: 0, deletions: 0 });
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [sentinelEnabled, setSentinelEnabled] = useState(false);
  const [hitlEnabled, setHitlEnabled] = useState(false);
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
    if (!isDbLoaded) return;
    setSetting("appMode", appMode).catch(console.error);
  }, [appMode, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("isSidebarOpen", String(isSidebarOpen)).catch(console.error);
  }, [isSidebarOpen, isDbLoaded]);

  useEffect(() => {
    hitlEnabledRef.current = hitlEnabled;
    if (!isDbLoaded) return;
    setSetting("hitlEnabled", String(hitlEnabled)).catch(console.error);
  }, [hitlEnabled, isDbLoaded]);

  useEffect(() => {
    sentinelEnabledRef.current = sentinelEnabled;
    if (!isDbLoaded) return;
    setSetting("sentinelEnabled", String(sentinelEnabled)).catch(console.error);
  }, [sentinelEnabled, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("activeWorkspaceId", activeWorkspaceId).catch(console.error);
  }, [activeWorkspaceId, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    const timeout = setTimeout(() => {
      saveWorkspaces(workspaces).catch(e => console.error("[didi] Save failed:", e));
    }, 500);
    return () => clearTimeout(timeout);
  }, [workspaces, isDbLoaded]);

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
      
      if (config.theme_mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      if (config.glassmorphism) {
        document.documentElement.classList.add("glass");
      } else {
        document.documentElement.classList.remove("glass");
      }
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


  const handleWorkspaceSelect = async (id: string) => {
    if (id === activeWorkspaceId) return;
    
    try {
      const isLocked = await invoke<boolean>("is_pin_enabled", { workspaceId: id });
      if (isLocked) {
        setPendingWorkspaceId(id);
      } else {
        setActiveWorkspaceId(id);
      }
    } catch (err) {
      console.error("PIN check failed:", err);
      setActiveWorkspaceId(id);
    }
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
      const emptyWs: WorkspaceState = {
        id: crypto.randomUUID(),
        name: `Workspace 1`,
        directory: null,
        tabs: [],
        activeTabId: "",
      };
      setWorkspaces([emptyWs]);
      setActiveWorkspaceId(emptyWs.id);
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
      tabs: [],
      activeTabId: "",
    };
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
      agents: [],
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
        agents: [],
        layoutOrientation: "horizontal",
      };
      setTabs([fallbackTab]);
      setActiveTabId(fallbackTab.id);
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  const handleTabReorder = (oldIndex: number, newIndex: number) => {
    setTabs(prev => {
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const spawnAgent = (e: FormEvent) => {
    e.preventDefault();
    let name = newAgentName.trim();
    if (!name) {
      let counter = 1;
      name = `Terminal ${counter}`;
      while (findMatchingAgent(allAgents, name)) {
        counter++;
        name = `Terminal ${counter}`;
      }
    } else {
      let originalName = name;
      let counter = 1;
      while (findMatchingAgent(allAgents, name)) {
        counter++;
        name = `${originalName}-${counter}`;
      }
    }
    
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, name] } : t));
    setNewAgentName("");
    addLog(`Spawned terminal: ${name}`, "system");
  };

  const handleOpenProjectInTerminal = useCallback((_path: string, name: string) => {
    // Generate unique name
    let agentName = name;
    let counter = 1;
    while (findMatchingAgent(allAgents, agentName)) {
      counter++;
      agentName = `${name}-${counter}`;
    }

    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, agentName] } : t));
    addLog(`Opening ${name} in terminal...`, "system");
    setShowMonorepoGraph(false);
  }, [allAgents, activeTabId]);

  const removeAgent = (agentToRemove: string) => {
    const agentKey = `${activeWorkspaceId}::${getPtyKey(agentToRemove)}`;
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

  const handleSpawnBrowser = () => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, `browser:${Date.now()}`] } : t));
    addLog("Opened browser pane", "system");
  };


  const handleSetLayoutOrientation = (orientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic") => {
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
    invoke("close_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}` }).catch(console.error);
    addLog(`Sent kill signal to ${agent}`, "system");
  };

  const handleInterruptAgent = (agent: string) => {
    invoke("write_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}`, data: "\x03" }).catch(console.error);
    addLog(`Sent SIGINT to ${agent}`, "system");
  };

  const handleInjectHint = (agent: string, hint: string) => {
    invoke("write_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}`, data: `${hint}\r` }).catch(console.error);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Zen Mode with Alt + Q (using capture phase to override terminal)
      if (e.altKey && e.code === "KeyQ") {
        e.preventDefault();
        e.stopPropagation();
        setAppMode(prev => prev === "zen" ? "terminal" : "zen");
      }
    };
    window.addEventListener("keydown", handleKeyDown, true); // true = capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 overflow-hidden flex selection:bg-brand-accent/20 relative">
      {appMode !== "zen" && (
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
          onOpenSecurity={(id) => setShowSecurityPanel(id)}
        />
      )}

      {appMode !== "zen" && (
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
          showMonorepoGraph={showMonorepoGraph}
          onCloseMonorepoGraph={() => setShowMonorepoGraph(false)}
          onOpenInTerminal={handleOpenProjectInTerminal}
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
      )}

      <section className="flex-1 flex flex-col min-w-0">
        {appMode !== "zen" && (
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
            onSpawnBrowser={handleSpawnBrowser}
            codeReviewStats={codeReviewStats}
            onToggleCodeReview={() => setShowCodeReview(!showCodeReview)}
            onToggleGitPanel={() => setShowGitPanel(!showGitPanel)}
            onTogglePersonalKanban={() => setShowPersonalKanban(!showPersonalKanban)}
            onToggleFileExplorer={() => setShowFileExplorer(!showFileExplorer)}
            onToggleEnvManager={() => setShowEnvManager(!showEnvManager)}
            onTogglePackageManager={() => setShowPackageManager(!showPackageManager)}
            onToggleApiLab={() => setShowApiLab(!showApiLab)}
            onToggleMonorepoGraph={() => setShowMonorepoGraph(!showMonorepoGraph)}
            currentProject={currentProject}
          />
        )}

        {appMode !== "zen" && (
          <AppTerminalTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onTabCreate={handleTabCreate}
            onTabRename={handleTabRename}
            onTabReorder={handleTabReorder}
          />
        )}

        {appMode !== "zen" ? (
          <AppTerminalArea
            agents={agents}
            currentProject={currentProject}
            layoutOrientation={layoutOrientation}
            onRemoveAgent={removeAgent}
            onDetachAgent={detachAgent}
            onReorderAgents={handleReorderAgents}
            onSplit={handleSplit}
            onOpenDirectory={() => handleOpenDirectory(activeWorkspaceId)}
            workspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name}
            workspaceId={activeWorkspaceId}
          />
        ) : (
          <div className="flex-1 min-h-0 min-w-0 flex bg-black relative">
            {/* Hidden Exit Button - slides down on hover at the very top edge */}
            <div className="absolute top-0 left-0 right-0 h-2 z-[100] group/exit pointer-events-auto">
              <div className="absolute top-0 left-0 right-0 -translate-y-full group-hover/exit:translate-y-0 transition-transform duration-300 flex items-center justify-center py-4">
                <button 
                  onClick={() => setAppMode("terminal")}
                  className="bg-brand-accent/20 hover:bg-brand-accent/40 text-brand-primary text-[10px] font-bold px-6 py-2 rounded-full border border-brand-accent/30 backdrop-blur-xl shadow-2xl transition-all uppercase tracking-[0.3em]"
                >
                  Exit Zen Mode (Alt + Q)
                </button>
              </div>
            </div>
            <TerminalInstance agentName="zen-terminal" cwd={null} isZenMode={true} />
          </div>
        )}
        
        {appMode !== "zen" && (showCodeReview || showGitPanel || showPersonalKanban || showFileExplorer) && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[45] animate-in fade-in duration-300" 
            onClick={() => {
              setShowCodeReview(false);
              setShowGitPanel(false);
              setShowPersonalKanban(false);
              setShowFileExplorer(false);
            }}
          />
        )}

        {appMode !== "zen" && (
          <>
            <CodeReviewPanel 
              currentProject={currentProject} 
              isOpen={showCodeReview} 
              onClose={() => setShowCodeReview(false)} 
              onStatsUpdate={setCodeReviewStats}
            />
            <GitPanel
              currentProject={currentProject}
              isOpen={showGitPanel}
              onClose={() => setShowGitPanel(false)}
              onOpenFullscreen={() => {
                setShowGitPanel(false);
                setShowGitFullscreen(true);
              }}
            />
            <SourceControlFullscreen
              currentProject={currentProject}
              isOpen={showGitFullscreen}
              onClose={() => setShowGitFullscreen(false)}
            />
            <PersonalKanban
              workspaceId={activeWorkspaceId}
              isOpen={showPersonalKanban}
              onClose={() => setShowPersonalKanban(false)}
            />
            <ProjectFileExplorer
              currentProject={currentProject}
              isOpen={showFileExplorer}
              onClose={() => setShowFileExplorer(false)}
            />
            <StatusBar 
              portCount={portCount} 
              onOpenPortManager={() => setShowPortManager(true)} 
              onOpenDbViewer={() => setShowDbViewer(true)}
            />
          </>
        )}
      </section>

      {appMode !== "zen" && (
        <>
          <PortManager 
            isOpen={showPortManager} 
            onClose={() => setShowPortManager(false)} 
            onPortsUpdate={setPortCount}
          />
          <EnvManager
            currentProject={currentProject}
            isOpen={showEnvManager}
            onClose={() => setShowEnvManager(false)}
          />
          <PackageManager
            currentProject={currentProject}
            isOpen={showPackageManager}
            onClose={() => setShowPackageManager(false)}
          />
          <ApiLab
            isOpen={showApiLab}
            onClose={() => setShowApiLab(false)}
          />
          <DbViewer
            isOpen={showDbViewer}
            onClose={() => setShowDbViewer(false)}
          />
          {showSecurityPanel && (
            <SecurityPanel 
              workspaceId={showSecurityPanel}
              workspaceName={workspaces.find(w => w.id === showSecurityPanel)?.name || ""}
              isOpen={!!showSecurityPanel}
              onClose={() => setShowSecurityPanel(null)}
            />
          )}
          {pendingWorkspaceId && (
            <TwoFactorModal
              isOpen={!!pendingWorkspaceId}
              workspaceId={pendingWorkspaceId}
              workspaceName={workspaces.find(w => w.id === pendingWorkspaceId)?.name || ""}
              onVerify={(success) => {
                if (success) {
                  setActiveWorkspaceId(pendingWorkspaceId);
                  setPendingWorkspaceId(null);
                }
              }}
              onCancel={() => setPendingWorkspaceId(null)}
            />
          )}
        </>
      )}

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
      <AmbientMode />
    </main>
  );
}

export default App;
