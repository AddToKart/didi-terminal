import { create } from 'zustand';
import type { WorkspaceState } from '../../types/workspace';

interface WorkspaceStoreState {
  workspaces: WorkspaceState[];
  setWorkspaces: (workspaces: WorkspaceState[] | ((prev: WorkspaceState[]) => WorkspaceState[])) => void;
  
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string | ((prev: string) => string)) => void;
}

const defaultSectionId = crypto.randomUUID();
const defaultWorkspace: WorkspaceState = {
  id: crypto.randomUUID(),
  name: "Workspace 1",
  directory: null,
  sections: [{ id: defaultSectionId, name: "Section 1", tabs: [] }],
  activeTabId: "",
  activeSectionId: defaultSectionId
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  workspaces: [defaultWorkspace],
  setWorkspaces: (val) => set((state) => ({ workspaces: typeof val === 'function' ? val(state.workspaces) : val })),
  
  activeWorkspaceId: defaultWorkspace.id,
  setActiveWorkspaceId: (val) => set((state) => ({ activeWorkspaceId: typeof val === 'function' ? val(state.activeWorkspaceId) : val })),
}));
