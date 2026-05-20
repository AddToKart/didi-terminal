import { type FormEvent, type MutableRefObject } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { TerminalLayoutOrientation, TerminalTab } from "../types/workspace";
import { getPtyKey } from "./app-core";
import { getSplitAgentNameInTab, getUniqueAgentNameInTab } from "./agent-naming";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadStoredTerminalLanes,
  saveTerminalLanes,
} from "./terminal-lanes";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentStore } from "./stores/agent-store";
import { useUIStore } from "./stores/ui-store";
import { useOrchestrationStore } from "./stores/orchestration-store";
import type { AddLogFn } from "./use-workspace-crud";

export function useAgentOps(
  addLog: AddLogFn,
  handoffContext: {
    pendingHandoffs: MutableRefObject<Map<string, string[]>>;
    readyAgents: MutableRefObject<Set<string>>;
    writeHandoff: (agentKey: string, payload: string) => void;
    queueHandoff: (agentKey: string, payload: string) => void;
  },
) {
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const setWorkspaces = useWorkspaceStore(s => s.setWorkspaces);
  const newAgentName = useAgentStore(s => s.newAgentName);
  const setNewAgentName = useAgentStore(s => s.setNewAgentName);
  const setAgentQueueCounts = useAgentStore(s => s.setAgentQueueCounts);
  const setOpenPanel = useUIStore(s => s.setOpenPanel);
  const approvalRequest = useOrchestrationStore(s => s.approvalRequest);
  const setApprovalRequest = useOrchestrationStore(s => s.setApprovalRequest);
  const setTasks = useOrchestrationStore(s => s.setTasks);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const activeSection = activeWorkspace?.sections.find(s => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const activeTabId = activeSection?.activeTabId || activeWorkspace?.activeTabId || "";
  const activeTab = tabs.find((t: TerminalTab) => t.id === activeTabId) || tabs[0];
  const agents = activeTab ? activeTab.agents : [];

  const setTabs = (val: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const targetSectionId = w.activeSectionId || w.sections[0]?.id;
      const currentTabs = w.sections.find(s => s.id === targetSectionId)?.tabs || [];
      const nextTabs = typeof val === "function" ? val(currentTabs) : val;
      const sections = w.sections.map(s => s.id === targetSectionId ? { ...s, tabs: nextTabs } : s);
      if (sections.length === 0) {
        sections.push({ id: crypto.randomUUID(), name: "Section 1", tabs: nextTabs });
      }
      return { ...w, sections };
    }));
  };

  const closeStoredTerminalLanes = (agentName: string) => {
    const storedLanes = loadStoredTerminalLanes(agentName, activeWorkspaceId);
    if (!storedLanes) return;

    for (const lane of storedLanes) {
      if (lane.id === ROOT_TERMINAL_LANE_ID) continue;
      invoke("close_pty", { agent: getTerminalLanePtyKey(activeWorkspaceId, lane.agentName) }).catch(console.error);
    }

    clearTerminalLanes(agentName, activeWorkspaceId);
  };

  const handleReorderAgents = (oldIndex: number, newIndex: number) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const newAgents = [...t.agents];
      const [moved] = newAgents.splice(oldIndex, 1);
      newAgents.splice(newIndex, 0, moved);
      return { ...t, agents: newAgents };
    }));
  };

  const spawnAgent = (e?: FormEvent, customName?: string, shell?: string) => {
    if (e) e.preventDefault();
    const activeTabAgents = activeTab?.agents ?? [];
    const name = getUniqueAgentNameInTab(activeTabAgents, customName || newAgentName || "Terminal");

    const agentId = crypto.randomUUID();
    if (shell) {
      const rootLane = {
        id: ROOT_TERMINAL_LANE_ID,
        label: "Main",
        agentName: agentId,
        shell,
      };
      saveTerminalLanes(agentId, activeWorkspaceId, [rootLane]);
    }

    const newAgent = { id: agentId, name };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    setNewAgentName("");
    addLog(`Spawned terminal: ${name}`, "system");
  };

  const handleOpenProjectInTerminal = (_path: string, name: string) => {
    const agentName = getUniqueAgentNameInTab(agents, name);
    const newAgent = { id: crypto.randomUUID(), name: agentName };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    addLog(`Opening ${name} in terminal...`, "system");
    setOpenPanel(null);
  };

  const removeAgent = (agentToRemoveId: string) => {
    const agentToRemove = agents.find(a => a.id === agentToRemoveId)?.name || agentToRemoveId;
    const agentKey = getTerminalLanePtyKey(activeWorkspaceId, agentToRemoveId);
    closeStoredTerminalLanes(agentToRemoveId);
    invoke("close_pty", { agent: agentKey }).catch(console.error);
    pendingHandoffs.current.delete(agentKey);
    readyAgents.current.delete(agentKey);
    setAgentQueueCounts(prev => {
      const next = { ...prev };
      delete next[agentKey];
      return next;
    });
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a.id !== agentToRemoveId) } : t));
    addLog(`Terminated agent: ${agentToRemove}`, "system");
  };

  const detachAgent = (agentToDetachId: string) => {
    const agentToDetach = agents.find(a => a.id === agentToDetachId)?.name || agentToDetachId;
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: t.agents.filter(a => a.id !== agentToDetachId) } : t));
    addLog(`Detached agent: ${agentToDetach}`, "system");
  };

  const handleSpawnBrowser = () => {
    const newAgent = { id: crypto.randomUUID(), name: `browser:${Date.now()}` };
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, agents: [...t.agents, newAgent] } : t));
    addLog("Opened browser pane", "system");
  };

  const handleSetLayoutOrientation = (orientation: TerminalLayoutOrientation) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, layoutOrientation: orientation } : t));
  };

  const handleSplit = (agentToSplitId: string) => {
    const agentToSplit = agents.find(a => a.id === agentToSplitId)?.name || "Split Agent";
    const newName = getSplitAgentNameInTab(agents, agentToSplit);

    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const index = t.agents.findIndex(a => a.id === agentToSplitId);
      const newAgent = { id: crypto.randomUUID(), name: newName };
      if (index === -1) return { ...t, agents: [...t.agents, newAgent] };
      const newAgents = [...t.agents];
      newAgents.splice(index + 1, 0, newAgent);
      return { ...t, agents: newAgents };
    }));

    addLog(`Split terminal: ${newName}`, "system");
  };

  const handleKillAgent = (agent: string) => {
    closeStoredTerminalLanes(agent);
    invoke("close_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}` }).catch(console.error);
    addLog(`Sent kill signal to ${agent}`, "system");
  };

  const handleInterruptAgent = (agent: string) => {
    invoke("write_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}`, data: "\x03" }).catch(console.error);
    addLog(`Sent SIGINT to ${agent}`, "system");
  };

  const handleInjectHint = (agent: string, hint: string) => {
    invoke("write_pty", { agent: `${activeWorkspaceId}::${getPtyKey(agent)}`, data: `${hint}\r` }).catch(console.error);
    addLog(`Injected hint to ${agent}`, "system");
  };

  const handleQuickDispatch = (target: string, task: string) => {
    emit("agent-handoff", { sender: "Orchestrator", target, payload: task, kind: "task" });
    addLog(`Quick dispatch from Orchestrator -> ${target}`, "handoff");
  };

  const { pendingHandoffs, readyAgents, writeHandoff, queueHandoff } = handoffContext;

  const handleHitlApprove = () => {
    if (!approvalRequest) return;
    if (readyAgents.current.has(approvalRequest.target)) {
      writeHandoff(approvalRequest.target, approvalRequest.payload);
    } else {
      queueHandoff(approvalRequest.target, approvalRequest.payload);
    }
    setApprovalRequest(null);
  };

  const handleHitlReject = (feedback: string) => {
    if (!approvalRequest) return;
    const senderKey = getPtyKey(approvalRequest.agent);
    let rejectionPayload = "[SYSTEM] The human rejected your completion. Please fix the issues and try again.";
    if (feedback.trim()) {
      rejectionPayload = `[SYSTEM] The human rejected your completion with the following feedback:\n${feedback}\n\nPlease fix the issues and try again.`;
    }

    if (readyAgents.current.has(senderKey)) {
      writeHandoff(senderKey, rejectionPayload);
    } else {
      queueHandoff(senderKey, rejectionPayload);
    }

    setTasks(prev => prev.map(t => t.id === approvalRequest.taskId ? { ...t, status: "in_progress" } : t));
    setApprovalRequest(null);
  };

  return {
    handleReorderAgents,
    spawnAgent,
    handleOpenProjectInTerminal,
    removeAgent,
    detachAgent,
    handleSpawnBrowser,
    handleSetLayoutOrientation,
    handleSplit,
    handleKillAgent,
    handleInterruptAgent,
    handleInjectHint,
    handleQuickDispatch,
    handleHitlApprove,
    handleHitlReject,
  };
}
