export type AppMode = "terminal" | "orchestrator" | "zen" | "editor";

export type TerminalLayoutOrientation =
  | "horizontal"
  | "vertical"
  | "grid"
  | "focus"
  | "presentation"
  | "canvas"
  | "waterfall"
  | "dynamic";

export type ZenLayoutOrientation = "horizontal" | "vertical" | "grid";

export interface AgentInstance {
  id: string;
  name: string;
}

export interface TerminalTab {
  id: string;
  name: string;
  agents: AgentInstance[];
  layoutOrientation: TerminalLayoutOrientation;
}

export type MergedTabPair = [string, string];

export interface SectionState {
  id: string;
  name: string;
  tabs: TerminalTab[];
  activeTabId?: string;
  mergedTabPairs?: MergedTabPair[];
  mergedTabPair?: MergedTabPair | null;
}

export interface WorkspaceState {
  id: string;
  name: string;
  directory: string | null;
  sections: SectionState[];
  activeSectionId: string;
  activeTabId?: string;
}
