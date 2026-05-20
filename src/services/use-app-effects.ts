import { useEffect } from "react";
import type { MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { eventBus } from "./event-bus";
import { useUIStore } from "./stores/ui-store";
import { useAgentStore } from "./stores/agent-store";
import { useGitStore } from "./stores/git-store";
import { useOrchestrationStore } from "./stores/orchestration-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { setSetting, saveWorkspaces } from "./db-service";
import { registerSentinelMonitoring } from "./sentinel-service";
import { registerHandoffListeners } from "./handoff-service";
import { matchesKeys } from "./keybindings";
import type { ActiveMasterPlanTask, BrainstormResponsePayload, SentinelAgentState } from "./app-core";
import type { AgentInstance } from "../types/workspace";

export function usePersistence(isDbLoaded: boolean) {
  const hitlEnabled = useOrchestrationStore(s => s.hitlEnabled);
  const sentinelEnabled = useOrchestrationStore(s => s.sentinelEnabled);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore(s => s.workspaces);

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("hitlEnabled", String(hitlEnabled)).catch(console.error);
  }, [hitlEnabled, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("sentinelEnabled", String(sentinelEnabled)).catch(console.error);
  }, [sentinelEnabled, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    setSetting("activeWorkspaceId", activeWorkspaceId).catch(console.error);
  }, [activeWorkspaceId, isDbLoaded]);

  useEffect(() => {
    if (!isDbLoaded) return;
    const timeout = setTimeout(() => {
      saveWorkspaces(workspaces).catch(e => console.error("[didi] Save failed:", e));
    }, 500);
    return () => clearTimeout(timeout);
  }, [workspaces, isDbLoaded]);
}

export function useProjectChange(
  currentProject: string | null,
  currentProjectRef: MutableRefObject<string | null>,
  refreshSnapshots: (project?: string | null) => Promise<void>,
  resetMasterPlanWorkflow: () => void,
) {
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem("didi_project", currentProject);
    } else {
      localStorage.removeItem("didi_project");
    }
    currentProjectRef.current = currentProject;
    resetMasterPlanWorkflow();
    refreshSnapshots(currentProject);
  }, [currentProject, currentProjectRef, refreshSnapshots, resetMasterPlanWorkflow]);
}

export function useCodeReviewStats(currentProject: string | null) {
  const setCodeReviewStats = useGitStore(s => s.setCodeReviewStats);

  useEffect(() => {
    if (!currentProject) {
      setCodeReviewStats({ additions: 0, deletions: 0 });
      return;
    }

    let cancelled = false;
    let isRefreshing = false;

    const refresh = async () => {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const stats = await invoke<{ totalAdditions: number; totalDeletions: number }>("get_git_diff_stats", { cwd: currentProject });
        if (!cancelled) {
          setCodeReviewStats(prev => {
            if (prev.additions === stats.totalAdditions && prev.deletions === stats.totalDeletions) return prev;
            return { additions: stats.totalAdditions, deletions: stats.totalDeletions };
          });
        }
      } catch {
        if (!cancelled) {
          setCodeReviewStats(prev => {
            if (prev.additions === 0 && prev.deletions === 0) return prev;
            return { additions: 0, deletions: 0 };
          });
        }
      } finally {
        isRefreshing = false;
      }
    };

    refresh();
    const unsub = eventBus.subscribe("git-status-changed", () => refresh());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [currentProject, setCodeReviewStats]);
}

export function usePortCount(isDbLoaded: boolean) {
  const appMode = useUIStore(s => s.appMode);
  const showPortManager = useUIStore(s => s.showPortManager);
  const setPortCount = useAgentStore(s => s.setPortCount);

  useEffect(() => {
    if (!isDbLoaded || showPortManager || appMode === "zen" || appMode === "editor") return;

    let cancelled = false;
    let isRefreshing = false;

    const refresh = async () => {
      if (isRefreshing) return;
      isRefreshing = true;
      try {
        const result = await invoke<unknown[]>("get_active_ports");
        if (!cancelled) {
          setPortCount(result.length);
        }
      } catch {
      } finally {
        isRefreshing = false;
      }
    };

    refresh();
    const unsub = eventBus.subscribe("ports-changed", () => refresh());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [appMode, isDbLoaded, showPortManager, setPortCount]);
}

export function useConfigFetcher() {
  const setIsGlass = useUIStore(s => s.setIsGlass);
  const setSidecarStatus = useUIStore(s => s.setSidecarStatus);

  useEffect(() => {
    const fetchConfig = () => {
      invoke<any>("get_config").then(config => {
        document.documentElement.style.setProperty("--tw-colors-brand-accent", config.theme_cyan);
        document.documentElement.style.setProperty("--tw-colors-brand-warn", config.theme_amber);
        setIsGlass(!!config.glassmorphism);
        if (config.theme_mode === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        if (config.glassmorphism) {
          document.documentElement.classList.add("glass");
        } else {
          document.documentElement.classList.remove("glass");
        }
      }).catch(console.error);
    };

    fetchConfig();
    const unlisten = listen("config-updated", () => fetchConfig());
    const interval = setInterval(() => {
      invoke<string>("get_sidecar_status").then(setSidecarStatus).catch(() => setSidecarStatus("Error"));
    }, 5000);
    return () => {
      clearInterval(interval);
      unlisten.then(f => f());
    };
  }, [setIsGlass, setSidecarStatus]);
}

export function useAgentStateListener() {
  const setAgentStatusMap = useAgentStore(s => s.setAgentStatusMap);

  useEffect(() => {
    const unlisten = listen<{ agent: string; isReady: boolean }>("agent-state", (event) => {
      setAgentStatusMap(prev => ({
        ...prev,
        [event.payload.agent]: event.payload.isReady,
      }));
    });
    return () => {
      unlisten.then(f => f());
    };
  }, [setAgentStatusMap]);
}

export function useSentinel(
  sentinelEnabledRef: MutableRefObject<boolean>,
  sentinelStates: MutableRefObject<Map<string, SentinelAgentState>>,
  addLog: (message: string, type?: "system" | "handoff") => void,
) {
  useEffect(() => {
    const setSentinelIncidents = useOrchestrationStore.getState().setSentinelIncidents;
    return registerSentinelMonitoring({ sentinelEnabledRef, sentinelStates, setSentinelIncidents, addLog });
  }, [sentinelEnabledRef, sentinelStates, addLog]);
}

interface HandoffListenersOptions {
  currentProjectRef: MutableRefObject<string | null>;
  agentsRef: MutableRefObject<AgentInstance[]>;
  pendingHandoffs: MutableRefObject<Map<string, string[]>>;
  readyAgents: MutableRefObject<Set<string>>;
  hitlEnabledRef: MutableRefObject<boolean>;
  activeMasterPlanTask: MutableRefObject<ActiveMasterPlanTask | null>;
  syncMasterPlanQueueState: () => void;
  dispatchNextMasterPlanTask: () => void;
  syncPlanTaskStatusByText: (text: string, status: "in_progress" | "done") => Promise<void>;
  trackAgentPlanTask: (agentName: string, text: string) => void;
  popAgentPlanTask: (agentName: string) => string | null;
  recordBrainstormResponse: (agent: string, response: BrainstormResponsePayload) => Promise<void>;
  writeHandoff: (agentKey: string, payload: string) => void;
  queueHandoff: (agentKey: string, payload: string) => void;
  flushQueuedHandoff: (agentKey: string) => void;
  addLog: (message: string, type?: "system" | "handoff") => void;
}

export function useHandoffListeners(opts: HandoffListenersOptions) {
  useEffect(() => {
    const setTasks = useOrchestrationStore.getState().setTasks;
    const setSnapshots = useGitStore.getState().setSnapshots;
    const setApprovalRequest = useOrchestrationStore.getState().setApprovalRequest;

    return registerHandoffListeners({
      ...opts,
      setTasks,
      setSnapshots,
      setApprovalRequest,
    });
  }, [
    opts.currentProjectRef,
    opts.agentsRef,
    opts.pendingHandoffs,
    opts.readyAgents,
    opts.hitlEnabledRef,
    opts.activeMasterPlanTask,
    opts.syncMasterPlanQueueState,
    opts.dispatchNextMasterPlanTask,
    opts.syncPlanTaskStatusByText,
    opts.trackAgentPlanTask,
    opts.popAgentPlanTask,
    opts.recordBrainstormResponse,
    opts.writeHandoff,
    opts.queueHandoff,
    opts.flushQueuedHandoff,
    opts.addLog,
  ]);
}

export function useOmnibarShortcut() {
  const setShowOmnibar = useUIStore(s => s.setShowOmnibar);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeys(e, "quick-palette")) {
        e.preventDefault();
        e.stopPropagation();
        setShowOmnibar(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [setShowOmnibar]);
}
