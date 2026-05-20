import { create } from 'zustand';
import type { AppMode } from '../../types/workspace';

interface UIState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  
  openPanel: string | null;
  setOpenPanel: (panel: string | null) => void;
  togglePanel: (panel: string) => void;

  isTasksCollapsed: boolean;
  setIsTasksCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  isActivityCollapsed: boolean;
  setIsActivityCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  
  showSecurityPanel: string | null;
  setShowSecurityPanel: (id: string | null) => void;
  pendingWorkspaceId: string | null;
  setPendingWorkspaceId: (id: string | null) => void;

  sidecarStatus: string;
  setSidecarStatus: (status: string | ((prev: string) => string)) => void;
  isGlass: boolean;
  setIsGlass: (glass: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  appMode: "terminal",
  setAppMode: (appMode) => set({ appMode }),
  isSidebarOpen: false,
  setIsSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  openPanel: null,
  setOpenPanel: (openPanel) => set({ openPanel }),
  togglePanel: (panel) => set((state) => ({ openPanel: state.openPanel === panel ? null : panel })),

  isTasksCollapsed: false,
  setIsTasksCollapsed: (val) => set((state) => ({ isTasksCollapsed: typeof val === 'function' ? val(state.isTasksCollapsed) : val })),
  isActivityCollapsed: false,
  setIsActivityCollapsed: (val) => set((state) => ({ isActivityCollapsed: typeof val === 'function' ? val(state.isActivityCollapsed) : val })),

  showSecurityPanel: null,
  setShowSecurityPanel: (showSecurityPanel) => set({ showSecurityPanel }),
  pendingWorkspaceId: null,
  setPendingWorkspaceId: (pendingWorkspaceId) => set({ pendingWorkspaceId }),

  sidecarStatus: "Checking...",
  setSidecarStatus: (val) => set((state) => ({ sidecarStatus: typeof val === 'function' ? val(state.sidecarStatus) : val })),

  isGlass: false,
  setIsGlass: (isGlass) => set({ isGlass }),
}));
