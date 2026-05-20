import { lazy, useMemo, useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getSplitAgentNameInTab, getUniqueAgentNameInTab } from "@/services/agent-naming";
import { saveWorkspaces } from "@/services/db-service";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadStoredTerminalLanes,
} from "@/services/terminal-lanes";
import { useGitStore } from "@/services/stores/git-store";
import { useWorkspaceStore } from "@/services/stores/workspace-store";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Terminal as TerminalIcon, Network, Monitor, Settings, Code2, GitBranch, LayoutList, FolderSearch, FileKey2, Package, Zap, FolderTree, Server, Database, FileText, FileCode, Palette, Plus, Globe, Shield, Brain, ClipboardList, Box, HardDrive, Columns2, Container } from "lucide-react";
import { AppOverlays } from "../components/layout/AppOverlays";
import { AppGlobalSidebar } from "../components/layout/AppGlobalSidebar";
import { AppTopbar } from "../components/layout/AppTopbar";
import { AppTerminalTabs, TERMINAL_DROP_ID } from "../components/layout/AppTerminalTabs";
import { AppTerminalWorkspace } from "../components/layout/AppTerminalWorkspace";
import { Omnibar, type PaletteAction } from "../components/modals/Omnibar";
import { NonZenModePanels } from "./NonZenModePanels";
import type { NonZenModeShellProps } from "../types/terminal-mode.types";
import {
  getMergedTabPairForTab,
  mergeTabPair,
  pruneMergedTabPairs,
  unmergeTabPair,
} from "@/lib/merged-tabs";
import type { MergedTabPair, TerminalLayoutOrientation } from "@/types/workspace";

function TerminalDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: TERMINAL_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className="absolute inset-0 z-50 pointer-events-none"
    >
      {isOver && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-[96%] h-[96%] border-2 border-dashed border-indigo-500/60 bg-indigo-500/8 rounded-xl flex items-center justify-center">
            <div className="bg-zinc-900/90 border border-indigo-500/40 rounded-xl px-8 py-4 flex flex-col items-center gap-2 shadow-2xl">
              <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold">
                <Columns2 size={14} />
                Drop to Merge Tab
              </div>
              <div className="text-zinc-500 text-xs">Release here to split view side by side</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const NetworkGraph = lazy(() => import("../components/graphs/NetworkGraph").then(m => ({ default: m.NetworkGraph })));
const SettingsModal = lazy(() => import("../components/modals/SettingsModal").then(m => ({ default: m.SettingsModal })));

export function NonZenModeShell({ controller, rightSidebar }: NonZenModeShellProps) {
  const {
    appMode,
    setAppMode,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    currentProject,
    tabs,
    activeTabId,
    agents,
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
    showCodeReview,
    setShowCodeReview,
    showGitPanel,
    setShowGitPanel,
    showPersonalKanban,
    setShowPersonalKanban,
    showCalendar,
    setShowCalendar,
    showFileExplorer,
    setShowFileExplorer,
    setShowPortManager,
    setShowDockerManager,
    showEnvManager,
    setShowEnvManager,
    showPackageManager,
    setShowPackageManager,
    showApiLab,
    setShowApiLab,
    showMonorepoGraph,
    setShowMonorepoGraph,
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
    setShowMockDataGenerator,
    showOmnibar,
    setShowOmnibar,
    setShowSecurityPanel,
    tasks,
    agentStatusMap,
    masterPlanQueueState,
    brainstormSessions,
    isGlass,
    approvalRequest,
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
    handleTabCreate,
    handleTabSelect,
    handleTabRename,
    handleTabClose,
    handleTabReorder,
    spawnAgent,
    handleOpenProjectInTerminal,
    handleSpawnBrowser,
    handleSetLayoutOrientation,
    handleKillAgent,
    handleInterruptAgent,
    handleInjectHint,
    handleQuickDispatch,
    handleHitlApprove,
    handleHitlReject,
    handleStartBrainstorm,
    handleDispatchMasterPlanTask,
  } = controller;

  const codeReviewStats = useGitStore(s => s.codeReviewStats);

  const handleSpawnAgentWithShell = useCallback((shellCommand: string, shellName: string) => {
    spawnAgent(undefined, shellName, shellCommand);
  }, [spawnAgent]);

  const setWorkspaces = useWorkspaceStore(s => s.setWorkspaces);
  const topbarMode = appMode === "orchestrator" ? "orchestrator" : "terminal";
  const activeSection = activeWorkspace?.sections.find(s => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const mergePairs = activeSection?.mergedTabPairs ?? (activeSection?.mergedTabPair ? [activeSection.mergedTabPair] : []);
  const activeMergePair = getMergedTabPairForTab(activeTabId, mergePairs);

  // Merge state
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const setMergePairs = useCallback((resolveNextPairs: (currentPairs: MergedTabPair[]) => MergedTabPair[]) => {
    setWorkspaces(prev => {
      const next = prev.map(workspace => {
        if (workspace.id !== activeWorkspaceId) return workspace;
        const targetSectionId = workspace.activeSectionId || workspace.sections[0]?.id;
        const sections = workspace.sections.map(section => {
          if (section.id !== targetSectionId) return section;

          const currentPairs = section.mergedTabPairs ?? (section.mergedTabPair ? [section.mergedTabPair] : []);
          return {
            ...section,
            mergedTabPairs: resolveNextPairs(currentPairs),
            mergedTabPair: null,
          };
        });
        return { ...workspace, sections };
      });
      saveWorkspaces(next).catch(error => console.error("[didi] Failed to save merged tab state:", error));
      return next;
    });
  }, [activeWorkspaceId, setWorkspaces]);

  const handleUnmerge = useCallback((tabId: string) => {
    setMergePairs(currentPairs => unmergeTabPair(currentPairs, tabId));
  }, [setMergePairs]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "tab") {
      setDraggedTabId(event.active.id as string);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTabId(null);

    const activeData = active.data.current;
    if (activeData?.type !== "tab") return;

    const draggedId = active.id as string;

    if (over?.id === TERMINAL_DROP_ID) {
      if (draggedId !== activeTabId) {
        setMergePairs(currentPairs => mergeTabPair(currentPairs, activeTabId, draggedId));
      }
      return;
    }

    if (over) {
      const overData = over.data.current;
      if (overData?.type === "tab") {
        const oldIndex = tabs.findIndex((t) => t.id === active.id);
        const newIndex = tabs.findIndex((t) => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          handleTabReorder(oldIndex, newIndex);
        }
      }
    }
  }, [activeTabId, tabs, handleTabReorder, setMergePairs]);

  useEffect(() => {
    if (mergePairs.length === 0) return;
    const nextPairs = pruneMergedTabPairs(mergePairs, tabs);
    const hasChanged = nextPairs.length !== mergePairs.length ||
      nextPairs.some((pair, index) => pair[0] !== mergePairs[index]?.[0] || pair[1] !== mergePairs[index]?.[1]);

    if (hasChanged) {
      setMergePairs(() => nextPairs);
    }
  }, [mergePairs, setMergePairs, tabs]);

  const mergedPrimaryTab = activeMergePair ? tabs.find(t => t.id === activeMergePair[0]) : null;
  const mergedSecondaryTab = activeMergePair ? tabs.find(t => t.id === activeMergePair[1]) : null;
  const showMergedView = !!mergedPrimaryTab && !!mergedSecondaryTab;

  const draggedTab = tabs.find(t => t.id === draggedTabId);

  // ── Tab-specific callbacks for merged view ───────────────────────────────
  const handleRemoveAgentForTab = useCallback((tabId: string, agentId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || !tab.agents.some(agent => agent.id === agentId)) return;

    const storedLanes = loadStoredTerminalLanes(agentId, activeWorkspaceId) ?? [];
    for (const lane of storedLanes) {
      if (lane.id === ROOT_TERMINAL_LANE_ID) continue;
      invoke("close_pty", { agent: getTerminalLanePtyKey(activeWorkspaceId, lane.agentName) }).catch(console.error);
    }

    const agentKey = getTerminalLanePtyKey(activeWorkspaceId, agentId);
    clearTerminalLanes(agentId, activeWorkspaceId);
    invoke("close_pty", { agent: agentKey }).catch(console.error);
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return { ...s, tabs: s.tabs.map(t => t.id === tabId ? { ...t, agents: t.agents.filter((a: { id: string }) => a.id !== agentId) } : t) };
      });
      return { ...w, sections };
    }));
  }, [activeWorkspaceId, setWorkspaces, tabs]);

  const handleDetachAgentForTab = useCallback((tabId: string, agentId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return { ...s, tabs: s.tabs.map(t => t.id === tabId ? { ...t, agents: t.agents.filter((a: { id: string }) => a.id !== agentId) } : t) };
      });
      return { ...w, sections };
    }));
  }, [activeWorkspaceId, setWorkspaces]);

  const handleReorderAgentsForTab = useCallback((tabId: string, oldIndex: number, newIndex: number) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return { ...s, tabs: s.tabs.map(t => {
          if (t.id !== tabId) return t;
          const newAgents = [...t.agents];
          const [moved] = newAgents.splice(oldIndex, 1);
          newAgents.splice(newIndex, 0, moved);
          return { ...t, agents: newAgents };
        }) };
      });
      return { ...w, sections };
    }));
  }, [activeWorkspaceId, setWorkspaces]);

  const handleSetLayoutForTab = useCallback((tabId: string, orientation: TerminalLayoutOrientation) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return {
          ...s,
          activeTabId: tabId,
          tabs: s.tabs.map(t => t.id === tabId ? { ...t, layoutOrientation: orientation } : t),
        };
      });
      return { ...w, sections, activeTabId: tabId };
    }));
  }, [activeWorkspaceId, setWorkspaces]);

  const handleSplitForTab = useCallback((tabId: string, agentToSplitId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const agentToSplit = tab.agents.find(a => a.id === agentToSplitId)?.name || "Split Agent";
    const newName = getSplitAgentNameInTab(tab.agents, agentToSplit);
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return { ...s, tabs: s.tabs.map(t => {
          if (t.id !== tabId) return t;
          const index = t.agents.findIndex((a: { id: string }) => a.id === agentToSplitId);
          const newAgent = { id: crypto.randomUUID(), name: newName };
          if (index === -1) return { ...t, agents: [...t.agents, newAgent] };
          const newAgents = [...t.agents];
          newAgents.splice(index + 1, 0, newAgent);
          return { ...t, agents: newAgents };
        }) };
      });
      return { ...w, sections };
    }));
  }, [activeWorkspaceId, setWorkspaces, tabs]);

  const handleAddAgentToTab = useCallback((tabId: string) => {
    const targetTab = tabs.find(tab => tab.id === tabId);
    if (!targetTab) return;

    const name = getUniqueAgentNameInTab(targetTab.agents, newAgentName);
    const newAgent = { id: crypto.randomUUID(), name };
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const sections = w.sections.map(s => {
        if (s.id !== (w.activeSectionId || w.sections[0]?.id)) return s;
        return { ...s, tabs: s.tabs.map(t => t.id === tabId ? { ...t, agents: [...t.agents, newAgent] } : t) };
      });
      return { ...w, sections, activeTabId: tabId };
    }));
    setNewAgentName("");
    handleTabSelect(tabId);
  }, [activeWorkspaceId, handleTabSelect, newAgentName, setNewAgentName, setWorkspaces, tabs]);

  const paletteActions = useMemo<PaletteAction[]>(() => {
    const actions: PaletteAction[] = [
      { id: "terminal-mode", label: "Terminal Mode", description: "Switch to standard terminal layout", category: "Modes", categoryOrder: 0, icon: TerminalIcon, onSelect: () => setAppMode("terminal") },
      { id: "orchestrator-mode", label: "Orchestrator Mode", description: "Switch to agent orchestration layout", category: "Modes", categoryOrder: 0, icon: Network, onSelect: () => setAppMode("orchestrator") },
      { id: "zen-mode", label: "Zen Mode", description: "Switch to minimal Zen layout", category: "Modes", categoryOrder: 0, icon: Monitor, shortcut: "Alt+Q", onSelect: () => setAppMode("zen") },
      { id: "settings", label: "Settings", description: "Configure app preferences", category: "Panels", categoryOrder: 1, icon: Settings, onSelect: () => setShowSettings(true) },
      { id: "code-review", label: "Code Review", description: "Review staged changes", category: "Panels", categoryOrder: 1, icon: Code2, onSelect: () => setShowCodeReview(true) },
      { id: "git-panel", label: "Git Panel", description: "Stage, commit, push, pull", category: "Panels", categoryOrder: 1, icon: GitBranch, onSelect: () => setShowGitPanel(true) },
      { id: "kanban", label: "My Tasks", description: "Personal kanban board", category: "Panels", categoryOrder: 1, icon: LayoutList, onSelect: () => setShowPersonalKanban(true) },
      { id: "file-explorer", label: "Project Explorer", description: "Browse workspace files", category: "Panels", categoryOrder: 1, icon: FolderSearch, onSelect: () => setShowFileExplorer(true) },
      { id: "env-manager", label: "Environment Variables", description: "Manage .env files", category: "Panels", categoryOrder: 1, icon: FileKey2, onSelect: () => setShowEnvManager(true) },
      { id: "package-manager", label: "Package Manager", description: "Update npm/cargo/pip packages", category: "Panels", categoryOrder: 1, icon: Package, onSelect: () => setShowPackageManager(true) },
      { id: "api-lab", label: "API Lab", description: "Test HTTP requests", category: "Panels", categoryOrder: 1, icon: Zap, onSelect: () => setShowApiLab(true) },
      { id: "dep-graph", label: "Dependency Graph", description: "Visualize monorepo dependencies", category: "Panels", categoryOrder: 1, icon: FolderTree, onSelect: () => setShowMonorepoGraph(true) },
      { id: "port-manager", label: "Port Manager", description: "View and kill active ports", category: "Panels", categoryOrder: 1, icon: Server, onSelect: () => setShowPortManager(true) },
      { id: "docker-manager", label: "Docker Hub", description: "Monitor WSL and local Docker containers", category: "Panels", categoryOrder: 1, icon: Container, onSelect: () => setShowDockerManager(true) },
      { id: "db-viewer", label: "Database Viewer", description: "Browse SQLite, Postgres, MySQL", category: "Panels", categoryOrder: 1, icon: Database, onSelect: () => setShowDbViewer(true) },
      { id: "icon-browser", label: "Icon Browser", description: "Browse and copy lucide-react icons", category: "Panels", categoryOrder: 1, icon: Palette, onSelect: () => setShowIconBrowser(true) },
      { id: "tailwind-labs", label: "Tailwind Labs", description: "Colors, utility classes, spacing reference", category: "Panels", categoryOrder: 1, icon: Palette, onSelect: () => setShowTailwindLabs(true) },
      { id: "npm-lookup", label: "npm Lookup", description: "Search npm package registry", category: "Panels", categoryOrder: 1, icon: Box, onSelect: () => setShowNpmLookup(true) },
      { id: "html-to-jsx", label: "HTML to JSX", description: "Convert HTML to React JSX", category: "Panels", categoryOrder: 1, icon: Code2, onSelect: () => setShowHtmlToJsx(true) },
      { id: "svg-optimizer", label: "SVG Optimizer", description: "Clean and minify SVGs", category: "Panels", categoryOrder: 1, icon: FileCode, onSelect: () => setShowSvgOptimizer(true) },
      { id: "storage-inspector", label: "Storage Inspector", description: "Browse localStorage and cookies", category: "Panels", categoryOrder: 1, icon: HardDrive, onSelect: () => setShowStorageInspector(true) },
      { id: "mock-data-generator", label: "Mock Data Generator", description: "Generate JSON, CSV, or SQL placeholder data", category: "Panels", categoryOrder: 1, icon: Database, onSelect: () => setShowMockDataGenerator(true) },
      { id: "config-editor", label: "Config Editor", description: "Edit JSON config files in tree view", category: "Panels", categoryOrder: 1, icon: FileCode, onSelect: () => setShowConfigEditor(true) },
      { id: "md-viewer", label: "Markdown Viewer", description: "Browse and edit markdown files", category: "Panels", categoryOrder: 1, icon: FileText, onSelect: () => setShowMdViewer(true) },
      { id: "new-tab", label: "New Tab", description: "Create a new terminal tab", category: "Actions", categoryOrder: 2, icon: Plus, onSelect: () => handleTabCreate() },
      { id: "new-browser", label: "New Browser Pane", description: "Open an embedded webview", category: "Actions", categoryOrder: 2, icon: Globe, onSelect: () => handleSpawnBrowser() },
      { id: "security", label: "Workspace Lock", description: "Set or change workspace PIN", category: "Actions", categoryOrder: 2, icon: Shield, onSelect: () => setShowSecurityPanel(activeWorkspaceId) },
      { id: "network-graph", label: "Orchestration Graph", description: "Visual agent network", category: "Panels", categoryOrder: 1, icon: Network, onSelect: () => setShowNetworkGraph(true) },
      { id: "brainstorm", label: "Brainstorm", description: "Multi-agent consensus", category: "Panels", categoryOrder: 1, icon: Brain, onSelect: () => setShowBrainstorm(true) },
      { id: "master-plan", label: "Master Plan", description: "Task queue and progress", category: "Panels", categoryOrder: 1, icon: ClipboardList, onSelect: () => setShowMasterPlan(true) },
    ];

    workspaces.forEach(ws => {
      actions.push({
        id: `ws-${ws.id}`,
        label: `Workspace: ${ws.name}`,
        description: `Switch to workspace`,
        category: "Workspaces",
        categoryOrder: 3,
        icon: FolderSearch,
        onSelect: () => handleWorkspaceSelect(ws.id)
      });
      ws.sections.forEach(sec => {
        sec.tabs.forEach(tab => {
          actions.push({
            id: `tab-${tab.id}`,
            label: `Go to ${tab.name}`,
            description: `Tab in ${ws.name} > ${sec.name}`,
            category: "Open Tabs",
            categoryOrder: 4,
            icon: TerminalIcon,
            onSelect: () => {
              handleWorkspaceSelect(ws.id);
              handleTabSelect(tab.id);
            }
          });
        });
      });
    });

    return actions;
  }, [appMode, activeWorkspaceId, workspaces, setAppMode, setShowSettings, setShowCodeReview, setShowGitPanel, setShowPersonalKanban, setShowCalendar, setShowFileExplorer, setShowEnvManager, setShowPackageManager, setShowApiLab, setShowMonorepoGraph, setShowPortManager, setShowDockerManager, setShowDbViewer, setShowIconBrowser, setShowTailwindLabs, setShowNpmLookup, setShowHtmlToJsx, setShowSvgOptimizer, setShowStorageInspector, setShowMockDataGenerator, setShowConfigEditor, setShowMdViewer, handleTabCreate, handleSpawnBrowser, setShowSecurityPanel, setShowNetworkGraph, setShowBrainstorm, setShowMasterPlan, handleWorkspaceSelect, handleTabSelect]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <>
        <div className="flex flex-col h-full w-full">
          <AppTopbar
            appMode={topbarMode}
            onSpawnAgent={spawnAgent}
            onSpawnAgentWithShell={handleSpawnAgentWithShell}
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
            onToggleCalendar={() => setShowCalendar(!showCalendar)}
            onToggleFileExplorer={() => setShowFileExplorer(!showFileExplorer)}
            onToggleEnvManager={() => setShowEnvManager(!showEnvManager)}
            onTogglePackageManager={() => setShowPackageManager(!showPackageManager)}
            onToggleApiLab={() => setShowApiLab(!showApiLab)}
            onToggleMonorepoGraph={() => setShowMonorepoGraph(!showMonorepoGraph)}
            onToggleMdViewer={() => setShowMdViewer(!showMdViewer)}
            onToggleConfigEditor={() => setShowConfigEditor(!showConfigEditor)}
            onToggleIconBrowser={() => setShowIconBrowser(!showIconBrowser)}
            onToggleTailwindLabs={() => setShowTailwindLabs(!showTailwindLabs)}
            onToggleNpmLookup={() => setShowNpmLookup(!showNpmLookup)}
            onToggleHtmlToJsx={() => setShowHtmlToJsx(!showHtmlToJsx)}
            onToggleSvgOptimizer={() => setShowSvgOptimizer(!showSvgOptimizer)}
            onToggleStorageInspector={() => setShowStorageInspector(!showStorageInspector)}
            currentProject={currentProject}
          />
          <div className="flex flex-1 min-h-0 relative">
            {isSidebarOpen && (
              <AppGlobalSidebar
                appMode={appMode}
                onSetAppMode={setAppMode}
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                activeSectionId={activeWorkspace?.activeSectionId || ""}
                onWorkspaceSelect={handleWorkspaceSelect}
                onCreateWorkspace={handleCreateWorkspace}
                onOpenDirectory={handleOpenDirectory}
                onOpenSettings={() => setShowSettings(true)}
                onWorkspaceReorder={handleWorkspaceReorder}
                onWorkspaceRename={handleWorkspaceRename}
                onWorkspaceDelete={handleWorkspaceDelete}
                onOpenSecurity={id => setShowSecurityPanel(id)}
                onSectionCreate={handleSectionCreate}
                onSectionRename={handleSectionRename}
                onSectionDelete={handleSectionDelete}
                onSectionSelect={handleSectionSelect}
                tasks={tasks}
                agentReadyStates={agentStatusMap}
              />
            )}

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

            <section className="flex-1 flex flex-col min-w-0 relative">
              <AppTerminalTabs
                tabs={tabs}
                activeTabId={activeTabId}
                onTabSelect={handleTabSelect}
                onTabClose={handleTabClose}
                onTabCreate={handleTabCreate}
                onTabRename={handleTabRename}
                mergedTabPairs={mergePairs}
                onUnmerge={handleUnmerge}
              />

              <div className="flex flex-1 min-h-0 relative">
                <TerminalDropZone />

                <AppTerminalWorkspace
                  tabs={tabs}
                  activeTabId={activeTabId}
                  mergedTabPair={showMergedView ? activeMergePair : null}
                  currentProject={currentProject}
                  workspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name}
                  workspaceId={activeWorkspaceId}
                  isGlass={isGlass}
                  onActivateTab={handleTabSelect}
                  onAddAgentToTab={handleAddAgentToTab}
                  onSetLayoutForTab={handleSetLayoutForTab}
                  onRemoveAgentForTab={handleRemoveAgentForTab}
                  onDetachAgentForTab={handleDetachAgentForTab}
                  onReorderAgentsForTab={handleReorderAgentsForTab}
                  onSplitForTab={handleSplitForTab}
                  onOpenDirectory={() => handleOpenDirectory(activeWorkspaceId)}
                  onUnmerge={handleUnmerge}
                />
              </div>

            </section>
          </div>
          <NonZenModePanels
            currentProject={currentProject}
            controller={controller}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {draggedTab ? (
            <div className="flex items-center gap-1 px-3 h-8 bg-app-panel text-white shadow-2xl border border-app-border ring-1 ring-brand-accent/50 rounded-md">
              <span className="text-xs font-bold truncate">{draggedTab.name}</span>
            </div>
          ) : null}
        </DragOverlay>

        <Omnibar
          isOpen={showOmnibar}
          onClose={() => setShowOmnibar(false)}
          actions={paletteActions}
        />
        {rightSidebar}
      </>
    </DndContext>
  );
}
