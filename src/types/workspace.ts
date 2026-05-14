export type AppMode = "terminal" | "orchestrator" | "zen";

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

export interface TerminalTab {
  id: string;
  name: string;
  agents: string[];
  layoutOrientation: TerminalLayoutOrientation;
}

export interface SectionState {
  id: string;
  name: string;
  tabs: TerminalTab[];
  activeTabId?: string;
}

export interface WorkspaceState {
  id: string;
  name: string;
  directory: string | null;
  sections: SectionState[];
  activeSectionId: string;
  activeTabId?: string;
}
