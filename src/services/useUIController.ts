import { useUIStore } from "./stores/ui-store";

export function useUIController() {
  const appMode = useUIStore((s) => s.appMode);
  const setAppMode = useUIStore((s) => s.setAppMode);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setIsSidebarOpen = useUIStore((s) => s.setIsSidebarOpen);
  const showNetworkGraph = useUIStore((s) => s.showNetworkGraph);
  const setShowNetworkGraph = useUIStore((s) => s.setShowNetworkGraph);
  const showSettings = useUIStore((s) => s.showSettings);
  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const showBrainstorm = useUIStore((s) => s.showBrainstorm);
  const setShowBrainstorm = useUIStore((s) => s.setShowBrainstorm);
  const showMasterPlan = useUIStore((s) => s.showMasterPlan);
  const setShowMasterPlan = useUIStore((s) => s.setShowMasterPlan);
  const isTasksCollapsed = useUIStore((s) => s.isTasksCollapsed);
  const setIsTasksCollapsed = useUIStore((s) => s.setIsTasksCollapsed);
  const isActivityCollapsed = useUIStore((s) => s.isActivityCollapsed);
  const setIsActivityCollapsed = useUIStore((s) => s.setIsActivityCollapsed);
  const showCodeReview = useUIStore((s) => s.showCodeReview);
  const setShowCodeReview = useUIStore((s) => s.setShowCodeReview);
  const showGitPanel = useUIStore((s) => s.showGitPanel);
  const setShowGitPanel = useUIStore((s) => s.setShowGitPanel);
  const showGitFullscreen = useUIStore((s) => s.showGitFullscreen);
  const setShowGitFullscreen = useUIStore((s) => s.setShowGitFullscreen);
  const showPersonalKanban = useUIStore((s) => s.showPersonalKanban);
  const setShowPersonalKanban = useUIStore((s) => s.setShowPersonalKanban);
  const showCalendar = useUIStore((s) => s.showCalendar);
  const setShowCalendar = useUIStore((s) => s.setShowCalendar);
  const showFileExplorer = useUIStore((s) => s.showFileExplorer);
  const setShowFileExplorer = useUIStore((s) => s.setShowFileExplorer);
  const showPortManager = useUIStore((s) => s.showPortManager);
  const setShowPortManager = useUIStore((s) => s.setShowPortManager);
  const showPortForwarding = useUIStore((s) => s.showPortForwarding);
  const setShowPortForwarding = useUIStore((s) => s.setShowPortForwarding);
  const showDockerManager = useUIStore((s) => s.showDockerManager);
  const setShowDockerManager = useUIStore((s) => s.setShowDockerManager);
  const showEnvManager = useUIStore((s) => s.showEnvManager);
  const setShowEnvManager = useUIStore((s) => s.setShowEnvManager);
  const showPackageManager = useUIStore((s) => s.showPackageManager);
  const setShowPackageManager = useUIStore((s) => s.setShowPackageManager);
  const showApiLab = useUIStore((s) => s.showApiLab);
  const setShowApiLab = useUIStore((s) => s.setShowApiLab);
  const showMonorepoGraph = useUIStore((s) => s.showMonorepoGraph);
  const setShowMonorepoGraph = useUIStore((s) => s.setShowMonorepoGraph);
  const showDbViewer = useUIStore((s) => s.showDbViewer);
  const setShowDbViewer = useUIStore((s) => s.setShowDbViewer);
  const showMdViewer = useUIStore((s) => s.showMdViewer);
  const setShowMdViewer = useUIStore((s) => s.setShowMdViewer);
  const showConfigEditor = useUIStore((s) => s.showConfigEditor);
  const setShowConfigEditor = useUIStore((s) => s.setShowConfigEditor);
  const showIconBrowser = useUIStore((s) => s.showIconBrowser);
  const setShowIconBrowser = useUIStore((s) => s.setShowIconBrowser);
  const showTailwindLabs = useUIStore((s) => s.showTailwindLabs);
  const setShowTailwindLabs = useUIStore((s) => s.setShowTailwindLabs);
  const showNpmLookup = useUIStore((s) => s.showNpmLookup);
  const setShowNpmLookup = useUIStore((s) => s.setShowNpmLookup);
  const showHtmlToJsx = useUIStore((s) => s.showHtmlToJsx);
  const setShowHtmlToJsx = useUIStore((s) => s.setShowHtmlToJsx);
  const showSvgOptimizer = useUIStore((s) => s.showSvgOptimizer);
  const setShowSvgOptimizer = useUIStore((s) => s.setShowSvgOptimizer);
  const showStorageInspector = useUIStore((s) => s.showStorageInspector);
  const setShowStorageInspector = useUIStore((s) => s.setShowStorageInspector);
  const showMockDataGenerator = useUIStore((s) => s.showMockDataGenerator);
  const setShowMockDataGenerator = useUIStore((s) => s.setShowMockDataGenerator);
  const showOmnibar = useUIStore((s) => s.showOmnibar);
  const setShowOmnibar = useUIStore((s) => s.setShowOmnibar);
  const showSecurityPanel = useUIStore((s) => s.showSecurityPanel);
  const setShowSecurityPanel = useUIStore((s) => s.setShowSecurityPanel);
  const pendingWorkspaceId = useUIStore((s) => s.pendingWorkspaceId);
  const setPendingWorkspaceId = useUIStore((s) => s.setPendingWorkspaceId);
  const isGlass = useUIStore((s) => s.isGlass);
  const sidecarStatus = useUIStore((s) => s.sidecarStatus);

  return {
    appMode,
    setAppMode,
    isSidebarOpen,
    setIsSidebarOpen,
    showNetworkGraph,
    setShowNetworkGraph,
    showSettings,
    setShowSettings,
    showBrainstorm,
    setShowBrainstorm,
    showMasterPlan,
    setShowMasterPlan,
    isTasksCollapsed,
    setIsTasksCollapsed,
    isActivityCollapsed,
    setIsActivityCollapsed,
    showCodeReview,
    setShowCodeReview,
    showGitPanel,
    setShowGitPanel,
    showGitFullscreen,
    setShowGitFullscreen,
    showPersonalKanban,
    setShowPersonalKanban,
    showCalendar,
    setShowCalendar,
    showFileExplorer,
    setShowFileExplorer,
    showPortManager,
    setShowPortManager,
    showPortForwarding,
    setShowPortForwarding,
    showDockerManager,
    setShowDockerManager,
    showEnvManager,
    setShowEnvManager,
    showPackageManager,
    setShowPackageManager,
    showApiLab,
    setShowApiLab,
    showMonorepoGraph,
    setShowMonorepoGraph,
    showDbViewer,
    setShowDbViewer,
    showMdViewer,
    setShowMdViewer,
    showConfigEditor,
    setShowConfigEditor,
    showIconBrowser,
    setShowIconBrowser,
    showTailwindLabs,
    setShowTailwindLabs,
    showNpmLookup,
    setShowNpmLookup,
    showHtmlToJsx,
    setShowHtmlToJsx,
    showSvgOptimizer,
    setShowSvgOptimizer,
    showStorageInspector,
    setShowStorageInspector,
    showMockDataGenerator,
    setShowMockDataGenerator,
    showOmnibar,
    setShowOmnibar,
    showSecurityPanel,
    setShowSecurityPanel,
    pendingWorkspaceId,
    setPendingWorkspaceId,
    isGlass,
    sidecarStatus,
  };
}
