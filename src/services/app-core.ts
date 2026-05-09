export const HANDOFF_SUBMIT_DELAY_MS = 400;
export const BRAINSTORM_CALLBACK_TARGET = "Brainstorm";

export const getPtyKey = (agentName: string) => agentName.trim().toLowerCase();

export const getAgentId = (agentName: string) =>
  getPtyKey(agentName).replace(/[^a-z0-9]/g, "");

export const getUniqueAgents = (agentNames: string[]) => {
  const seen = new Set<string>();

  return agentNames.filter(agentName => {
    const id = getAgentId(agentName);
    if (!id || seen.has(id)) return false;

    seen.add(id);
    return true;
  });
};

export const findMatchingAgent = (agentNames: string[], targetName: string) => {
  const targetPtyKey = getPtyKey(targetName);
  const targetId = getAgentId(targetName);

  return agentNames.find(agentName =>
    getPtyKey(agentName) === targetPtyKey || getAgentId(agentName) === targetId
  );
};

export const isCompletionMessage = (payload: string) =>
  /^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b/i.test(payload) ||
  /\bCOMPLETED TASK\b/i.test(payload) ||
  /completion callback/i.test(payload);

export const getTaskSummary = (payload: string) =>
  payload
    .replace(/\[[^\]]+\]\s*:\s*/g, "")
    .replace(/\[SYSTEM RULE:[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

export const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

export const isFailureOutput = (value: string) =>
  /(error|failed|exception|traceback|cannot find|not recognized|command not found|permission denied|access is denied|tests? failed|build failed|compilation failed|panic|fatal:)/i.test(value);

export const normalizeLoopSignature = (value: string) =>
  stripTerminalControls(value)
    .replace(/\s+/g, " ")
    .replace(/\d{2,}/g, "#")
    .trim()
    .slice(0, 220);

export interface BrainstormResponsePayload {
  sessionId: string;
  round: number;
  text: string;
}

export const getBrainstormResponse = (payload: string): BrainstormResponsePayload | null => {
  const match = payload.match(/^\s*(?:\[[^\]]+\]\s*:\s*)?brainstorm\s+response\s+([a-z0-9-]+)\s+round\s+(\d+)\s*:\s*([\s\S]+)/i);
  if (!match) return null;

  return {
    sessionId: match[1],
    round: Number(match[2]),
    text: match[3].replace(/\[SYSTEM RULE:[\s\S]*$/i, "").trim(),
  };
};

export interface HandoffPayload {
  target: string;
  payload: string;
  kind?: HandoffKind;
  sender?: string;
  taskId?: string;
  parentTaskId?: string;
}

export const getHandoffKind = (handoff: HandoffPayload): HandoffKind => {
  if (handoff.kind) return handoff.kind;
  return isCompletionMessage(handoff.payload) ? "completion" : "task";
};

export const isMasterPlanManagedHandoff = (handoff: HandoffPayload) =>
  getAgentId(handoff.sender || "") === "masterplan" ||
  /Queue this MASTER_PLAN\.md task/i.test(handoff.payload);

export const getHandoffSender = (handoff: HandoffPayload) => {
  const bracketSender = handoff.payload.match(/^\s*\[([^\]]+?)\s+(?:DELEGATED A TASK|COMPLETED TASK)\]/i)?.[1];
  return bracketSender?.trim() || handoff.sender?.trim() || "";
};

export interface ActivityLog {
  id: number;
  time: string;
  message: string;
  type: "system" | "handoff";
}

export type HandoffKind = "task" | "completion" | "status";
export type TaskStatus = "pending" | "in_progress" | "complete";

export interface TaskRecord {
  id: string;
  sender: string;
  target: string;
  summary: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface MasterPlanTaskDispatch {
  line: number;
  text: string;
  section: string;
}

export interface ActiveMasterPlanTask extends MasterPlanTaskDispatch {
  dispatchedAt: number;
}

export interface TerminalInputPayload {
  agent: string;
  data: string;
}

export interface TerminalOutputPayload {
  agent: string;
  data: string;
}

export interface SentinelAgentState {
  inputBuffer: string;
  lastCommand: string;
  lastFailureCommand: string;
  failureCount: number;
  lastFailureAt: number;
  lastSignature: string;
  signatureCount: number;
  lastInterventionAt: number;
}

export interface HitlApprovalRequest {
  agent: string;
  target: string;
  payload: string;
  taskId: string;
}
