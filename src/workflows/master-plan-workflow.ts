import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { getAgentId, type ActiveMasterPlanTask, type MasterPlanTaskDispatch } from "../services/app-core";

import type { AgentInstance } from "../types/workspace";

interface CreateMasterPlanWorkflowOptions {
  currentProjectRef: MutableRefObject<string | null>;
  agentsRef: MutableRefObject<AgentInstance[]>;
  activeMasterPlanTask: MutableRefObject<ActiveMasterPlanTask | null>;
  queuedMasterPlanTasks: MutableRefObject<MasterPlanTaskDispatch[]>;
  activeAgentPlanTasks: MutableRefObject<Map<string, string[]>>;
  setMasterPlanQueueState: Dispatch<SetStateAction<{ activeLine: number | null; queuedLines: number[] }>>;
  addLog: (message: string, type?: "system" | "handoff") => void;
}

export const createMasterPlanWorkflow = ({
  currentProjectRef,
  agentsRef,
  activeMasterPlanTask,
  queuedMasterPlanTasks,
  activeAgentPlanTasks,
  setMasterPlanQueueState,
  addLog,
}: CreateMasterPlanWorkflowOptions) => {
  const syncMasterPlanQueueState = () => {
    setMasterPlanQueueState({
      activeLine: activeMasterPlanTask.current?.line ?? null,
      queuedLines: queuedMasterPlanTasks.current.map(task => task.line),
    });
  };

  const dispatchMasterPlanTaskToOrchestrator = async (task: MasterPlanTaskDispatch) => {
    if (!currentProjectRef.current) return;
    const activeAgentList = agentsRef.current.join(", ") || "none";
    activeMasterPlanTask.current = { ...task, dispatchedAt: Date.now() };
    syncMasterPlanQueueState();

    await emit("agent-handoff", {
      target: "Orchestrator",
      sender: "MasterPlan",
      kind: "task",
      taskId: `master-plan-${task.line}-${Date.now()}`,
      payload: [
        `Queue this MASTER_PLAN.md task and delegate it to the right specialist when you are ready: ${task.text}`,
        `Section: ${task.section}.`,
        `Active agents available now: ${activeAgentList}. Delegate only to one of these active agents.`,
        `Workspace: ${currentProjectRef.current}.`,
        `MASTER_PLAN.md line ${task.line + 1} is already marked in progress. Do not mark it done when you delegate it.`,
        `Specialists may create and complete indented subtasks under that line, but only Orchestrator may send the final completion callback that closes the top-level task.`,
        `Unless this task explicitly asks for code review, documentation, or another follow-up specialist step, instruct the assigned specialist to finish the work and report completion back to Orchestrator.`,
        `After Orchestrator delegates this task to a specialist, Orchestrator must stop immediately and wait for the completion callback. Do not poll files, check whether files were created, retry the task, or do the specialist's work.`,
        `Only after the assigned specialist reports completion should Orchestrator send one completion callback to MasterPlan.`,
      ].join(" "),
    });
    addLog(`Started Master Plan task: ${task.text}`, "handoff");
  };

  const dispatchNextMasterPlanTask = () => {
    if (activeMasterPlanTask.current || queuedMasterPlanTasks.current.length === 0) return;
    const nextTask = queuedMasterPlanTasks.current.shift();
    syncMasterPlanQueueState();
    if (!nextTask) return;
    dispatchMasterPlanTaskToOrchestrator(nextTask).catch(err => {
      addLog(`Master Plan queue dispatch failed: ${err}`, "system");
    });
  };

  const syncPlanTaskStatusByText = async (text: string, status: "in_progress" | "done") => {
    const project = currentProjectRef.current;
    const cleanText = text.trim();
    if (!project || !cleanText) return;

    try {
      await invoke("set_master_plan_task_status_by_text", {
        cwd: project,
        text: cleanText,
        status,
      });
    } catch (err) {
      if (status === "done") {
        throw err;
      }

      await invoke("append_master_plan_task", {
        cwd: project,
        text: cleanText,
        status,
      });
    }
  };

  const trackAgentPlanTask = (agentName: string, text: string) => {
    const agentId = getAgentId(agentName);
    const cleanText = text.trim();
    if (!agentId || !cleanText) return;

    const queue = activeAgentPlanTasks.current.get(agentId) ?? [];
    if (!queue.includes(cleanText)) {
      queue.push(cleanText);
    }
    activeAgentPlanTasks.current.set(agentId, queue);
  };

  const popAgentPlanTask = (agentName: string) => {
    const agentId = getAgentId(agentName);
    const queue = activeAgentPlanTasks.current.get(agentId);
    if (!queue || queue.length === 0) return null;

    const text = queue.shift() ?? null;
    if (queue.length === 0) {
      activeAgentPlanTasks.current.delete(agentId);
    } else {
      activeAgentPlanTasks.current.set(agentId, queue);
    }
    return text;
  };

  const handleDispatchMasterPlanTask = async (task: MasterPlanTaskDispatch) => {
    if (!currentProjectRef.current) return;
    const isActive = activeMasterPlanTask.current?.line === task.line;
    const isQueued = queuedMasterPlanTasks.current.some(item => item.line === task.line);
    if (isActive || isQueued) {
      addLog(`Master Plan task already queued: ${task.text}`, "system");
      return;
    }

    if (!activeMasterPlanTask.current) {
      await dispatchMasterPlanTaskToOrchestrator(task);
      return;
    }

    queuedMasterPlanTasks.current.push(task);
    syncMasterPlanQueueState();
    addLog(`Queued Master Plan task behind active work: ${task.text}`, "handoff");
  };

  const resetMasterPlanWorkflow = () => {
    activeMasterPlanTask.current = null;
    queuedMasterPlanTasks.current = [];
    activeAgentPlanTasks.current.clear();
    syncMasterPlanQueueState();
  };

  return {
    syncMasterPlanQueueState,
    dispatchNextMasterPlanTask,
    syncPlanTaskStatusByText,
    trackAgentPlanTask,
    popAgentPlanTask,
    handleDispatchMasterPlanTask,
    resetMasterPlanWorkflow,
  };
};
