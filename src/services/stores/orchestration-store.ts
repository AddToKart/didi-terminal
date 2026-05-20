import { create } from 'zustand';
import type { ActivityLog, TaskRecord, HitlApprovalRequest } from '../app-core';
import type { SentinelIncident } from '../../components/panels/SentinelPanel';
import type { BrainstormSession } from '../../components/modals/BrainstormModal';

interface OrchestrationState {
  activity: ActivityLog[];
  setActivity: (activity: ActivityLog[] | ((prev: ActivityLog[]) => ActivityLog[])) => void;
  
  tasks: TaskRecord[];
  setTasks: (tasks: TaskRecord[] | ((prev: TaskRecord[]) => TaskRecord[])) => void;
  
  masterPlanQueueState: { activeLine: number | null; queuedLines: number[] };
  setMasterPlanQueueState: (state: { activeLine: number | null; queuedLines: number[] } | ((prev: { activeLine: number | null; queuedLines: number[] }) => { activeLine: number | null; queuedLines: number[] })) => void;
  
  sentinelEnabled: boolean;
  setSentinelEnabled: (enabled: boolean) => void;
  
  hitlEnabled: boolean;
  setHitlEnabled: (enabled: boolean) => void;
  
  approvalRequest: HitlApprovalRequest | null;
  setApprovalRequest: (request: HitlApprovalRequest | null) => void;
  
  sentinelIncidents: SentinelIncident[];
  setSentinelIncidents: (incidents: SentinelIncident[] | ((prev: SentinelIncident[]) => SentinelIncident[])) => void;
  
  brainstormSessions: BrainstormSession[];
  setBrainstormSessions: (sessions: BrainstormSession[] | ((prev: BrainstormSession[]) => BrainstormSession[])) => void;
}

export const useOrchestrationStore = create<OrchestrationState>((set) => ({
  activity: [{ id: 0, time: new Date().toLocaleTimeString(), message: "System initialized", type: "system" }],
  setActivity: (val) => set((state) => ({ activity: typeof val === 'function' ? val(state.activity) : val })),
  
  tasks: [],
  setTasks: (val) => set((state) => ({ tasks: typeof val === 'function' ? val(state.tasks) : val })),
  
  masterPlanQueueState: { activeLine: null, queuedLines: [] },
  setMasterPlanQueueState: (val) => set((state) => ({ masterPlanQueueState: typeof val === 'function' ? val(state.masterPlanQueueState) : val })),
  
  sentinelEnabled: false,
  setSentinelEnabled: (sentinelEnabled) => set({ sentinelEnabled }),
  
  hitlEnabled: false,
  setHitlEnabled: (hitlEnabled) => set({ hitlEnabled }),
  
  approvalRequest: null,
  setApprovalRequest: (approvalRequest) => set({ approvalRequest }),
  
  sentinelIncidents: [],
  setSentinelIncidents: (val) => set((state) => ({ sentinelIncidents: typeof val === 'function' ? val(state.sentinelIncidents) : val })),
  
  brainstormSessions: [],
  setBrainstormSessions: (val) => set((state) => ({ brainstormSessions: typeof val === 'function' ? val(state.brainstormSessions) : val })),
}));
