import { useWorkspaceStore } from "./stores/workspace-store";
import { useWorkspaceCrud } from "./use-workspace-crud";
import { addLog } from "./logger";
import type { TerminalTab } from "../types/workspace";

export function useWorkspaceController() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const crud = useWorkspaceCrud(addLog);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = activeWorkspace?.directory || null;
  const activeSection = activeWorkspace?.sections.find((s) => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const activeTabId = activeSection?.activeTabId || activeWorkspace?.activeTabId || "";
  const activeTab = tabs.find((t: TerminalTab) => t.id === activeTabId) || tabs[0];
  const layoutOrientation = activeTab ? activeTab.layoutOrientation : "horizontal";

  return {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    currentProject,
    activeSection,
    tabs,
    activeTabId,
    activeTab,
    layoutOrientation,
    ...crud,
  };
}
