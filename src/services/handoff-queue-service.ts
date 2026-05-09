import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HANDOFF_SUBMIT_DELAY_MS } from "./app-core";

interface CreateHandoffQueueServiceOptions {
  pendingHandoffs: MutableRefObject<Map<string, string[]>>;
  readyAgents: MutableRefObject<Set<string>>;
  setAgentQueueCounts: Dispatch<SetStateAction<Record<string, number>>>;
}

export const createHandoffQueueService = ({
  pendingHandoffs,
  readyAgents,
  setAgentQueueCounts,
}: CreateHandoffQueueServiceOptions) => {
  const updateQueueCount = (agentKey: string) => {
    const count = pendingHandoffs.current.get(agentKey)?.length ?? 0;
    setAgentQueueCounts(prev => {
      const next = { ...prev };
      if (count > 0) {
        next[agentKey] = count;
      } else {
        delete next[agentKey];
      }
      return next;
    });
  };

  const writeHandoff = (agentKey: string, payload: string) => {
    console.log(`[JS] Injecting handoff into ${agentKey}`);
    readyAgents.current.delete(agentKey);
    invoke("write_pty", { agent: agentKey, data: payload }).catch(console.error);
    setTimeout(() => {
      invoke("write_pty", { agent: agentKey, data: "\r" }).catch(console.error);
    }, HANDOFF_SUBMIT_DELAY_MS);
  };

  const flushQueuedHandoff = (agentKey: string) => {
    const queue = pendingHandoffs.current.get(agentKey);
    if (!queue || queue.length === 0) return;

    const queued = queue.shift();
    if (queue.length === 0) {
      pendingHandoffs.current.delete(agentKey);
    } else {
      pendingHandoffs.current.set(agentKey, queue);
    }
    updateQueueCount(agentKey);
    if (!queued) return;

    writeHandoff(agentKey, queued);
  };

  const queueHandoff = (agentKey: string, payload: string) => {
    const queue = pendingHandoffs.current.get(agentKey) ?? [];
    queue.push(payload);
    pendingHandoffs.current.set(agentKey, queue);
    updateQueueCount(agentKey);
  };

  return {
    writeHandoff,
    queueHandoff,
    flushQueuedHandoff,
  };
};
