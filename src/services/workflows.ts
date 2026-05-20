import { createMasterPlanWorkflow } from "../workflows/master-plan-workflow";
import { createBrainstormWorkflow } from "../workflows/brainstorm-workflow";
import { useOrchestrationStore } from "./stores/orchestration-store";
import { addLog } from "./logger";
import {
  currentProjectRef,
  agentsRef,
  activeMasterPlanTask,
  queuedMasterPlanTasks,
  activeAgentPlanTasks,
  brainstormSessionsRef,
} from "./singletons";

export const masterPlanWorkflow = createMasterPlanWorkflow({
  currentProjectRef,
  agentsRef,
  activeMasterPlanTask,
  queuedMasterPlanTasks,
  activeAgentPlanTasks,
  setMasterPlanQueueState: (val) => useOrchestrationStore.getState().setMasterPlanQueueState(val),
  addLog,
});

export const brainstormWorkflow = createBrainstormWorkflow({
  currentProjectRef,
  brainstormSessionsRef,
  setBrainstormSessions: (val) => useOrchestrationStore.getState().setBrainstormSessions(val),
  addLog,
});
