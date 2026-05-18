import { useEffect } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { AppMode } from "../types/workspace";
import { matchesKeys } from "./keybindings";
import { getTerminalLanePtyKey } from "./terminal-lanes";

interface UseZenHotkeysParams {
  appMode: AppMode;
  setAppMode: (mode: any) => void;
  activeWorkspaceId: string;
  zenAgents: string[];
  setZenAgents: (agents: any) => void;
  setZenLayout: (layout: any) => void;
  lastActiveZenAgent: string | null;
  setLastActiveZenAgent: (agent: any) => void;
  focusedZenAgent: string | null;
  setFocusedZenAgent: (agent: any) => void;
}

export const useZenHotkeys = ({
  appMode,
  setAppMode,
  activeWorkspaceId,
  zenAgents,
  setZenAgents,
  setZenLayout,
  lastActiveZenAgent,
  setLastActiveZenAgent,
  focusedZenAgent,
  setFocusedZenAgent,
}: UseZenHotkeysParams) => {
  useEffect(() => {
    const zenWorkspaceId = `zen::${activeWorkspaceId}`;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeys(e, "zen-toggle")) {
        e.preventDefault();
        e.stopPropagation();
        setAppMode(appMode === "zen" ? "terminal" : "zen");
      }

      if (appMode === "zen") {
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
          setZenAgents((prev: any) => [...prev, newId]);
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
            setZenAgents((prev: any) => {
              const next = prev.filter((a: any) => a !== target);
              setLastActiveZenAgent(next[next.length - 1]);
              return next;
            });
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
  }, [activeWorkspaceId, appMode, focusedZenAgent, lastActiveZenAgent, zenAgents]);
};
