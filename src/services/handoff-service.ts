import type { MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { GitSnapshotRecord } from "../components/panels/SnapshotPanel";
import {
  getAgentId,
  findMatchingAgent,
  getBrainstormResponse,
  getHandoffKind,
  getHandoffSender,
  getPtyKey,
  getTaskSummary,
  isMasterPlanManagedHandoff,
  type ActiveMasterPlanTask,
  type BrainstormResponsePayload,
  type HandoffKind,
  type HandoffPayload,
  type HitlApprovalRequest,
  type TaskRecord,
} from "./app-core";

import type { AgentInstance } from "../types/workspace";

export interface RegisterHandoffListenersOptions {
  currentProjectRef: MutableRefObject<string | null>;
  agentsRef: MutableRefObject<AgentInstance[]>;
  pendingHandoffs: MutableRefObject<Map<string, string[]>>;
  readyAgents: MutableRefObject<Set<string>>;
  hitlEnabledRef: MutableRefObject<boolean>;
  activeMasterPlanTask: MutableRefObject<ActiveMasterPlanTask | null>;
  setTasks: (val: TaskRecord[] | ((prev: TaskRecord[]) => TaskRecord[])) => void;
  setSnapshots: (val: GitSnapshotRecord[] | ((prev: GitSnapshotRecord[]) => GitSnapshotRecord[])) => void;
  setApprovalRequest: (request: HitlApprovalRequest | null) => void;
  addLog: (message: string, type?: "system" | "handoff") => void;
  trackAgentPlanTask: (agentName: string, text: string) => void;
  popAgentPlanTask: (agentName: string) => string | null;
  syncPlanTaskStatusByText: (text: string, status: "in_progress" | "done") => Promise<void>;
  syncMasterPlanQueueState: () => void;
  dispatchNextMasterPlanTask: () => void;
  recordBrainstormResponse: (agent: string, response: BrainstormResponsePayload) => Promise<void>;
  writeHandoff: (agentKey: string, payload: string) => void;
  queueHandoff: (agentKey: string, payload: string) => void;
  flushQueuedHandoff: (agentKey: string) => void;
}

export const registerHandoffListeners = ({
  currentProjectRef,
  agentsRef,
  pendingHandoffs,
  readyAgents,
  hitlEnabledRef,
  activeMasterPlanTask,
  setTasks,
  setSnapshots,
  setApprovalRequest,
  addLog,
  trackAgentPlanTask,
  popAgentPlanTask,
  syncPlanTaskStatusByText,
  syncMasterPlanQueueState,
  dispatchNextMasterPlanTask,
  recordBrainstormResponse,
  writeHandoff,
  queueHandoff,
  flushQueuedHandoff,
}: RegisterHandoffListenersOptions) => {
  const registerTask = (handoff: HandoffPayload, targetName: string, kind: HandoffKind) => {
    const sender = handoff.sender?.trim() || "Main";
    const id = handoff.taskId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const updatedAt = new Date().toLocaleTimeString();

    if (kind === "task") {
      const summary = getTaskSummary(handoff.payload);
      const record: TaskRecord = {
        id,
        sender,
        target: targetName,
        summary,
        status: "in_progress",
        updatedAt,
      };
      setTasks(prev => [record, ...prev.filter(task => task.id !== id)].slice(0, 30));

      if (!isMasterPlanManagedHandoff(handoff)) {
        const completionOwner = getAgentId(sender) === "orchestrator" ? sender : targetName;
        trackAgentPlanTask(completionOwner, summary);
        syncPlanTaskStatusByText(summary, "in_progress").catch(err => {
          addLog(`Master Plan task sync failed: ${err}`, "system");
        });
      }
      return id;
    }

    if (kind === "completion") {
      const completedAgentId = getAgentId(sender);
      setTasks(prev => prev.map(task => {
        if (task.status !== "in_progress" || getAgentId(task.target) !== completedAgentId) return task;
        return { ...task, status: "complete", updatedAt };
      }));

      const completionTargetId = getAgentId(targetName);
      if (completionTargetId === "masterplan" && currentProjectRef.current && activeMasterPlanTask.current) {
        const completedPlanTask = activeMasterPlanTask.current;
        activeMasterPlanTask.current = null;
        syncMasterPlanQueueState();
        invoke("set_master_plan_task_status", {
          cwd: currentProjectRef.current,
          line: completedPlanTask.line,
          status: "done",
        }).then(() => {
          addLog(`Master Plan completed: ${completedPlanTask.text}`, "system");
          dispatchNextMasterPlanTask();
        }).catch(err => {
          invoke("set_master_plan_task_status_by_text", {
            cwd: currentProjectRef.current,
            text: completedPlanTask.text,
            status: "done",
          }).then(() => {
            addLog(`Master Plan completed: ${completedPlanTask.text}`, "system");
            dispatchNextMasterPlanTask();
          }).catch(() => {
            addLog(`Master Plan completion sync failed: ${err}`, "system");
            dispatchNextMasterPlanTask();
          });
        });
      } else {
        const completedTaskText = popAgentPlanTask(sender);
        if (completedTaskText) {
          syncPlanTaskStatusByText(completedTaskText, "done").catch(err => {
            addLog(`Master Plan completion sync failed: ${err}`, "system");
          });
        }
      }
    }

    return id;
  };

  const createPlanSnapshot = async (taskId: string, targetName: string, summary: string) => {
    const project = currentProjectRef.current;
    if (!project) return;

    try {
      const snapshot = await invoke<GitSnapshotRecord>("create_git_snapshot", {
        cwd: project,
        taskId,
        label: summary || `Task for ${targetName}`,
        agent: targetName,
      });
      setSnapshots(prev => [snapshot, ...prev.filter(item => item.id !== snapshot.id)].slice(0, 40));
      addLog(`Snapshot ${snapshot.commit.slice(0, 8)} before ${targetName}`, "system");
    } catch (err) {
      addLog(`Snapshot skipped: ${err}`, "system");
    }
  };

  const enrichPayload = async (handoff: HandoffPayload, kind: HandoffKind) => {
    const safePayload = handoff.payload.replace(/\r?\n/g, " ").trim();
    const workspace = currentProjectRef.current;
    if (kind !== "task" || !workspace) return safePayload;
    const activeAgentList = agentsRef.current.join(", ") || "none";

    try {
      const context = await invoke<string>("get_project_context", { cwd: workspace });
      return `${safePayload} ACTIVE AGENTS: ${activeAgentList}. Delegate only to one of these active agents unless the human explicitly spawns another agent. WORKSPACE ROOT: ${workspace}. All file reads and writes must stay under this workspace root. Do not edit files in the DidiTerminal app directory unless it is the selected workspace. MASTER_PLAN RULE: specialists may add or check off indented subtasks under the assigned top-level task, but they must not mark the top-level task done; Orchestrator owns top-level completion. DELEGATION WAIT RULE: after delegating work to another agent, stop immediately and wait for that agent's completion callback; do not poll files, inspect progress, retry the task, or use internal subagent/Task tools to do the delegated work yourself. Default callback rule: when your assigned work is done, you MUST execute the shell command (using your terminal execution tool, do NOT just print the command in text) to report completion to the agent that delegated it to you. Only delegate to another specialist if this task explicitly asks for review/docs/follow-up work, or if you are blocked and need that specialist. Do not ask the human whether to report back. WORKSPACE CONTEXT: ${context.replace(/\r?\n/g, " ").trim()}`;
    } catch (err) {
      console.warn("Failed to add workspace context", err);
      return safePayload;
    }
  };

  const handleHandoff = async (handoff: HandoffPayload) => {
    const { target } = handoff;
    const targetName = target.trim();
    const kind = getHandoffKind(handoff);
    const brainstormResponse = getBrainstormResponse(handoff.payload);

    if (getAgentId(targetName) === "masterplan" && kind === "completion") {
      addLog("completion to Master Plan", "handoff");
      registerTask(handoff, targetName, kind);
      return;
    }

    if (brainstormResponse) {
      const senderAgent = getHandoffSender(handoff) || targetName;
      await recordBrainstormResponse(senderAgent, brainstormResponse);
      registerTask(handoff, targetName, "completion");
      return;
    }

    const matchingAgent = findMatchingAgent(agentsRef.current, targetName);
    if (!matchingAgent) {
      const senderName = getHandoffSender(handoff) || handoff.sender || "Orchestrator";
      const senderAgent = findMatchingAgent(agentsRef.current, senderName);
      const available = agentsRef.current.join(", ") || "none";
      const notice = `Target agent "${targetName}" is not active, so DidiTerminal did not create a new agent. Active agents: ${available}. Delegate to one of the active agents, or ask the human to spawn "${targetName}" first.`;
      addLog(`Blocked handoff to inactive agent: ${targetName}`, "system");

      if (senderAgent) {
        const senderKey = getPtyKey(senderAgent.name);
        if (readyAgents.current.has(senderKey)) {
          writeHandoff(senderKey, notice);
        } else {
          queueHandoff(senderKey, notice);
        }
      }
      return;
    }

    const resolvedAgentName = matchingAgent.name;
    const agentKey = getPtyKey(resolvedAgentName);

    addLog(
      matchingAgent && matchingAgent.name !== targetName
        ? `${kind} to ${matchingAgent.name} (${targetName})`
        : `${kind} to ${targetName}`,
      "handoff"
    );
    const taskId = registerTask(handoff, resolvedAgentName, kind);

    const safePayload = await enrichPayload(handoff, kind);

    if (kind === "task") {
      await createPlanSnapshot(taskId, resolvedAgentName, getTaskSummary(handoff.payload));
    } else if (kind === "completion" && hitlEnabledRef.current && currentProjectRef.current) {
      const senderName = getHandoffSender(handoff) || handoff.sender || "";
      try {
        const planContext = await invoke<string>("read_master_plan", { cwd: currentProjectRef.current });
        const regex = new RegExp(`^\\s*-\\s*\\[[ xX]\\]\\s*${senderName}[:\\s].*<!--\\s*didi:requires_approval\\s*-->`, "im");
        if (regex.test(planContext) || new RegExp(`${senderName}.*requires_approval`, "im").test(planContext)) {
          setApprovalRequest({
            agent: senderName,
            target: agentKey,
            payload: safePayload,
            taskId,
          });
          addLog(`HITL Approval requested for ${senderName}`, "system");
          return;
        }
      } catch (e) {
        console.warn("Failed to check HITL", e);
      }
    }

    if (readyAgents.current.has(agentKey)) {
      writeHandoff(agentKey, safePayload);
    } else {
      queueHandoff(agentKey, safePayload);
    }
  };

  const unlistenHandoff = listen<HandoffPayload>("agent-handoff", (event) => {
    handleHandoff(event.payload).catch(console.error);
  });

  const unlistenReady = listen<{ agent: string }>("agent-prompt-ready", (event) => {
    const agentKey = event.payload.agent.toLowerCase();
    readyAgents.current.add(agentKey);

    if (pendingHandoffs.current.has(agentKey)) {
      setTimeout(() => flushQueuedHandoff(agentKey), 500);
    }
  });

  const taskTimeoutInterval = setInterval(() => {
    setTasks((prev: TaskRecord[]) => {
      let changed = false;
      const now = Date.now();
      const next = prev.map(task => {
        if (task.status === "in_progress" && task.dispatchedAt && now - task.dispatchedAt > 5 * 60 * 1000) {
          changed = true;
          addLog(`Task ${task.id.slice(0, 4)} from ${task.sender} to ${task.target} timed out`, "system");
          return { ...task, status: "timeout" as any, updatedAt: new Date().toLocaleTimeString() };
        }
        return task;
      });
      return changed ? next : prev;
    });
  }, 60000);

  return () => {
    clearInterval(taskTimeoutInterval);
    unlistenHandoff.then(f => f());
    unlistenReady.then(f => f());
  };
};
