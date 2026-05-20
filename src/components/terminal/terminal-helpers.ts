import type { TerminalLane } from "../../services/terminal-lanes";

export const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

export const CLI_PROFILES = [
  {
    name: "opencode",
    patterns: ["Ask anything", "Build ·", "commands"],
  },
  {
    name: "copilot",
    patterns: ["GitHub Copilot", "ctrl+p commands", "commands ? help"],
  },
  {
    name: "gemini",
    patterns: ["Type your message", "Type your message or @path/to/file", "Gemini CLI"],
  },
  {
    name: "shell",
    patterns: ["PS ", "$ ", ">>> "],
  },
];

export const isPromptReady = (value: string) =>
  CLI_PROFILES.some(profile => profile.patterns.some(pattern => value.includes(pattern))) ||
  /(^|\s)>($|\s)/.test(value);

export const getAgentId = (agentName: string) =>
  agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export const getPtyEventKey = (agent: string) => agent.replace(/[^a-zA-Z0-9]/g, "_");

export const STATS_REFRESH_MS = 10000;

export interface PtyOutputPayload {
  agent: string;
  workspace?: string;
  data: string;
  bytes?: string | number[];
}

export interface PtyScrollback {
  data: string;
  bytes?: string | number[];
}

export const decodeBase64Bytes = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const getTerminalWritePayload = (payload: Pick<PtyOutputPayload, "data" | "bytes">) => {
  if (typeof payload.bytes === "string" && payload.bytes.length > 0) {
    return decodeBase64Bytes(payload.bytes);
  }
  if (Array.isArray(payload.bytes) && payload.bytes.length > 0) {
    return new Uint8Array(payload.bytes);
  }
  return payload.data;
};

export const getNextLaneIndex = (lanes: TerminalLane[]) => {
  const usedIndexes = new Set(
    lanes
      .map(lane => lane.agentName.match(/\slane\s(\d+)$/i)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(value => Number(value))
  );
  let index = 2;
  while (usedIndexes.has(index)) index += 1;
  return index;
};
