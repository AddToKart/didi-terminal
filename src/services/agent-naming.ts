import type { AgentInstance } from "@/types/workspace";

const hasAgentName = (agents: AgentInstance[], name: string) => {
  const normalizedName = name.trim().toLowerCase();
  return agents.some(agent => agent.name.trim().toLowerCase() === normalizedName);
};

export const getUniqueAgentNameInTab = (agents: AgentInstance[], requestedName: string) => {
  const trimmedName = requestedName.trim();

  if (!trimmedName) {
    let counter = 1;
    let fallbackName = `Terminal ${counter}`;
    while (hasAgentName(agents, fallbackName)) {
      counter++;
      fallbackName = `Terminal ${counter}`;
    }
    return fallbackName;
  }

  let counter = 1;
  let nextName = trimmedName;
  while (hasAgentName(agents, nextName)) {
    counter++;
    nextName = `${trimmedName}-${counter}`;
  }
  return nextName;
};

export const getSplitAgentNameInTab = (agents: AgentInstance[], sourceName: string) => {
  const baseName = sourceName.replace(/-\d+$/, "");
  let counter = 1;
  let nextName = `${baseName}-${counter}`;

  while (hasAgentName(agents, nextName)) {
    counter++;
    nextName = `${baseName}-${counter}`;
  }

  return nextName;
};
