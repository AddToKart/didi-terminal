import { AppSidebar } from "../components/layout/AppSidebar";
import type { OrchestrationModeProps } from "../types/orchestration-mode.types";

export function OrchestrationSidebarFeature({ controller }: OrchestrationModeProps) {
  const {
    appMode,
    isSidebarOpen,
    sidecarStatus,
    currentProject,
    sentinelEnabled,
    setSentinelEnabled,
    sentinelIncidents,
    hitlEnabled,
    setHitlEnabled,
    agents,
    agentQueueCounts,
    removeAgent,
    snapshots,
    snapshotBusy,
    handleManualSnapshot,
    handleRewindSnapshot,
    isTasksCollapsed,
    setIsTasksCollapsed,
    tasks,
    isActivityCollapsed,
    setIsActivityCollapsed,
    activity,
    activeWorkspaceId,
    handleOpenDirectory,
    handleInitialize,
  } = controller;

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
