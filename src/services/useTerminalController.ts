import { useAgentStore } from "./stores/agent-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentOps } from "./use-agent-ops";
import { addLog } from "./logger";
import { pendingHandoffs, readyAgents } from "./singletons";
import { createHandoffQueueService } from "./handoff-queue-service";
import { getUniqueAgents } from "./app-core";
import type { TerminalTab } from "../types/workspace";

const handoffService = createHandoffQueueService({
  pendingHandoffs,
  readyAgents,
  setAgentQueueCounts: (val) => useAgentStore.getState().setAgentQueueCounts(val),
});

export function useTerminalController() {
  const newAgentName = useAgentStore((s) => s.newAgentName);
  const setNewAgentName = useAgentStore((s) => s.setNewAgentName);
  const agentQueueCounts = useAgentStore((s) => s.agentQueueCounts);
  const setAgentQueueCounts = useAgentStore((s) => s.setAgentQueueCounts);
  const agentStatusMap = useAgentStore((s) => s.agentStatusMap);
  const zenAgents = useAgentStore((s) => s.zenAgents);
  const setZenAgents = useAgentStore((s) => s.setZenAgents);
  const zenLayout = useAgentStore((s) => s.zenLayout);
  const setZenLayout = useAgentStore((s) => s.setZenLayout);
  const lastActiveZenAgent = useAgentStore((s) => s.lastActiveZenAgent);
  const setLastActiveZenAgent = useAgentStore((s) => s.setLastActiveZenAgent);
  const focusedZenAgent = useAgentStore((s) => s.focusedZenAgent);
  const setFocusedZenAgent = useAgentStore((s) => s.setFocusedZenAgent);
  const portCount = useAgentStore((s) => s.portCount);
  const setPortCount = useAgentStore((s) => s.setPortCount);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const activeSection = activeWorkspace?.sections.find((s) => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const activeTabId = activeSection?.activeTabId || activeWorkspace?.activeTabId || "";
  const activeTab = tabs.find((t: TerminalTab) => t.id === activeTabId) || tabs[0];
  const agents = activeTab ? activeTab.agents : [];
  const allAgents = getUniqueAgents(tabs.flatMap((t: TerminalTab) => t.agents));

  const agentOps = useAgentOps(addLog, {
    pendingHandoffs,
    readyAgents,
    writeHandoff: handoffService.writeHandoff,
    queueHandoff: handoffService.queueHandoff,
  });

  return {
    newAgentName,
    setNewAgentName,
    agentQueueCounts,
    setAgentQueueCounts,
    agentStatusMap,
    zenAgents,
    setZenAgents,
    zenLayout,
    setZenLayout,
    lastActiveZenAgent,
    setLastActiveZenAgent,
    focusedZenAgent,
    setFocusedZenAgent,
    portCount,
    setPortCount,
    agents,
    allAgents,
    ...agentOps,
  };
}
