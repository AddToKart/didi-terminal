import { create } from 'zustand';
import type { ZenLayoutOrientation } from '../../types/workspace';

interface AgentState {
  newAgentName: string;
  setNewAgentName: (name: string) => void;
  
  agentQueueCounts: Record<string, number>;
  setAgentQueueCounts: (counts: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  
  agentStatusMap: Record<string, boolean>;
  setAgentStatusMap: (map: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  
  zenAgents: string[];
  setZenAgents: (agents: string[] | ((prev: string[]) => string[])) => void;
  
  zenLayout: ZenLayoutOrientation;
  setZenLayout: (layout: ZenLayoutOrientation) => void;
  
  lastActiveZenAgent: string | null;
  setLastActiveZenAgent: (agent: string | null) => void;
  
  focusedZenAgent: string | null;
  setFocusedZenAgent: (agent: string | null) => void;

  portCount: number;
  setPortCount: (count: number) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  newAgentName: "",
  setNewAgentName: (newAgentName) => set({ newAgentName }),
  
  agentQueueCounts: {},
  setAgentQueueCounts: (val) => set((state) => ({ agentQueueCounts: typeof val === 'function' ? val(state.agentQueueCounts) : val })),
  
  agentStatusMap: {},
  setAgentStatusMap: (val) => set((state) => ({ agentStatusMap: typeof val === 'function' ? val(state.agentStatusMap) : val })),
  
  zenAgents: ["zen-terminal"],
  setZenAgents: (val) => set((state) => ({ zenAgents: typeof val === 'function' ? val(state.zenAgents) : val })),
  
  zenLayout: "grid",
  setZenLayout: (zenLayout) => set({ zenLayout }),
  
  lastActiveZenAgent: "zen-terminal",
  setLastActiveZenAgent: (lastActiveZenAgent) => set({ lastActiveZenAgent }),
  
  focusedZenAgent: null,
  setFocusedZenAgent: (focusedZenAgent) => set({ focusedZenAgent }),

  portCount: 0,
  setPortCount: (portCount) => set({ portCount }),
}));
