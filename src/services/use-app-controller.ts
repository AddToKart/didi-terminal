import { useEffect, useState } from "react";
import { getUniqueAgents } from "./app-core";
import { useZenHotkeys } from "./use-zen-hotkeys";
import { createHandoffQueueService } from "./handoff-queue-service";
import { masterPlanWorkflow, brainstormWorkflow } from "./workflows";
import { loadWorkspaces, getSetting, setSetting } from "./db-service";
import type { TerminalTab } from "../types/workspace";
import { useUIStore } from "./stores/ui-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentStore } from "./stores/agent-store";
import { useOrchestrationStore } from "./stores/orchestration-store";
import { useWorkspaceCrud } from "./use-workspace-crud";
import { addLog } from "./logger";
import {
  pendingHandoffs,
  readyAgents,
  agentsRef,
  currentProjectRef,
  sentinelEnabledRef,
  hitlEnabledRef,
  sentinelStates,
  activeMasterPlanTask,
} from "./singletons";
import {
  usePersistence,
  useProjectChange,
  useCodeReviewStats,
  usePortCount,
  useConfigFetcher,
  useAgentStateListener,
  useSentinel,
  useHandoffListeners,
  useOmnibarShortcut,
} from "./use-app-effects";

const handoffService = createHandoffQueueService({
  pendingHandoffs,
  readyAgents,
  setAgentQueueCounts: (val) => useAgentStore.getState().setAgentQueueCounts(val),
});

export function useAppController() {
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);

  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const sentinelEnabled = useOrchestrationStore((s) => s.sentinelEnabled);
  const setSentinelEnabled = useOrchestrationStore((s) => s.setSentinelEnabled);
  const hitlEnabled = useOrchestrationStore((s) => s.hitlEnabled);
  const setHitlEnabled = useOrchestrationStore((s) => s.setHitlEnabled);

  const [isDbLoaded, setIsDbLoaded] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const dbWorkspaces = await loadWorkspaces();
        if (dbWorkspaces && dbWorkspaces.length > 0) {
          setWorkspaces(dbWorkspaces);
          const savedActiveWs = await getSetting("activeWorkspaceId");
          const validId = dbWorkspaces.find((w) => w.id === savedActiveWs)?.id;
          setActiveWorkspaceId(validId ?? dbWorkspaces[0].id);
        } else {
          setWorkspaces((prev) => {
            setActiveWorkspaceId(prev[0].id);
            return prev;
          });
        }
        const savedMode = await getSetting("appMode");
        if (savedMode === "terminal" || savedMode === "orchestrator" || savedMode === "zen" || savedMode === "editor") {
          setAppMode(savedMode as any);
        }
        const savedSentinel = await getSetting("sentinelEnabled");
        if (savedSentinel !== null) setSentinelEnabled(savedSentinel === "true");
        const savedHitl = await getSetting("hitlEnabled");
        if (savedHitl !== null) setHitlEnabled(savedHitl === "true");
      } catch (err) {
        console.error("[didi] Failed to load data from DB:", err);
      } finally {
        setIsDbLoaded(true);
      }
    }
    loadData();
  }, [setWorkspaces, setActiveWorkspaceId, setAppMode, setSentinelEnabled, setHitlEnabled]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = activeWorkspace?.directory || null;
  const activeSection = activeWorkspace?.sections.find((s) => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const allAgents = getUniqueAgents(tabs.flatMap((t: TerminalTab) => t.agents));

  useEffect(() => {
    agentsRef.current = allAgents;
  }, [allAgents]);

  useEffect(() => {
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    hitlEnabledRef.current = hitlEnabled;
  }, [hitlEnabled]);

  useEffect(() => {
    sentinelEnabledRef.current = sentinelEnabled;
  }, [sentinelEnabled]);

  const crud = useWorkspaceCrud(addLog);

  usePersistence(isDbLoaded);
  useProjectChange(
    currentProject,
    currentProjectRef,
    crud.refreshSnapshots,
    masterPlanWorkflow.resetMasterPlanWorkflow
  );
  useCodeReviewStats(currentProject);
  usePortCount(isDbLoaded);
  useConfigFetcher();
  useAgentStateListener();
  useSentinel(sentinelEnabledRef, sentinelStates, addLog);
  useHandoffListeners({
    currentProjectRef,
    agentsRef,
    pendingHandoffs,
    readyAgents,
    hitlEnabledRef,
    activeMasterPlanTask,
    syncMasterPlanQueueState: masterPlanWorkflow.syncMasterPlanQueueState,
    dispatchNextMasterPlanTask: masterPlanWorkflow.dispatchNextMasterPlanTask,
    syncPlanTaskStatusByText: masterPlanWorkflow.syncPlanTaskStatusByText,
    trackAgentPlanTask: masterPlanWorkflow.trackAgentPlanTask,
    popAgentPlanTask: masterPlanWorkflow.popAgentPlanTask,
    recordBrainstormResponse: brainstormWorkflow.recordBrainstormResponse,
    writeHandoff: handoffService.writeHandoff,
    queueHandoff: handoffService.queueHandoff,
    flushQueuedHandoff: handoffService.flushQueuedHandoff,
    addLog,
  });
  useOmnibarShortcut();
  useZenHotkeys();

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("appMode", appMode).catch(console.error);
  }, [appMode, isDbLoaded]);

  return {
    appMode,
    setAppMode,
  };
}

export type AppController = ReturnType<typeof useAppController>;
