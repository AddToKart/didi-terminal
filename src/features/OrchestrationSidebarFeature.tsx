import { AppSidebar } from "../components/layout/AppSidebar";
import { useUIController } from "@/services/useUIController";
import { useWorkspaceController } from "@/services/useWorkspaceController";
import { useTerminalController } from "@/services/useTerminalController";
import { useOrchestrationController } from "@/services/useOrchestrationController";

export function OrchestrationSidebarFeature() {
  const ui = useUIController();
  const ws = useWorkspaceController();
  const term = useTerminalController();
  const orch = useOrchestrationController();

  const {
    appMode,
    isSidebarOpen,
    sidecarStatus,
    isTasksCollapsed,
    setIsTasksCollapsed,
    isActivityCollapsed,
    setIsActivityCollapsed,
  } = ui;

  const {
    currentProject,
    activeWorkspaceId,
    handleOpenDirectory,
    handleManualSnapshot,
    handleRewindSnapshot,
    handleInitialize,
  } = ws;

  const {
    sentinelEnabled,
    setSentinelEnabled,
    sentinelIncidents,
    hitlEnabled,
    setHitlEnabled,
    snapshots,
    snapshotBusy,
    tasks,
    activity,
  } = orch;

  const {
    agents,
    agentQueueCounts,
    removeAgent,
  } = term;

  if (!isSidebarOpen || appMode !== "orchestrator") return null;

  return (
    <AppSidebar
      sidecarStatus={sidecarStatus}
      currentProject={currentProject}
      onOpenProject={() => handleOpenDirectory(activeWorkspaceId)}
      onInitialize={handleInitialize}
      sentinelEnabled={sentinelEnabled}
      sentinelIncidents={sentinelIncidents}
      onToggleSentinel={() => setSentinelEnabled(!sentinelEnabled)}
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
  );
}
