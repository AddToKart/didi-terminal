import { useOrchestrationStore } from "./stores/orchestration-store";
import { useGitStore } from "./stores/git-store";
import { masterPlanWorkflow, brainstormWorkflow } from "./workflows";

export function useOrchestrationController() {
  const activity = useOrchestrationStore((s) => s.activity);
  const setActivity = useOrchestrationStore((s) => s.setActivity);
  const tasks = useOrchestrationStore((s) => s.tasks);
  const masterPlanQueueState = useOrchestrationStore((s) => s.masterPlanQueueState);
  const setMasterPlanQueueState = useOrchestrationStore((s) => s.setMasterPlanQueueState);
  const sentinelEnabled = useOrchestrationStore((s) => s.sentinelEnabled);
  const setSentinelEnabled = useOrchestrationStore((s) => s.setSentinelEnabled);
  const hitlEnabled = useOrchestrationStore((s) => s.hitlEnabled);
  const setHitlEnabled = useOrchestrationStore((s) => s.setHitlEnabled);
  const approvalRequest = useOrchestrationStore((s) => s.approvalRequest);
  const sentinelIncidents = useOrchestrationStore((s) => s.sentinelIncidents);
  const brainstormSessions = useOrchestrationStore((s) => s.brainstormSessions);
  const setBrainstormSessions = useOrchestrationStore((s) => s.setBrainstormSessions);

  const snapshots = useGitStore((s) => s.snapshots);
  const snapshotBusy = useGitStore((s) => s.snapshotBusy);

  return {
    activity,
    setActivity,
    tasks,
    masterPlanQueueState,
    setMasterPlanQueueState,
    sentinelEnabled,
    setSentinelEnabled,
    hitlEnabled,
    setHitlEnabled,
    approvalRequest,
    sentinelIncidents,
    brainstormSessions,
    setBrainstormSessions,
    snapshots,
    snapshotBusy,
    handleStartBrainstorm: brainstormWorkflow.handleStartBrainstorm,
    handleDispatchMasterPlanTask: masterPlanWorkflow.handleDispatchMasterPlanTask,
  };
}
