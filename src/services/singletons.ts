import type { MutableRefObject } from "react";
import type { BrainstormSession } from "../components/modals/BrainstormModal";
import type { ActiveMasterPlanTask, MasterPlanTaskDispatch, SentinelAgentState } from "./app-core";
import type { AgentInstance } from "../types/workspace";

export const pendingHandoffs: MutableRefObject<Map<string, string[]>> = { current: new Map() };
export const readyAgents: MutableRefObject<Set<string>> = { current: new Set() };
export const agentsRef: MutableRefObject<AgentInstance[]> = { current: [] };
export const currentProjectRef: MutableRefObject<string | null> = { current: null };
export const sentinelEnabledRef: MutableRefObject<boolean> = { current: false };
export const hitlEnabledRef: MutableRefObject<boolean> = { current: false };
export const sentinelStates: MutableRefObject<Map<string, SentinelAgentState>> = { current: new Map() };
export const brainstormSessionsRef: MutableRefObject<BrainstormSession[]> = { current: [] };
export const activeMasterPlanTask: MutableRefObject<ActiveMasterPlanTask | null> = { current: null };
export const queuedMasterPlanTasks: MutableRefObject<MasterPlanTaskDispatch[]> = { current: [] };
export const activeAgentPlanTasks: MutableRefObject<Map<string, string[]>> = { current: new Map() };
