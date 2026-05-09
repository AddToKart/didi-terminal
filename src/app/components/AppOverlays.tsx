import { Suspense, type ComponentType } from "react";
import { ApprovalModal } from "../../components/ApprovalModal";
import { BrainstormModal, type BrainstormSession } from "../../components/BrainstormModal";
import { MasterPlanPanel } from "../../components/MasterPlanPanel";
import type { TaskRecord, HitlApprovalRequest, MasterPlanTaskDispatch } from "../../services/app-core";

interface AppOverlaysProps {
  showNetworkGraph: boolean;
  NetworkGraphComponent: ComponentType<{
    agents: string[];
    tasks?: TaskRecord[];
    onClose: () => void;
    onKillAgent?: (agent: string) => void;
    onInterruptAgent?: (agent: string) => void;
    onInjectHint?: (agent: string, hint: string) => void;
    onQuickDispatch?: (target: string, task: string) => void;
  }>;
  agents: string[];
  tasks: TaskRecord[];
  onCloseNetworkGraph: () => void;
  onKillAgent: (agent: string) => void;
  onInterruptAgent: (agent: string) => void;
  onInjectHint: (agent: string, hint: string) => void;
  onQuickDispatch: (target: string, task: string) => void;
  showSettings: boolean;
  SettingsModalComponent: ComponentType<{ onClose: () => void }>;
  onCloseSettings: () => void;
  showBrainstorm: boolean;
  brainstormSessions: BrainstormSession[];
  onStartBrainstorm: (prompt: string, participants: string[], turns: number) => Promise<void>;
  onCloseBrainstorm: () => void;
  showMasterPlan: boolean;
  currentProject: string | null;
  onDispatchMasterPlanTask: (task: MasterPlanTaskDispatch) => Promise<void>;
  activeTaskLine: number | null;
  queuedTaskLines: number[];
  onCloseMasterPlan: () => void;
  approvalRequest: HitlApprovalRequest | null;
  onApproveHitl: () => void;
  onRejectHitl: (feedback: string) => void;
}

export function AppOverlays({
  showNetworkGraph,
  NetworkGraphComponent,
  agents,
  tasks,
  onCloseNetworkGraph,
  onKillAgent,
  onInterruptAgent,
  onInjectHint,
  onQuickDispatch,
  showSettings,
  SettingsModalComponent,
  onCloseSettings,
  showBrainstorm,
  brainstormSessions,
  onStartBrainstorm,
  onCloseBrainstorm,
  showMasterPlan,
  currentProject,
  onDispatchMasterPlanTask,
  activeTaskLine,
  queuedTaskLines,
  onCloseMasterPlan,
  approvalRequest,
  onApproveHitl,
  onRejectHitl,
}: AppOverlaysProps) {
  return (
    <>
      {showNetworkGraph && (
        <Suspense fallback={<div className="absolute inset-0 z-50 bg-zinc-950/80" />}>
          <NetworkGraphComponent
            agents={agents}
            tasks={tasks}
            onClose={onCloseNetworkGraph}
            onKillAgent={onKillAgent}
            onInterruptAgent={onInterruptAgent}
            onInjectHint={onInjectHint}
            onQuickDispatch={onQuickDispatch}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModalComponent onClose={onCloseSettings} />
        </Suspense>
      )}

      {showBrainstorm && (
        <BrainstormModal
          agents={agents}
          sessions={brainstormSessions}
          onStart={onStartBrainstorm}
          onClose={onCloseBrainstorm}
        />
      )}

      {showMasterPlan && (
        <MasterPlanPanel
          currentProject={currentProject}
          onDispatchTask={onDispatchMasterPlanTask}
          activeTaskLine={activeTaskLine}
          queuedTaskLines={queuedTaskLines}
          onClose={onCloseMasterPlan}
        />
      )}

      {approvalRequest && (
        <ApprovalModal
          agentName={approvalRequest.agent}
          currentProject={currentProject}
          onApprove={onApproveHitl}
          onReject={onRejectHitl}
        />
      )}
    </>
  );
}
