import { useEffect, type Dispatch, type SetStateAction } from "react";
import { emit } from "@tauri-apps/api/event";
import type { AppMode, ZenLayoutOrientation } from "../types/workspace";
import { matchesKeys } from "./keybindings";

interface UseZenHotkeysParams {
  appMode: AppMode;
  setAppMode: Dispatch<SetStateAction<AppMode>>;
  zenAgents: string[];
  setZenAgents: Dispatch<SetStateAction<string[]>>;
  setZenLayout: Dispatch<SetStateAction<ZenLayoutOrientation>>;
  lastActiveZenAgent: string | null;
  setLastActiveZenAgent: Dispatch<SetStateAction<string | null>>;
  focusedZenAgent: string | null;
  setFocusedZenAgent: Dispatch<SetStateAction<string | null>>;
}

export const useZenHotkeys = ({
  appMode,
  setAppMode,
  zenAgents,
  setZenAgents,
  setZenLayout,
  lastActiveZenAgent,
  setLastActiveZenAgent,
  focusedZenAgent,
  setFocusedZenAgent,
}: UseZenHotkeysParams) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchesKeys(e, "zen-toggle")) {
        e.preventDefault();
        e.stopPropagation();
        setAppMode(prev => (prev === "zen" ? "terminal" : "zen"));
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
          setZenAgents(prev => [...prev, newId]);
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
            setZenAgents(prev => {
              const next = prev.filter(a => a !== target);
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
  }, [appMode, zenAgents.length]);
};
