import { lazy, Suspense, useMemo, type ReactNode } from "react";

function ModalBoundary({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <ErrorBoundary title={title || "Panel crashed"}>
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}
import { Terminal as TerminalIcon, Network, Monitor, Settings, Code2, GitBranch, LayoutList, FolderSearch, FileKey2, Package, Zap, FolderTree, Server, Database, FileText, FileCode, Palette, Plus, Globe, Shield, Brain, ClipboardList, Box, HardDrive } from "lucide-react";
import { AppOverlays } from "../components/layout/AppOverlays";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { AppGlobalSidebar } from "../components/layout/AppGlobalSidebar";
import { AppTopbar } from "../components/layout/AppTopbar";
import { AppTerminalTabs } from "../components/layout/AppTerminalTabs";
import { AppTerminalArea } from "../components/layout/AppTerminalArea";
import { StatusBar } from "../components/layout/StatusBar";
import { TwoFactorModal } from "../components/modals/TwoFactorModal";
import { QuickPalette, type PaletteAction } from "../components/modals/QuickPalette";
import type { NonZenModeShellProps } from "../types/terminal-mode.types";

// Lazy-loaded modals & panels
const CodeReviewPanel = lazy(() => import("../components/source-control/CodeReviewPanel").then(m => ({ default: m.CodeReviewPanel })));
const GitPanel = lazy(() => import("../components/source-control/GitPanel").then(m => ({ default: m.GitPanel })));
const SourceControlFullscreen = lazy(() => import("../components/source-control/SourceControlFullscreen").then(m => ({ default: m.SourceControlFullscreen })));
const PersonalKanban = lazy(() => import("../components/workspace/PersonalKanban").then(m => ({ default: m.PersonalKanban })));
const ProjectFileExplorer = lazy(() => import("../components/workspace/ProjectFileExplorer").then(m => ({ default: m.ProjectFileExplorer })));
const SecurityPanel = lazy(() => import("../components/workspace/SecurityPanel").then(m => ({ default: m.SecurityPanel })));
const PortManager = lazy(() => import("../components/developer-tools/PortManager").then(m => ({ default: m.PortManager })));
const EnvManager = lazy(() => import("../components/developer-tools/EnvManager").then(m => ({ default: m.EnvManager })));
const PackageManager = lazy(() => import("../components/developer-tools/PackageManager").then(m => ({ default: m.PackageManager })));
const ApiLab = lazy(() => import("../components/developer-tools/ApiLab").then(m => ({ default: m.ApiLab })));
const DbViewer = lazy(() => import("../components/developer-tools/DbViewer").then(m => ({ default: m.DbViewer })));
const MdViewer = lazy(() => import("../components/developer-tools/MdViewer").then(m => ({ default: m.MdViewer })));
const ConfigEditor = lazy(() => import("../components/developer-tools/ConfigEditor").then(m => ({ default: m.ConfigEditor })));
const IconBrowser = lazy(() => import("../components/developer-tools/IconBrowser").then(m => ({ default: m.IconBrowser })));
const TailwindLabs = lazy(() => import("../components/developer-tools/TailwindLabs").then(m => ({ default: m.TailwindLabs })));
const NpmLookup = lazy(() => import("../components/developer-tools/NpmLookup").then(m => ({ default: m.NpmLookup })));
const HtmlToJsx = lazy(() => import("../components/developer-tools/HtmlToJsx").then(m => ({ default: m.HtmlToJsx })));
const SvgOptimizer = lazy(() => import("../components/developer-tools/SvgOptimizer").then(m => ({ default: m.SvgOptimizer })));
const StorageInspector = lazy(() => import("../components/developer-tools/StorageInspector").then(m => ({ default: m.StorageInspector })));
const MockDataGenerator = lazy(() => import("../components/developer-tools/MockDataGenerator").then(m => ({ default: m.MockDataGenerator })));
const NetworkGraph = lazy(() => import("../components/graphs/NetworkGraph").then(m => ({ default: m.NetworkGraph })));
const SettingsModal = lazy(() => import("../components/modals/SettingsModal").then(m => ({ default: m.SettingsModal })));

export function NonZenModeShell({ controller, rightSidebar }: NonZenModeShellProps) {
  const {
    appMode,
    setAppMode,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
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
    tasks,
    agentStatusMap,
    masterPlanQueueState,
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
    approvalRequest,
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
  } = controller;
  const topbarMode = appMode === "orchestrator" ? "orchestrator" : "terminal";

  const paletteActions = useMemo<PaletteAction[]>(() => [
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
  ], [appMode, activeWorkspaceId]);

  return (
    <>
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
          onCloseSidebar={() => setIsSidebarOpen(false)}
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

      <section className="flex-1 flex flex-col min-w-0">
        <AppTopbar
          appMode={topbarMode}
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

        <AppTerminalTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onTabCreate={handleTabCreate}
          onTabRename={handleTabRename}
          onTabReorder={handleTabReorder}
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
          workspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name}
          workspaceId={activeWorkspaceId}
          isGlass={isGlass}
        />

        {(showCodeReview || showGitPanel || showPersonalKanban || showFileExplorer) && (
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

        <>
          <ModalBoundary><CodeReviewPanel
            currentProject={currentProject}
            isOpen={showCodeReview}
            onClose={() => setShowCodeReview(false)}
            onStatsUpdate={setCodeReviewStats}
          /></ModalBoundary>
          <ModalBoundary><GitPanel
            currentProject={currentProject}
            isOpen={showGitPanel}
            onClose={() => setShowGitPanel(false)}
            onOpenFullscreen={() => {
              setShowGitPanel(false);
              setShowGitFullscreen(true);
            }}
          /></ModalBoundary>
          <ModalBoundary><SourceControlFullscreen
            currentProject={currentProject}
            isOpen={showGitFullscreen}
            onClose={() => setShowGitFullscreen(false)}
          /></ModalBoundary>
          <ModalBoundary><PersonalKanban
            workspaceId={activeWorkspaceId}
            isOpen={showPersonalKanban}
            onClose={() => setShowPersonalKanban(false)}
          /></ModalBoundary>
          <ModalBoundary><ProjectFileExplorer
            currentProject={currentProject}
            isOpen={showFileExplorer}
            onClose={() => setShowFileExplorer(false)}
          /></ModalBoundary>
          <StatusBar
            portCount={portCount}
            onOpenPortManager={() => setShowPortManager(true)}
            onOpenDbViewer={() => setShowDbViewer(true)}
          />
        </>
      </section>

      <>
        <ModalBoundary><PortManager
          isOpen={showPortManager}
          onClose={() => setShowPortManager(false)}
          onPortsUpdate={setPortCount}
        /></ModalBoundary>
        <ModalBoundary><EnvManager
          currentProject={currentProject}
          isOpen={showEnvManager}
          onClose={() => setShowEnvManager(false)}
        /></ModalBoundary>
        <ModalBoundary><PackageManager
          currentProject={currentProject}
          isOpen={showPackageManager}
          onClose={() => setShowPackageManager(false)}
        /></ModalBoundary>
        <ModalBoundary><ApiLab
          isOpen={showApiLab}
          onClose={() => setShowApiLab(false)}
        /></ModalBoundary>
        <ModalBoundary><DbViewer
          isOpen={showDbViewer}
          onClose={() => setShowDbViewer(false)}
        /></ModalBoundary>
        <ModalBoundary><MdViewer
          currentProject={currentProject}
          isOpen={showMdViewer}
          onClose={() => setShowMdViewer(false)}
        /></ModalBoundary>
        <ModalBoundary><ConfigEditor
          currentProject={currentProject}
          isOpen={showConfigEditor}
          onClose={() => setShowConfigEditor(false)}
        /></ModalBoundary>
        <ModalBoundary><IconBrowser
          isOpen={showIconBrowser}
          onClose={() => setShowIconBrowser(false)}
        /></ModalBoundary>
        <ModalBoundary><TailwindLabs
          isOpen={showTailwindLabs}
          onClose={() => setShowTailwindLabs(false)}
        /></ModalBoundary>
        <ModalBoundary><NpmLookup
          isOpen={showNpmLookup}
          onClose={() => setShowNpmLookup(false)}
        /></ModalBoundary>
        <ModalBoundary><HtmlToJsx
          isOpen={showHtmlToJsx}
          onClose={() => setShowHtmlToJsx(false)}
        /></ModalBoundary>
        <ModalBoundary><SvgOptimizer
          isOpen={showSvgOptimizer}
          onClose={() => setShowSvgOptimizer(false)}
        /></ModalBoundary>
        <ModalBoundary><StorageInspector
          isOpen={showStorageInspector}
          onClose={() => setShowStorageInspector(false)}
        /></ModalBoundary>
        <ModalBoundary><MockDataGenerator
          isOpen={showMockDataGenerator}
          onClose={() => setShowMockDataGenerator(false)}
        /></ModalBoundary>
        {showSecurityPanel && (
          <ModalBoundary title="Panel crashed"><SecurityPanel
            workspaceId={showSecurityPanel}
            workspaceName={workspaces.find(w => w.id === showSecurityPanel)?.name || ""}
            isOpen={!!showSecurityPanel}
            onClose={() => setShowSecurityPanel(null)}
          /></ModalBoundary>
        )}
        {pendingWorkspaceId && (
          <ModalBoundary title="Panel crashed"><TwoFactorModal
            isOpen={!!pendingWorkspaceId}
            workspaceId={pendingWorkspaceId}
            workspaceName={workspaces.find(w => w.id === pendingWorkspaceId)?.name || ""}
            onVerify={success => {
              if (success) {
                setActiveWorkspaceId(pendingWorkspaceId);
                setPendingWorkspaceId(null);
              }
            }}
            onCancel={() => setPendingWorkspaceId(null)}
          /></ModalBoundary>
        )}
      </>

        <QuickPalette
          isOpen={showQuickPalette}
          onClose={() => setShowQuickPalette(false)}
          actions={paletteActions}
        />
      {rightSidebar}
    </>
  );
}
