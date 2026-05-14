import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { SentinelIncident } from "../components/panels/SentinelPanel";
import {
  getPtyKey,
  isFailureOutput,
  normalizeLoopSignature,
  stripTerminalControls,
  type SentinelAgentState,
  type TerminalInputPayload,
  type TerminalOutputPayload,
} from "./app-core";

interface RegisterSentinelMonitoringOptions {
  sentinelEnabledRef: MutableRefObject<boolean>;
  sentinelStates: MutableRefObject<Map<string, SentinelAgentState>>;
  setSentinelIncidents: Dispatch<SetStateAction<SentinelIncident[]>>;
  addLog: (message: string, type?: "system" | "handoff") => void;
}

export const registerSentinelMonitoring = ({
  sentinelEnabledRef,
  sentinelStates,
  setSentinelIncidents,
  addLog,
}: RegisterSentinelMonitoringOptions) => {
  const getState = (agent: string): SentinelAgentState => {
    const key = getPtyKey(agent);
    const existing = sentinelStates.current.get(key);
    if (existing) return existing;

    const next: SentinelAgentState = {
      inputBuffer: "",
      lastCommand: "",
      lastFailureCommand: "",
      failureCount: 0,
      lastFailureAt: 0,
      lastSignature: "",
      signatureCount: 0,
      lastInterventionAt: 0,
    };
    sentinelStates.current.set(key, next);
    return next;
  };

  const intervene = (agent: string, reason: string, command?: string) => {
    const key = getPtyKey(agent);
    const state = getState(key);
    const now = Date.now();
    if (now - state.lastInterventionAt < 45000) return;

    state.lastInterventionAt = now;
    state.failureCount = 0;
    state.signatureCount = 0;

    const prompt = "You are stuck in a loop. Sentinel paused you because "
      + `${reason}. Try a different approach, inspect the actual error, or ask another agent for help. `
      + "Do not retry the same command again unchanged.";
    invoke("write_pty", { agent: key, data: "\u001b\u001b\u001b\u001b" }).catch(console.error);
    setTimeout(() => {
      invoke("write_pty", { agent: key, data: prompt }).catch(console.error);
    }, 300);
    setTimeout(() => {
      invoke("write_pty", { agent: key, data: "\r" }).catch(console.error);
    }, 700);

    const incident: SentinelIncident = {
      id: `${now}-${key}`,
      agent,
      reason,
      command,
      at: new Date().toLocaleTimeString(),
    };
    setSentinelIncidents(prev => [incident, ...prev].slice(0, 20));
    addLog(`Sentinel paused ${agent}: ${reason}`, "system");
    emit("sentinel-intervention", incident).catch(console.error);
  };

  const unlistenInput = listen<TerminalInputPayload>("agent-input", (event) => {
    if (!sentinelEnabledRef.current) return;

    const key = getPtyKey(event.payload.agent);
    const state = getState(key);
    for (const char of event.payload.data) {
      if (char === "\r" || char === "\n") {
        const command = stripTerminalControls(state.inputBuffer).trim();
        if (command) state.lastCommand = command.slice(-240);
        state.inputBuffer = "";
        continue;
      }

      if (char === "\u007f" || char === "\b") {
        state.inputBuffer = state.inputBuffer.slice(0, -1);
        continue;
      }

      if (char >= " " && char !== "\u001b") {
        state.inputBuffer = `${state.inputBuffer}${char}`.slice(-400);
      }
    }
  });

  const unlistenOutput = listen<TerminalOutputPayload>("pty-output", (event) => {
    if (!sentinelEnabledRef.current) return;

    const key = getPtyKey(event.payload.agent);
    const state = getState(key);
    const text = stripTerminalControls(event.payload.data);
    const signature = normalizeLoopSignature(text);
    if (signature.length > 40 && signature === state.lastSignature) {
      state.signatureCount += 1;
    } else if (signature.length > 40) {
      state.lastSignature = signature;
      state.signatureCount = 1;
    }

    if (state.signatureCount >= 4) {
      intervene(key, "the same terminal output repeated several times", state.lastCommand);
      return;
    }

    if (!state.lastCommand || !isFailureOutput(text)) return;

    const now = Date.now();
    const sameCommand = state.lastFailureCommand === state.lastCommand && now - state.lastFailureAt < 180000;
    state.failureCount = sameCommand ? state.failureCount + 1 : 1;
    state.lastFailureCommand = state.lastCommand;
    state.lastFailureAt = now;

    if (state.failureCount >= 3) {
      intervene(key, "the same command appears to have failed 3 times", state.lastCommand);
    }
  });

  return () => {
    unlistenInput.then(f => f());
    unlistenOutput.then(f => f());
  };
};
