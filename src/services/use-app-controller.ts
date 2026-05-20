import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { type GitSnapshotRecord } from "../components/panels/SnapshotPanel";
import { type BrainstormSession } from "../components/modals/BrainstormModal";
import {
  getPtyKey,
  getUniqueAgents,
  type ActiveMasterPlanTask,
  type MasterPlanTaskDispatch,
  type SentinelAgentState,
} from "./app-core";
import { getSplitAgentNameInTab, getUniqueAgentNameInTab } from "@/services/agent-naming";
import { registerSentinelMonitoring } from "./sentinel-service";
import { registerHandoffListeners } from "./handoff-service";
import { createHandoffQueueService } from "./handoff-queue-service";
import { createMasterPlanWorkflow } from "../workflows/master-plan-workflow";
import { createBrainstormWorkflow } from "../workflows/brainstorm-workflow";
import { loadWorkspaces, saveWorkspaces, getSetting, setSetting } from "./db-service";
import { eventBus } from "./event-bus";
import type { SectionState, TerminalLayoutOrientation, TerminalTab, WorkspaceState } from "../types/workspace";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadStoredTerminalLanes,
  saveTerminalLanes,
} from "./terminal-lanes";
import { useZenHotkeys } from "./use-zen-hotkeys";
import { matchesKeys } from "./keybindings";

interface GitDiffStats {
  totalAdditions: number;
  totalDeletions: number;
}

import { useUIStore } from "./stores/ui-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentStore } from "./stores/agent-store";
import { useGitStore } from "./stores/git-store";
import { useOrchestrationStore } from "./stores/orchestration-store";

export function useAppController() {
  const appMode = useUIStore(s => s.appMode);
  const setAppMode = useUIStore(s => s.setAppMode);
  const isSidebarOpen = useUIStore(s => s.isSidebarOpen);
  const setIsSidebarOpen = useUIStore(s => s.setIsSidebarOpen);
  const showNetworkGraph = useUIStore(s => s.showNetworkGraph);
  const setShowNetworkGraph = useUIStore(s => s.setShowNetworkGraph);
  const showSettings = useUIStore(s => s.showSettings);
  const setShowSettings = useUIStore(s => s.setShowSettings);
  const showBrainstorm = useUIStore(s => s.showBrainstorm);
  const setShowBrainstorm = useUIStore(s => s.setShowBrainstorm);
  const showMasterPlan = useUIStore(s => s.showMasterPlan);
  const setShowMasterPlan = useUIStore(s => s.setShowMasterPlan);
  const isTasksCollapsed = useUIStore(s => s.isTasksCollapsed);
  const setIsTasksCollapsed = useUIStore(s => s.setIsTasksCollapsed);
  const isActivityCollapsed = useUIStore(s => s.isActivityCollapsed);
  const setIsActivityCollapsed = useUIStore(s => s.setIsActivityCollapsed);
  const showCodeReview = useUIStore(s => s.showCodeReview);
  const setShowCodeReview = useUIStore(s => s.setShowCodeReview);
  const showGitPanel = useUIStore(s => s.showGitPanel);
  const setShowGitPanel = useUIStore(s => s.setShowGitPanel);
  const showGitFullscreen = useUIStore(s => s.showGitFullscreen);
  const setShowGitFullscreen = useUIStore(s => s.setShowGitFullscreen);
  const showPersonalKanban = useUIStore(s => s.showPersonalKanban);
  const setShowPersonalKanban = useUIStore(s => s.setShowPersonalKanban);
  const showCalendar = useUIStore(s => s.showCalendar);
  const setShowCalendar = useUIStore(s => s.setShowCalendar);
  const showFileExplorer = useUIStore(s => s.showFileExplorer);
  const setShowFileExplorer = useUIStore(s => s.setShowFileExplorer);
  const showPortManager = useUIStore(s => s.showPortManager);
  const setShowPortManager = useUIStore(s => s.setShowPortManager);
  const showPortForwarding = useUIStore(s => s.showPortForwarding);
  const setShowPortForwarding = useUIStore(s => s.setShowPortForwarding);
  const showDockerManager = useUIStore(s => s.showDockerManager);
  const setShowDockerManager = useUIStore(s => s.setShowDockerManager);
  const showEnvManager = useUIStore(s => s.showEnvManager);
  const setShowEnvManager = useUIStore(s => s.setShowEnvManager);
  const showPackageManager = useUIStore(s => s.showPackageManager);
  const setShowPackageManager = useUIStore(s => s.setShowPackageManager);
  const showApiLab = useUIStore(s => s.showApiLab);
  const setShowApiLab = useUIStore(s => s.setShowApiLab);
  const showMonorepoGraph = useUIStore(s => s.showMonorepoGraph);
  const setShowMonorepoGraph = useUIStore(s => s.setShowMonorepoGraph);
  const showDbViewer = useUIStore(s => s.showDbViewer);
  const setShowDbViewer = useUIStore(s => s.setShowDbViewer);
  const showMdViewer = useUIStore(s => s.showMdViewer);
  const setShowMdViewer = useUIStore(s => s.setShowMdViewer);
  const showConfigEditor = useUIStore(s => s.showConfigEditor);
  const setShowConfigEditor = useUIStore(s => s.setShowConfigEditor);
  const showIconBrowser = useUIStore(s => s.showIconBrowser);
  const setShowIconBrowser = useUIStore(s => s.setShowIconBrowser);
  const showTailwindLabs = useUIStore(s => s.showTailwindLabs);
  const setShowTailwindLabs = useUIStore(s => s.setShowTailwindLabs);
  const showNpmLookup = useUIStore(s => s.showNpmLookup);
  const setShowNpmLookup = useUIStore(s => s.setShowNpmLookup);
  const showHtmlToJsx = useUIStore(s => s.showHtmlToJsx);
  const setShowHtmlToJsx = useUIStore(s => s.setShowHtmlToJsx);
  const showSvgOptimizer = useUIStore(s => s.showSvgOptimizer);
  const setShowSvgOptimizer = useUIStore(s => s.setShowSvgOptimizer);
  const showStorageInspector = useUIStore(s => s.showStorageInspector);
  const setShowStorageInspector = useUIStore(s => s.setShowStorageInspector);
  const showMockDataGenerator = useUIStore(s => s.showMockDataGenerator);
  const setShowMockDataGenerator = useUIStore(s => s.setShowMockDataGenerator);
  const showOmnibar = useUIStore(s => s.showOmnibar);
  const setShowOmnibar = useUIStore(s => s.setShowOmnibar);
  const showSecurityPanel = useUIStore(s => s.showSecurityPanel);
  const setShowSecurityPanel = useUIStore(s => s.setShowSecurityPanel);
  const pendingWorkspaceId = useUIStore(s => s.pendingWorkspaceId);
  const setPendingWorkspaceId = useUIStore(s => s.setPendingWorkspaceId);
  const isGlass = useUIStore(s => s.isGlass);
  const setIsGlass = useUIStore(s => s.setIsGlass);
  const sidecarStatus = useUIStore(s => s.sidecarStatus);
  const setSidecarStatus = useUIStore(s => s.setSidecarStatus);

  const workspaces = useWorkspaceStore(s => s.workspaces);
  const setWorkspaces = useWorkspaceStore(s => s.setWorkspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore(s => s.setActiveWorkspaceId);

  const newAgentName = useAgentStore(s => s.newAgentName);
  const setNewAgentName = useAgentStore(s => s.setNewAgentName);
  const agentQueueCounts = useAgentStore(s => s.agentQueueCounts);
  const setAgentQueueCounts = useAgentStore(s => s.setAgentQueueCounts);
  const agentStatusMap = useAgentStore(s => s.agentStatusMap);
  const setAgentStatusMap = useAgentStore(s => s.setAgentStatusMap);
  const zenAgents = useAgentStore(s => s.zenAgents);
  const setZenAgents = useAgentStore(s => s.setZenAgents);
  const zenLayout = useAgentStore(s => s.zenLayout);
  const setZenLayout = useAgentStore(s => s.setZenLayout);
  const lastActiveZenAgent = useAgentStore(s => s.lastActiveZenAgent);
  const setLastActiveZenAgent = useAgentStore(s => s.setLastActiveZenAgent);
  const focusedZenAgent = useAgentStore(s => s.focusedZenAgent);
  const setFocusedZenAgent = useAgentStore(s => s.setFocusedZenAgent);
  const portCount = useAgentStore(s => s.portCount);
  const setPortCount = useAgentStore(s => s.setPortCount);

  const codeReviewStats = useGitStore(s => s.codeReviewStats);
  const setCodeReviewStats = useGitStore(s => s.setCodeReviewStats);
  const snapshots = useGitStore(s => s.snapshots);
  const setSnapshots = useGitStore(s => s.setSnapshots);
  const snapshotBusy = useGitStore(s => s.snapshotBusy);
  const setSnapshotBusy = useGitStore(s => s.setSnapshotBusy);

  const activity = useOrchestrationStore(s => s.activity);
  const setActivity = useOrchestrationStore(s => s.setActivity);
  const tasks = useOrchestrationStore(s => s.tasks);
  const setTasks = useOrchestrationStore(s => s.setTasks);
  const masterPlanQueueState = useOrchestrationStore(s => s.masterPlanQueueState);
  const setMasterPlanQueueState = useOrchestrationStore(s => s.setMasterPlanQueueState);
  const sentinelEnabled = useOrchestrationStore(s => s.sentinelEnabled);
  const setSentinelEnabled = useOrchestrationStore(s => s.setSentinelEnabled);
  const hitlEnabled = useOrchestrationStore(s => s.hitlEnabled);
  const setHitlEnabled = useOrchestrationStore(s => s.setHitlEnabled);
  const approvalRequest = useOrchestrationStore(s => s.approvalRequest);
  const setApprovalRequest = useOrchestrationStore(s => s.setApprovalRequest);
  const sentinelIncidents = useOrchestrationStore(s => s.sentinelIncidents);
  const setSentinelIncidents = useOrchestrationStore(s => s.setSentinelIncidents);
  const brainstormSessions = useOrchestrationStore(s => s.brainstormSessions);
  const setBrainstormSessions = useOrchestrationStore(s => s.setBrainstormSessions);

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
    const unsub = eventBus.subscribe("git-status-changed", () => refreshCodeReviewStats());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentProject]);

  useEffect(() => {
    if (!isDbLoaded || showPortManager || appMode === "zen" || appMode === "editor") return;

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
    const unsub = eventBus.subscribe("ports-changed", () => refreshPortCount());

    return () => {
      cancelled = true;
      unsub();
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

  const spawnAgent = (e?: FormEvent, customName?: string, shell?: string) => {
    if (e) e.preventDefault();
    const activeTabAgents = activeTab?.agents ?? [];
    const name = getUniqueAgentNameInTab(activeTabAgents, customName || newAgentName || "Terminal");

    const agentId = crypto.randomUUID();
    if (shell) {
      const rootLane = {
        id: ROOT_TERMINAL_LANE_ID,
        label: "Main",
        agentName: agentId,
        shell,
      };
      saveTerminalLanes(agentId, activeWorkspaceId, [rootLane]);
    }

    const newAgent = { id: agentId, name };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    setNewAgentName("");
    addLog(`Spawned terminal: ${name}`, "system");
  };

  const handleOpenProjectInTerminal = useCallback((_path: string, name: string) => {
    const agentName = getUniqueAgentNameInTab(agents, name);

    const newAgent = { id: crypto.randomUUID(), name: agentName };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    addLog(`Opening ${name} in terminal...`, "system");
    setShowMonorepoGraph(false);
  }, [activeTabId, agents]);

  const removeAgent = (agentToRemoveId: string) => {
    const agentToRemove = agents.find(a => a.id === agentToRemoveId)?.name || agentToRemoveId;
    const agentKey = getTerminalLanePtyKey(activeWorkspaceId, agentToRemoveId);
    closeStoredTerminalLanes(agentToRemoveId);
    invoke("close_pty", { agent: agentKey }).catch(console.error);
    pendingHandoffs.current.delete(agentKey);
    readyAgents.current.delete(agentKey);
    setAgentQueueCounts(prev => {
      const next = { ...prev };
      delete next[agentKey];
      return next;
    });
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a.id !== agentToRemoveId) } : t));
    addLog(`Terminated agent: ${agentToRemove}`, "system");
  };

  const detachAgent = (agentToDetachId: string) => {
    const agentToDetach = agents.find(a => a.id === agentToDetachId)?.name || agentToDetachId;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a.id !== agentToDetachId) } : t));
    addLog(`Detached agent: ${agentToDetach}`, "system");
  };

  const handleSpawnBrowser = () => {
    const newAgent = { id: crypto.randomUUID(), name: `browser:${Date.now()}` };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    addLog("Opened browser pane", "system");
  };


  const handleSetLayoutOrientation = (orientation: TerminalLayoutOrientation) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, layoutOrientation: orientation } : t));
  };

  const handleSplit = (agentToSplitId: string) => {
    const agentToSplit = agents.find(a => a.id === agentToSplitId)?.name || "Split Agent";
    const newName = getSplitAgentNameInTab(agents, agentToSplit);

    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const index = t.agents.findIndex(a => a.id === agentToSplitId);
      const newAgent = { id: crypto.randomUUID(), name: newName };
      if (index === -1) return { ...t, agents: [...t.agents, newAgent] };
      const newAgents = [...t.agents];
      newAgents.splice(index + 1, 0, newAgent);
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
    activeWorkspaceId,
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
      if (matchesKeys(e, "quick-palette")) {
        e.preventDefault();
        e.stopPropagation();
        setShowOmnibar(prev => !prev);
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
    showCalendar,
    setShowCalendar,
    showFileExplorer,
    setShowFileExplorer,
    showPortManager,
    setShowPortManager,
    showPortForwarding,
    setShowPortForwarding,
    showDockerManager,
    setShowDockerManager,
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
    showMockDataGenerator,
    setShowMockDataGenerator,
    showOmnibar,
    setShowOmnibar,
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
