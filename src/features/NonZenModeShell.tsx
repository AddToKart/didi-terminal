import { lazy } from "react";
import { AppOverlays } from "../components/layout/AppOverlays";
import { AppGlobalSidebar } from "../components/layout/AppGlobalSidebar";
import { AppTopbar } from "../components/layout/AppTopbar";
import { AppTerminalTabs } from "../components/layout/AppTerminalTabs";
import { AppTerminalArea } from "../components/layout/AppTerminalArea";
import { StatusBar } from "../components/layout/StatusBar";
import { CodeReviewPanel } from "../components/source-control/CodeReviewPanel";
import { GitPanel } from "../components/source-control/GitPanel";
import { SourceControlFullscreen } from "../components/source-control/SourceControlFullscreen";
import { PersonalKanban } from "../components/workspace/PersonalKanban";
import { ProjectFileExplorer } from "../components/workspace/ProjectFileExplorer";
import { SecurityPanel } from "../components/workspace/SecurityPanel";
import { PortManager } from "../components/developer-tools/PortManager";
import { EnvManager } from "../components/developer-tools/EnvManager";
import { PackageManager } from "../components/developer-tools/PackageManager";
import { ApiLab } from "../components/developer-tools/ApiLab";
import { DbViewer } from "../components/developer-tools/DbViewer";
import { TwoFactorModal } from "../components/modals/TwoFactorModal";
import type { NonZenModeShellProps } from "../types/terminal-mode.types";

const NetworkGraph = lazy(() =>
  import("../components/graphs/NetworkGraph").then(module => ({ default: module.NetworkGraph })),
);
const SettingsModal = lazy(() =>
  import("../components/modals/SettingsModal").then(module => ({ default: module.SettingsModal })),
);

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

  return (
    <>
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
      </section>

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
            onVerify={success => {
              if (success) {
                setActiveWorkspaceId(pendingWorkspaceId);
                setPendingWorkspaceId(null);
              }
            }}
            onCancel={() => setPendingWorkspaceId(null)}
          />
        )}
      </>

      {rightSidebar}
    </>
  );
}
