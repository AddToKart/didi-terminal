import { useEffect } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { matchesKeys } from "./keybindings";
import { getTerminalLanePtyKey } from "./terminal-lanes";
import { useUIStore } from "./stores/ui-store";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useAgentStore } from "./stores/agent-store";

export const useZenHotkeys = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const appMode = useUIStore.getState().appMode;
      const setAppMode = useUIStore.getState().setAppMode;
      const activeWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      const zenWorkspaceId = `zen::${activeWorkspaceId}`;

      if (matchesKeys(e, "zen-toggle")) {
        e.preventDefault();
        e.stopPropagation();
        setAppMode(appMode === "zen" ? "terminal" : "zen");
      }

      if (appMode === "zen") {
        const zenAgents = useAgentStore.getState().zenAgents;
        const setZenAgents = useAgentStore.getState().setZenAgents;
        const setZenLayout = useAgentStore.getState().setZenLayout;
        const lastActiveZenAgent = useAgentStore.getState().lastActiveZenAgent;
        const setLastActiveZenAgent = useAgentStore.getState().setLastActiveZenAgent;
        const focusedZenAgent = useAgentStore.getState().focusedZenAgent;
        const setFocusedZenAgent = useAgentStore.getState().setFocusedZenAgent;

        if (matchesKeys(e, "zen-focus")) {
          e.preventDefault();
          e.stopPropagation();
          if (focusedZenAgent) {
            setFocusedZenAgent(null);
          } else if (lastActiveZenAgent) {
            setFocusedZenAgent(lastActiveZenAgent);
          }
        }

        if (matchesKeys(e, "zen-new")) {
          e.preventDefault();
          e.stopPropagation();
          setFocusedZenAgent(null);
          const newId = `zen-terminal-${crypto.randomUUID().slice(0, 4)}`;
          setZenAgents([...zenAgents, newId]);
          setLastActiveZenAgent(newId);
          setTimeout(() => emit("focus-agent", { agent: newId }), 100);
        }

        if (matchesKeys(e, "zen-layout-v")) {
          e.preventDefault();
          e.stopPropagation();
          setZenLayout("vertical");
        }

        if (matchesKeys(e, "zen-layout-h")) {
          e.preventDefault();
          e.stopPropagation();
          setZenLayout("horizontal");
        }

        if (matchesKeys(e, "zen-layout-g")) {
          e.preventDefault();
          e.stopPropagation();
          setZenLayout("grid");
        }

        if (matchesKeys(e, "zen-close")) {
          e.preventDefault();
          e.stopPropagation();
          setFocusedZenAgent(null);
          if (zenAgents.length > 1) {
            const target = lastActiveZenAgent || zenAgents[zenAgents.length - 1];
            invoke("close_pty", { agent: getTerminalLanePtyKey(zenWorkspaceId, target) }).catch(console.error);
            const next = zenAgents.filter((a) => a !== target);
            setZenAgents(next);
            setLastActiveZenAgent(next[next.length - 1]);
          } else {
            setAppMode("terminal");
          }
        }

        const digitMatch = e.code.match(/^Digit([1-9])$/);
        if (e.altKey && digitMatch) {
          const index = parseInt(digitMatch[1]) - 1;
          if (index < zenAgents.length) {
            e.preventDefault();
            e.stopPropagation();
            const targetAgent = zenAgents[index];
            setLastActiveZenAgent(targetAgent);
            if (focusedZenAgent) setFocusedZenAgent(targetAgent);
            emit("focus-agent", { agent: targetAgent }).catch(console.error);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);
};
