import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type BrainstormSession } from "../components/modals/BrainstormModal";
import { getUniqueAgents, type ActiveMasterPlanTask, type MasterPlanTaskDispatch, type SentinelAgentState } from "./app-core";
import { useZenHotkeys } from "./use-zen-hotkeys";
import { createHandoffQueueService } from "./handoff-queue-service";
import { createMasterPlanWorkflow } from "../workflows/master-plan-workflow";
import { createBrainstormWorkflow } from "../workflows/brainstorm-workflow";
import { loadWorkspaces, getSetting, setSetting } from "./db-service";
import type { TerminalTab } from "../types/workspace";
import { useUIStore } from "./stores/ui-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentStore } from "./stores/agent-store";
import { useGitStore } from "./stores/git-store";
import { useOrchestrationStore } from "./stores/orchestration-store";
import { useWorkspaceCrud } from "./use-workspace-crud";
import { useAgentOps } from "./use-agent-ops";
import {
  usePersistence,
  useProjectChange,
  useCodeReviewStats,
  usePortCount,
  useConfigFetcher,
  useAgentStateListener,
  useSentinel,
  useHandoffListeners,
  useOmnibarShortcut,
} from "./use-app-effects";

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
  const sidecarStatus = useUIStore(s => s.sidecarStatus);

  const workspaces = useWorkspaceStore(s => s.workspaces);
  const setWorkspaces = useWorkspaceStore(s => s.setWorkspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore(s => s.setActiveWorkspaceId);

  const newAgentName = useAgentStore(s => s.newAgentName);
  const setNewAgentName = useAgentStore(s => s.setNewAgentName);
  const agentQueueCounts = useAgentStore(s => s.agentQueueCounts);
  const setAgentQueueCounts = useAgentStore(s => s.setAgentQueueCounts);
  const agentStatusMap = useAgentStore(s => s.agentStatusMap);
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
  const snapshotBusy = useGitStore(s => s.snapshotBusy);

  const activity = useOrchestrationStore(s => s.activity);
  const setActivity = useOrchestrationStore(s => s.setActivity);
  const tasks = useOrchestrationStore(s => s.tasks);
  const masterPlanQueueState = useOrchestrationStore(s => s.masterPlanQueueState);
  const setMasterPlanQueueState = useOrchestrationStore(s => s.setMasterPlanQueueState);
  const sentinelEnabled = useOrchestrationStore(s => s.sentinelEnabled);
  const setSentinelEnabled = useOrchestrationStore(s => s.setSentinelEnabled);
  const hitlEnabled = useOrchestrationStore(s => s.hitlEnabled);
  const setHitlEnabled = useOrchestrationStore(s => s.setHitlEnabled);
  const approvalRequest = useOrchestrationStore(s => s.approvalRequest);
  const sentinelIncidents = useOrchestrationStore(s => s.sentinelIncidents);
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
  const activeTab = tabs.find((t: TerminalTab) => t.id === activeTabId) || tabs[0];
  const agents = activeTab ? activeTab.agents : [];
  const allAgents = getUniqueAgents(tabs.flatMap((t: TerminalTab) => t.agents));
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
  }, [hitlEnabled]);

  useEffect(() => {
    sentinelEnabledRef.current = sentinelEnabled;
  }, [sentinelEnabled]);

  const addLog = useCallback((message: string, type: "system" | "handoff" = "system") => {
    setActivity(prev => {
      const newLog = { id: logIdCounter.current++, time: new Date().toLocaleTimeString(), message, type };
      return [newLog, ...prev].slice(0, 50);
    });
  }, [setActivity]);

  const {
    syncMasterPlanQueueState,
    dispatchNextMasterPlanTask,
    syncPlanTaskStatusByText,
    trackAgentPlanTask,
    popAgentPlanTask,
    handleDispatchMasterPlanTask,
    resetMasterPlanWorkflow,
  } = useMemo(() => createMasterPlanWorkflow({
    currentProjectRef,
    agentsRef,
    activeMasterPlanTask,
    queuedMasterPlanTasks,
    activeAgentPlanTasks,
    setMasterPlanQueueState,
    addLog,
  }), [currentProjectRef, agentsRef, activeMasterPlanTask, queuedMasterPlanTasks, activeAgentPlanTasks, setMasterPlanQueueState, addLog]);

  const {
    recordBrainstormResponse,
    handleStartBrainstorm,
  } = useMemo(() => createBrainstormWorkflow({
    currentProjectRef,
    brainstormSessionsRef,
    setBrainstormSessions,
    addLog,
  }), [currentProjectRef, brainstormSessionsRef, setBrainstormSessions, addLog]);

  const { writeHandoff, queueHandoff, flushQueuedHandoff } = useMemo(() => createHandoffQueueService({
    pendingHandoffs,
    readyAgents,
    setAgentQueueCounts,
  }), []);

  const crud = useWorkspaceCrud(addLog);
  const agentOps = useAgentOps(addLog, { pendingHandoffs, readyAgents, writeHandoff, queueHandoff });

  usePersistence(isDbLoaded);
  useProjectChange(currentProject, currentProjectRef, crud.refreshSnapshots, resetMasterPlanWorkflow);
  useCodeReviewStats(currentProject);
  usePortCount(isDbLoaded);
  useConfigFetcher();
  useAgentStateListener();
  useSentinel(sentinelEnabledRef, sentinelStates, addLog);
  useHandoffListeners({
    currentProjectRef,
    agentsRef,
    pendingHandoffs,
    readyAgents,
    hitlEnabledRef,
    activeMasterPlanTask,
    syncMasterPlanQueueState,
    dispatchNextMasterPlanTask,
    syncPlanTaskStatusByText,
    trackAgentPlanTask,
    popAgentPlanTask,
    recordBrainstormResponse,
    writeHandoff,
    queueHandoff,
    flushQueuedHandoff,
    addLog,
  });
  useOmnibarShortcut();

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
    handleWorkspaceSelect: crud.handleWorkspaceSelect,
    handleWorkspaceReorder: crud.handleWorkspaceReorder,
    handleWorkspaceRename: crud.handleWorkspaceRename,
    handleWorkspaceDelete: crud.handleWorkspaceDelete,
    handleCreateWorkspace: crud.handleCreateWorkspace,
    handleSectionCreate: crud.handleSectionCreate,
    handleSectionSelect: crud.handleSectionSelect,
    handleSectionRename: crud.handleSectionRename,
    handleSectionDelete: crud.handleSectionDelete,
    handleOpenDirectory: crud.handleOpenDirectory,
    handleInitialize: crud.handleInitialize,
    handleManualSnapshot: crud.handleManualSnapshot,
    handleRewindSnapshot: crud.handleRewindSnapshot,
    handleReorderAgents: agentOps.handleReorderAgents,
    handleTabCreate: crud.handleTabCreate,
    handleTabSelect: crud.handleTabSelect,
    handleTabRename: crud.handleTabRename,
    handleTabClose: crud.handleTabClose,
    handleTabReorder: crud.handleTabReorder,
    spawnAgent: agentOps.spawnAgent,
    handleOpenProjectInTerminal: agentOps.handleOpenProjectInTerminal,
    removeAgent: agentOps.removeAgent,
    detachAgent: agentOps.detachAgent,
    handleSpawnBrowser: agentOps.handleSpawnBrowser,
    handleSetLayoutOrientation: agentOps.handleSetLayoutOrientation,
    handleSplit: agentOps.handleSplit,
    handleKillAgent: agentOps.handleKillAgent,
    handleInterruptAgent: agentOps.handleInterruptAgent,
    handleInjectHint: agentOps.handleInjectHint,
    handleQuickDispatch: agentOps.handleQuickDispatch,
    handleHitlApprove: agentOps.handleHitlApprove,
    handleHitlReject: agentOps.handleHitlReject,
    handleStartBrainstorm,
    handleDispatchMasterPlanTask,
  };
}

export type AppController = ReturnType<typeof useAppController>;
