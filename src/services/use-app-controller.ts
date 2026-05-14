import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { type SentinelIncident } from "../components/panels/SentinelPanel";
import { type GitSnapshotRecord } from "../components/panels/SnapshotPanel";
import { type BrainstormSession } from "../components/modals/BrainstormModal";
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
} from "./app-core";
import { registerSentinelMonitoring } from "./sentinel-service";
import { registerHandoffListeners } from "./handoff-service";
import { createHandoffQueueService } from "./handoff-queue-service";
import { createMasterPlanWorkflow } from "../workflows/master-plan-workflow";
import { createBrainstormWorkflow } from "../workflows/brainstorm-workflow";
import { loadWorkspaces, saveWorkspaces, getSetting, setSetting } from "./db-service";
import type { AppMode, SectionState, TerminalLayoutOrientation, TerminalTab, WorkspaceState, ZenLayoutOrientation } from "../types/workspace";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadStoredTerminalLanes,
} from "./terminal-lanes";
import { useZenHotkeys } from "./use-zen-hotkeys";

interface GitDiffStats {
  totalAdditions: number;
  totalDeletions: number;
}

export function useAppController() {
  const [appMode, setAppMode] = useState<AppMode>("terminal");

  const [workspaces, setWorkspaces] = useState<WorkspaceState[]>(() => {
    const defaultSectionId = crypto.randomUUID();
    return [{
      id: crypto.randomUUID(),
      name: "Workspace 1",
      directory: null,
      sections: [{ id: defaultSectionId, name: "Section 1", tabs: [] }],
      activeTabId: "",
      activeSectionId: defaultSectionId
    }];
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
  const activeSection = activeWorkspace?.sections.find(s => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const activeTabId = activeSection?.activeTabId || activeWorkspace?.activeTabId || "";

  const setTabs = (val: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const targetSectionId = w.activeSectionId || w.sections[0]?.id;
      const currentTabs = w.sections.find(s => s.id === targetSectionId)?.tabs || [];
      const nextTabs = typeof val === "function" ? val(currentTabs) : val;

      const sections = w.sections.map(s => s.id === targetSectionId ? { ...s, tabs: nextTabs } : s);

      if (sections.length === 0) {
        sections.push({ id: crypto.randomUUID(), name: "Section 1", tabs: nextTabs });
      }

      return { ...w, sections };
    }));
  };

  const setActiveTabId = (val: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const targetSectionId = w.activeSectionId || w.sections[0]?.id;
      const sections = w.sections.map(s => s.id === targetSectionId ? { ...s, activeTabId: val } : s);
      return { ...w, sections, activeTabId: val };
    }));
  };

  const activeTab = tabs.find((t: TerminalTab) => t.id === activeTabId) || tabs[0];
  const allAgents = getUniqueAgents(tabs.flatMap((t: TerminalTab) => t.agents));
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
  const [agentStatusMap, setAgentStatusMap] = useState<Record<string, boolean>>({});
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
  const [zenAgents, setZenAgents] = useState<string[]>(["zen-terminal"]);
  const [zenLayout, setZenLayout] = useState<ZenLayoutOrientation>("grid");
  const [lastActiveZenAgent, setLastActiveZenAgent] = useState<string | null>("zen-terminal");
  const [focusedZenAgent, setFocusedZenAgent] = useState<string | null>(null);
  const [showApiLab, setShowApiLab] = useState(false);
  const [showMonorepoGraph, setShowMonorepoGraph] = useState(false);
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [showMdViewer, setShowMdViewer] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showIconBrowser, setShowIconBrowser] = useState(false);
  const [showTailwindLabs, setShowTailwindLabs] = useState(false);
  const [showNpmLookup, setShowNpmLookup] = useState(false);
  const [showHtmlToJsx, setShowHtmlToJsx] = useState(false);
  const [showSvgOptimizer, setShowSvgOptimizer] = useState(false);
  const [showStorageInspector, setShowStorageInspector] = useState(false);
  const [showQuickPalette, setShowQuickPalette] = useState(false);
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
  const [isGlass, setIsGlass] = useState(false);

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
    if (!currentProject) {
      setCodeReviewStats({ additions: 0, deletions: 0 });
      return;
    }

    let cancelled = false;
    let isRefreshing = false;

    const refreshCodeReviewStats = async () => {
      if (isRefreshing) return;
      isRefreshing = true;

      try {
        const stats = await invoke<GitDiffStats>("get_git_diff_stats", { cwd: currentProject });
        if (!cancelled) {
          setCodeReviewStats(prev => {
            if (prev.additions === stats.totalAdditions && prev.deletions === stats.totalDeletions) {
              return prev;
            }

            return {
              additions: stats.totalAdditions,
              deletions: stats.totalDeletions,
            };
          });
        }
      } catch {
        if (!cancelled) {
          setCodeReviewStats(prev => {
            if (prev.additions === 0 && prev.deletions === 0) return prev;
            return { additions: 0, deletions: 0 };
          });
        }
      } finally {
        isRefreshing = false;
      }
    };

    refreshCodeReviewStats();
    const interval = setInterval(refreshCodeReviewStats, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentProject]);

  useEffect(() => {
    if (!isDbLoaded || showPortManager || appMode === "zen") return;

    let cancelled = false;
    let isRefreshing = false;

    const refreshPortCount = async () => {
      if (isRefreshing) return;
      isRefreshing = true;

      try {
        const result = await invoke<unknown[]>("get_active_ports");
        if (!cancelled) {
          setPortCount(result.length);
        }
      } catch {
      } finally {
        isRefreshing = false;
      }
    };

    refreshPortCount();
    const interval = setInterval(refreshPortCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appMode, isDbLoaded, showPortManager]);

  useEffect(() => {
    const fetchConfig = () => {
      invoke<any>("get_config").then(config => {
        document.documentElement.style.setProperty("--tw-colors-brand-accent", config.theme_cyan);
        document.documentElement.style.setProperty("--tw-colors-brand-warn", config.theme_amber);
        setIsGlass(!!config.glassmorphism);

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
    };

    fetchConfig();
    const unlisten = listen("config-updated", () => fetchConfig());

    const interval = setInterval(() => {
      invoke<string>("get_sidecar_status").then(setSidecarStatus).catch(() => setSidecarStatus("Error"));
    }, 5000);
    return () => {
      clearInterval(interval);
      unlisten.then(f => f());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ agent: string, isReady: boolean }>("agent-state", (event) => {
      setAgentStatusMap(prev => ({
        ...prev,
        [event.payload.agent]: event.payload.isReady
      }));
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  useEffect(() => registerSentinelMonitoring({
    sentinelEnabledRef,
    sentinelStates,
    setSentinelIncidents,
    addLog,
  }), []);

  const { writeHandoff, queueHandoff, flushQueuedHandoff } = useMemo(() => createHandoffQueueService({
    pendingHandoffs,
    readyAgents,
    setAgentQueueCounts,
  }), []);

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
      const defaultSectionId = crypto.randomUUID();
      const emptyWs: WorkspaceState = {
        id: crypto.randomUUID(),
        name: `Workspace 1`,
        directory: null,
        sections: [],
        activeTabId: "",
        activeSectionId: defaultSectionId,
      };
      setWorkspaces([emptyWs]);
      setActiveWorkspaceId(emptyWs.id);
    } else {
      setWorkspaces(newWs);
      if (activeWorkspaceId === id) setActiveWorkspaceId(newWs[0].id);
    }
  };

  const handleCreateWorkspace = () => {
    const defaultSectionId = crypto.randomUUID();
    const newWs: WorkspaceState = {
      id: crypto.randomUUID(),
      name: `Workspace ${workspaces.length + 1}`,
      directory: null,
      sections: [{ id: defaultSectionId, name: "Section 1", tabs: [] }],
      activeTabId: "",
      activeSectionId: defaultSectionId,
    };
    setWorkspaces([...workspaces, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleSectionCreate = (workspaceId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      const newSection: SectionState = {
        id: crypto.randomUUID(),
        name: `Section ${w.sections.length + 1}`,
        tabs: [],
      };
      return { ...w, sections: [...w.sections, newSection] };
    }));
  };

  const handleSectionSelect = (workspaceId: string, sectionId: string) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, activeSectionId: sectionId } : w));
  };

  const handleSectionRename = (workspaceId: string, sectionId: string, newName: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      return {
        ...w,
        sections: w.sections.map(s => s.id === sectionId ? { ...s, name: newName } : s)
      };
    }));
  };

  const handleSectionDelete = (workspaceId: string, sectionId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      const newSections = w.sections.filter(s => s.id !== sectionId);
      if (newSections.length === 0) {
        newSections.push({ id: crypto.randomUUID(), name: "Section 1", tabs: [] });
      }
      return { ...w, sections: newSections };
    }));
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

  const closeStoredTerminalLanes = (agentName: string) => {
    const storedLanes = loadStoredTerminalLanes(agentName, activeWorkspaceId);
    if (!storedLanes) return;

    for (const lane of storedLanes) {
      if (lane.id === ROOT_TERMINAL_LANE_ID) continue;
      invoke("close_pty", { agent: getTerminalLanePtyKey(activeWorkspaceId, lane.agentName) }).catch(console.error);
    }

    clearTerminalLanes(agentName, activeWorkspaceId);
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
    closeStoredTerminalLanes(agentToRemove);
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


  const handleSetLayoutOrientation = (orientation: TerminalLayoutOrientation) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, layoutOrientation: orientation } : t));
  };

  const handleSplit = (agentToSplit: string) => {
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
    closeStoredTerminalLanes(agent);
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

  useZenHotkeys({
    appMode,
    setAppMode,
    zenAgents,
    setZenAgents,
    setZenLayout,
    lastActiveZenAgent,
    setLastActiveZenAgent,
    focusedZenAgent,
    setFocusedZenAgent,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        e.stopPropagation();
        setShowQuickPalette(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return {
    appMode,
    setAppMode,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    currentProject,
    activeSection,
    tabs,
    activeTabId,
    agents,
    allAgents,
    layoutOrientation,
    newAgentName,
    setNewAgentName,
    isSidebarOpen,
    setIsSidebarOpen,
    showNetworkGraph,
    setShowNetworkGraph,
    showSettings,
    setShowSettings,
    showBrainstorm,
    setShowBrainstorm,
    showMasterPlan,
    setShowMasterPlan,
    sidecarStatus,
    activity,
    tasks,
    agentQueueCounts,
    agentStatusMap,
    masterPlanQueueState,
    isTasksCollapsed,
    setIsTasksCollapsed,
    showCodeReview,
    setShowCodeReview,
    showGitPanel,
    setShowGitPanel,
    showGitFullscreen,
    setShowGitFullscreen,
    showPersonalKanban,
    setShowPersonalKanban,
    showFileExplorer,
    setShowFileExplorer,
    showPortManager,
    setShowPortManager,
    showEnvManager,
    setShowEnvManager,
    showPackageManager,
    setShowPackageManager,
    zenAgents,
    setZenAgents,
    zenLayout,
    setZenLayout,
    lastActiveZenAgent,
    setLastActiveZenAgent,
    focusedZenAgent,
    setFocusedZenAgent,
    showApiLab,
    setShowApiLab,
    showMonorepoGraph,
    setShowMonorepoGraph,
    showDbViewer,
    setShowDbViewer,
    showMdViewer,
    setShowMdViewer,
    showConfigEditor,
    setShowConfigEditor,
    showIconBrowser,
    setShowIconBrowser,
    showTailwindLabs,
    setShowTailwindLabs,
    showNpmLookup,
    setShowNpmLookup,
    showHtmlToJsx,
    setShowHtmlToJsx,
    showSvgOptimizer,
    setShowSvgOptimizer,
    showStorageInspector,
    setShowStorageInspector,
    showQuickPalette,
    setShowQuickPalette,
    showSecurityPanel,
    setShowSecurityPanel,
    pendingWorkspaceId,
    setPendingWorkspaceId,
    portCount,
    setPortCount,
    codeReviewStats,
    setCodeReviewStats,
    isActivityCollapsed,
    setIsActivityCollapsed,
    sentinelEnabled,
    setSentinelEnabled,
    hitlEnabled,
    setHitlEnabled,
    approvalRequest,
    sentinelIncidents,
    snapshots,
    snapshotBusy,
    brainstormSessions,
    isGlass,
    handleWorkspaceSelect,
    handleWorkspaceReorder,
    handleWorkspaceRename,
    handleWorkspaceDelete,
    handleCreateWorkspace,
    handleSectionCreate,
    handleSectionSelect,
    handleSectionRename,
    handleSectionDelete,
    handleOpenDirectory,
    handleInitialize,
    handleManualSnapshot,
    handleRewindSnapshot,
    handleReorderAgents,
    handleTabCreate,
    handleTabSelect,
    handleTabRename,
    handleTabClose,
    handleTabReorder,
    spawnAgent,
    handleOpenProjectInTerminal,
    removeAgent,
    detachAgent,
    handleSpawnBrowser,
    handleSetLayoutOrientation,
    handleSplit,
    handleKillAgent,
    handleInterruptAgent,
    handleInjectHint,
    handleQuickDispatch,
    handleHitlApprove,
    handleHitlReject,
    handleStartBrainstorm,
    handleDispatchMasterPlanTask,
  };
}

export type AppController = ReturnType<typeof useAppController>;
