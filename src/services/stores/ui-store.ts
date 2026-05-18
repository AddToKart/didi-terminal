import { create } from 'zustand';
import type { AppMode } from '../../types/workspace';

interface UIState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  
  showNetworkGraph: boolean;
  setShowNetworkGraph: (show: boolean | ((prev: boolean) => boolean)) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean | ((prev: boolean) => boolean)) => void;
  showBrainstorm: boolean;
  setShowBrainstorm: (show: boolean | ((prev: boolean) => boolean)) => void;
  showMasterPlan: boolean;
  setShowMasterPlan: (show: boolean | ((prev: boolean) => boolean)) => void;
  
  isTasksCollapsed: boolean;
  setIsTasksCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  isActivityCollapsed: boolean;
  setIsActivityCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  
  showCodeReview: boolean;
  setShowCodeReview: (show: boolean | ((prev: boolean) => boolean)) => void;
  showGitPanel: boolean;
  setShowGitPanel: (show: boolean | ((prev: boolean) => boolean)) => void;
  showGitFullscreen: boolean;
  setShowGitFullscreen: (show: boolean | ((prev: boolean) => boolean)) => void;
  
  showPersonalKanban: boolean;
  setShowPersonalKanban: (show: boolean | ((prev: boolean) => boolean)) => void;
  showCalendar: boolean;
  setShowCalendar: (show: boolean | ((prev: boolean) => boolean)) => void;
  showFileExplorer: boolean;
  setShowFileExplorer: (show: boolean | ((prev: boolean) => boolean)) => void;
  showPortManager: boolean;
  setShowPortManager: (show: boolean | ((prev: boolean) => boolean)) => void;
  showEnvManager: boolean;
  setShowEnvManager: (show: boolean | ((prev: boolean) => boolean)) => void;
  showPackageManager: boolean;
  setShowPackageManager: (show: boolean | ((prev: boolean) => boolean)) => void;
  
  showApiLab: boolean;
  setShowApiLab: (show: boolean | ((prev: boolean) => boolean)) => void;
  showMonorepoGraph: boolean;
  setShowMonorepoGraph: (show: boolean | ((prev: boolean) => boolean)) => void;
  showDbViewer: boolean;
  setShowDbViewer: (show: boolean | ((prev: boolean) => boolean)) => void;
  showMdViewer: boolean;
  setShowMdViewer: (show: boolean | ((prev: boolean) => boolean)) => void;
  showConfigEditor: boolean;
  setShowConfigEditor: (show: boolean | ((prev: boolean) => boolean)) => void;
  showIconBrowser: boolean;
  setShowIconBrowser: (show: boolean | ((prev: boolean) => boolean)) => void;
  showTailwindLabs: boolean;
  setShowTailwindLabs: (show: boolean | ((prev: boolean) => boolean)) => void;
  showNpmLookup: boolean;
  setShowNpmLookup: (show: boolean | ((prev: boolean) => boolean)) => void;
  showHtmlToJsx: boolean;
  setShowHtmlToJsx: (show: boolean | ((prev: boolean) => boolean)) => void;
  showSvgOptimizer: boolean;
  setShowSvgOptimizer: (show: boolean | ((prev: boolean) => boolean)) => void;
  showStorageInspector: boolean;
  setShowStorageInspector: (show: boolean | ((prev: boolean) => boolean)) => void;
  showQuickPalette: boolean;
  setShowQuickPalette: (show: boolean | ((prev: boolean) => boolean)) => void;
  showMockDataGenerator: boolean;
  setShowMockDataGenerator: (show: boolean | ((prev: boolean) => boolean)) => void;
  
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

  sidecarStatus: "Checking...",
  setSidecarStatus: (val) => set((state) => ({ sidecarStatus: typeof val === 'function' ? val(state.sidecarStatus) : val })),

  showNetworkGraph: false,
  setShowNetworkGraph: (val) => set((state) => ({ showNetworkGraph: typeof val === 'function' ? val(state.showNetworkGraph) : val })),
  showSettings: false,
  setShowSettings: (val) => set((state) => ({ showSettings: typeof val === 'function' ? val(state.showSettings) : val })),
  showBrainstorm: false,
  setShowBrainstorm: (val) => set((state) => ({ showBrainstorm: typeof val === 'function' ? val(state.showBrainstorm) : val })),
  showMasterPlan: false,
  setShowMasterPlan: (val) => set((state) => ({ showMasterPlan: typeof val === 'function' ? val(state.showMasterPlan) : val })),
  
  isTasksCollapsed: false,
  setIsTasksCollapsed: (val) => set((state) => ({ isTasksCollapsed: typeof val === 'function' ? val(state.isTasksCollapsed) : val })),
  isActivityCollapsed: false,
  setIsActivityCollapsed: (val) => set((state) => ({ isActivityCollapsed: typeof val === 'function' ? val(state.isActivityCollapsed) : val })),
  
  showCodeReview: false,
  setShowCodeReview: (val) => set((state) => ({ showCodeReview: typeof val === 'function' ? val(state.showCodeReview) : val })),
  showGitPanel: false,
  setShowGitPanel: (val) => set((state) => ({ showGitPanel: typeof val === 'function' ? val(state.showGitPanel) : val })),
  showGitFullscreen: false,
  setShowGitFullscreen: (val) => set((state) => ({ showGitFullscreen: typeof val === 'function' ? val(state.showGitFullscreen) : val })),
  
  showPersonalKanban: false,
  setShowPersonalKanban: (val) => set((state) => ({ showPersonalKanban: typeof val === 'function' ? val(state.showPersonalKanban) : val })),
  showCalendar: false,
  setShowCalendar: (val) => set((state) => ({ showCalendar: typeof val === 'function' ? val(state.showCalendar) : val })),
  showFileExplorer: false,
  setShowFileExplorer: (val) => set((state) => ({ showFileExplorer: typeof val === 'function' ? val(state.showFileExplorer) : val })),
  showPortManager: false,
  setShowPortManager: (val) => set((state) => ({ showPortManager: typeof val === 'function' ? val(state.showPortManager) : val })),
  showEnvManager: false,
  setShowEnvManager: (val) => set((state) => ({ showEnvManager: typeof val === 'function' ? val(state.showEnvManager) : val })),
  showPackageManager: false,
  setShowPackageManager: (val) => set((state) => ({ showPackageManager: typeof val === 'function' ? val(state.showPackageManager) : val })),
  
  showApiLab: false,
  setShowApiLab: (val) => set((state) => ({ showApiLab: typeof val === 'function' ? val(state.showApiLab) : val })),
  showMonorepoGraph: false,
  setShowMonorepoGraph: (val) => set((state) => ({ showMonorepoGraph: typeof val === 'function' ? val(state.showMonorepoGraph) : val })),
  showDbViewer: false,
  setShowDbViewer: (val) => set((state) => ({ showDbViewer: typeof val === 'function' ? val(state.showDbViewer) : val })),
  showMdViewer: false,
  setShowMdViewer: (val) => set((state) => ({ showMdViewer: typeof val === 'function' ? val(state.showMdViewer) : val })),
  showConfigEditor: false,
  setShowConfigEditor: (val) => set((state) => ({ showConfigEditor: typeof val === 'function' ? val(state.showConfigEditor) : val })),
  showIconBrowser: false,
  setShowIconBrowser: (val) => set((state) => ({ showIconBrowser: typeof val === 'function' ? val(state.showIconBrowser) : val })),
  showTailwindLabs: false,
  setShowTailwindLabs: (val) => set((state) => ({ showTailwindLabs: typeof val === 'function' ? val(state.showTailwindLabs) : val })),
  showNpmLookup: false,
  setShowNpmLookup: (val) => set((state) => ({ showNpmLookup: typeof val === 'function' ? val(state.showNpmLookup) : val })),
  showHtmlToJsx: false,
  setShowHtmlToJsx: (val) => set((state) => ({ showHtmlToJsx: typeof val === 'function' ? val(state.showHtmlToJsx) : val })),
  showSvgOptimizer: false,
  setShowSvgOptimizer: (val) => set((state) => ({ showSvgOptimizer: typeof val === 'function' ? val(state.showSvgOptimizer) : val })),
  showStorageInspector: false,
  setShowStorageInspector: (val) => set((state) => ({ showStorageInspector: typeof val === 'function' ? val(state.showStorageInspector) : val })),
  showQuickPalette: false,
  setShowQuickPalette: (val) => set((state) => ({ showQuickPalette: typeof val === 'function' ? val(state.showQuickPalette) : val })),
  showMockDataGenerator: false,
  setShowMockDataGenerator: (val) => set((state) => ({ showMockDataGenerator: typeof val === 'function' ? val(state.showMockDataGenerator) : val })),
  
  showSecurityPanel: null,
  setShowSecurityPanel: (showSecurityPanel) => set({ showSecurityPanel }),
  pendingWorkspaceId: null,
  setPendingWorkspaceId: (pendingWorkspaceId) => set({ pendingWorkspaceId }),

  isGlass: false,
  setIsGlass: (isGlass) => set({ isGlass }),
}));
