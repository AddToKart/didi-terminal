import { useUIStore } from "./stores/ui-store";

export function useUIController() {
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setIsSidebarOpen = useUIStore((s) => s.setIsSidebarOpen);
  
  const openPanel = useUIStore((s) => s.openPanel);
  const setOpenPanel = useUIStore((s) => s.setOpenPanel);
  const togglePanel = useUIStore((s) => s.togglePanel);

  const isTasksCollapsed = useUIStore((s) => s.isTasksCollapsed);
  const setIsTasksCollapsed = useUIStore((s) => s.setIsTasksCollapsed);
  const isActivityCollapsed = useUIStore((s) => s.isActivityCollapsed);
  const setIsActivityCollapsed = useUIStore((s) => s.setIsActivityCollapsed);

  const showSecurityPanel = useUIStore((s) => s.showSecurityPanel);
  const setShowSecurityPanel = useUIStore((s) => s.setShowSecurityPanel);
  const pendingWorkspaceId = useUIStore((s) => s.pendingWorkspaceId);
  const setPendingWorkspaceId = useUIStore((s) => s.setPendingWorkspaceId);
  const isGlass = useUIStore((s) => s.isGlass);
  const sidecarStatus = useUIStore((s) => s.sidecarStatus);

  // Helper generator to construct backward compatible setters that handle functional updates
  const makeSetter = (panelKey: string) => (val: boolean | ((prev: boolean) => boolean)) => {
    const isCurrent = openPanel === panelKey;
    const next = typeof val === 'function' ? val(isCurrent) : val;
    setOpenPanel(next ? panelKey : null);
  };

  return {
    appMode,
    setAppMode,
    isSidebarOpen,
    setIsSidebarOpen,
    
    // Unified panel hook accessors
    openPanel,
    setOpenPanel,
    togglePanel,

    // Dynamic boolean mappings
    showNetworkGraph: openPanel === 'networkgraph',
    setShowNetworkGraph: makeSetter('networkgraph'),
    
    showSettings: openPanel === 'settings',
    setShowSettings: makeSetter('settings'),
    
    showBrainstorm: openPanel === 'brainstorm',
    setShowBrainstorm: makeSetter('brainstorm'),
    
    showMasterPlan: openPanel === 'masterplan',
    setShowMasterPlan: makeSetter('masterplan'),
    
    isTasksCollapsed,
    setIsTasksCollapsed,
    isActivityCollapsed,
    setIsActivityCollapsed,
    
    showCodeReview: openPanel === 'codereview',
    setShowCodeReview: makeSetter('codereview'),
    
    showGitPanel: openPanel === 'git',
    setShowGitPanel: makeSetter('git'),
    
    showGitFullscreen: openPanel === 'gitfullscreen',
    setShowGitFullscreen: makeSetter('gitfullscreen'),
    
    showPersonalKanban: openPanel === 'kanban',
    setShowPersonalKanban: makeSetter('kanban'),
    
    showCalendar: openPanel === 'calendar',
    setShowCalendar: makeSetter('calendar'),
    
    showFileExplorer: openPanel === 'fileexplorer',
    setShowFileExplorer: makeSetter('fileexplorer'),
    
    showPortManager: openPanel === 'ports',
    setShowPortManager: makeSetter('ports'),
    
    showPortForwarding: openPanel === 'portforwarding',
    setShowPortForwarding: makeSetter('portforwarding'),
    
    showDockerManager: openPanel === 'docker',
    setShowDockerManager: makeSetter('docker'),
    
    showEnvManager: openPanel === 'env',
    setShowEnvManager: makeSetter('env'),
    
    showPackageManager: openPanel === 'packages',
    setShowPackageManager: makeSetter('packages'),
    
    showApiLab: openPanel === 'api',
    setShowApiLab: makeSetter('api'),
    
    showMonorepoGraph: openPanel === 'monorepograph',
    setShowMonorepoGraph: makeSetter('monorepograph'),
    
    showDbViewer: openPanel === 'db',
    setShowDbViewer: makeSetter('db'),
    
    showMdViewer: openPanel === 'md',
    setShowMdViewer: makeSetter('md'),
    
    showConfigEditor: openPanel === 'config',
    setShowConfigEditor: makeSetter('config'),
    
    showIconBrowser: openPanel === 'icons',
    setShowIconBrowser: makeSetter('icons'),
    
    showTailwindLabs: openPanel === 'tailwind',
    setShowTailwindLabs: makeSetter('tailwind'),
    
    showNpmLookup: openPanel === 'npm',
    setShowNpmLookup: makeSetter('npm'),
    
    showHtmlToJsx: openPanel === 'html2jsx',
    setShowHtmlToJsx: makeSetter('html2jsx'),
    
    showSvgOptimizer: openPanel === 'svg',
    setShowSvgOptimizer: makeSetter('svg'),
    
    showStorageInspector: openPanel === 'storage',
    setShowStorageInspector: makeSetter('storage'),
    
    showMockDataGenerator: openPanel === 'mock',
    setShowMockDataGenerator: makeSetter('mock'),
    
    showOmnibar: openPanel === 'omnibar',
    setShowOmnibar: makeSetter('omnibar'),
    
    showSecurityPanel,
    setShowSecurityPanel,
    pendingWorkspaceId,
    setPendingWorkspaceId,
    isGlass,
    sidecarStatus,
  };
}
