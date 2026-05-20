import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StatusBar } from "../components/layout/StatusBar";
import { useUIController } from "../services/useUIController";
import { useGitStore } from "../services/stores/git-store";
import { useAgentStore } from "../services/stores/agent-store";
import { useWorkspaceStore } from "../services/stores/workspace-store";

function ModalBoundary({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <ErrorBoundary title={title || "Panel crashed"}>
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}

const CodeReviewPanel = lazy(() => import("../components/source-control/CodeReviewPanel").then(m => ({ default: m.CodeReviewPanel })));
const GitPanel = lazy(() => import("../components/source-control/GitPanel").then(m => ({ default: m.GitPanel })));
const SourceControlFullscreen = lazy(() => import("../components/source-control/SourceControlFullscreen").then(m => ({ default: m.SourceControlFullscreen })));
const PersonalKanban = lazy(() => import("../components/workspace/PersonalKanban").then(m => ({ default: m.PersonalKanban })));
const CalendarPanel = lazy(() => import("../components/workspace/CalendarPanel").then(m => ({ default: m.CalendarPanel })));
const ProjectFileExplorer = lazy(() => import("../components/workspace/ProjectFileExplorer").then(m => ({ default: m.ProjectFileExplorer })));
const PortManager = lazy(() => import("../components/developer-tools/PortManager").then(m => ({ default: m.PortManager })));
const PortForwardingPanel = lazy(() => import("../components/developer-tools/PortForwardingPanel").then(m => ({ default: m.PortForwardingPanel })));
const DockerManager = lazy(() => import("../components/developer-tools/DockerManager").then(m => ({ default: m.DockerManager })));
const EnvManager = lazy(() => import("../components/developer-tools/EnvManager").then(m => ({ default: m.EnvManager })));
const PackageManager = lazy(() => import("../components/developer-tools/PackageManager").then(m => ({ default: m.PackageManager })));
const ApiLab = lazy(() => import("../components/developer-tools/ApiLab").then(m => ({ default: m.ApiLab })));
const DbViewer = lazy(() => import("../components/developer-tools/DbViewer").then(m => ({ default: m.DbViewer })));
const MdViewer = lazy(() => import("../components/developer-tools/MdViewer").then(m => ({ default: m.MdViewer })));
const ConfigEditor = lazy(() => import("../components/developer-tools/ConfigEditor").then(m => ({ default: m.ConfigEditor })));
const IconBrowser = lazy(() => import("../components/developer-tools/IconBrowser").then(m => ({ default: m.IconBrowser })));
const TailwindLabs = lazy(() => import("../components/developer-tools/TailwindLabs").then(m => ({ default: m.TailwindLabs })));
const NpmLookup = lazy(() => import("../components/developer-tools/NpmLookup").then(m => ({ default: m.NpmLookup })));
const HtmlToJsx = lazy(() => import("../components/developer-tools/HtmlToJsx").then(m => ({ default: m.HtmlToJsx })));
const SvgOptimizer = lazy(() => import("../components/developer-tools/SvgOptimizer").then(m => ({ default: m.SvgOptimizer })));
const StorageInspector = lazy(() => import("../components/developer-tools/StorageInspector").then(m => ({ default: m.StorageInspector })));
const MockDataGenerator = lazy(() => import("../components/developer-tools/MockDataGenerator").then(m => ({ default: m.MockDataGenerator })));
const SecurityPanel = lazy(() => import("../components/workspace/SecurityPanel").then(m => ({ default: m.SecurityPanel })));
const TwoFactorModal = lazy(() => import("../components/modals/TwoFactorModal").then(m => ({ default: m.TwoFactorModal })));

interface NonZenModePanelsProps {
  currentProject: string | null;
}

export function NonZenModePanels({
  currentProject,
}: NonZenModePanelsProps) {
  const {
    openPanel,
    setOpenPanel,
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
    showSecurityPanel,
    setShowSecurityPanel,
    pendingWorkspaceId,
    setPendingWorkspaceId,
  } = useUIController();

  const setCodeReviewStats = useGitStore(s => s.setCodeReviewStats);
  const portCount = useAgentStore(s => s.portCount);
  const setPortCount = useAgentStore(s => s.setPortCount);
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore(s => s.setActiveWorkspaceId);

  const [dockerCount, setDockerCount] = useState<number | null>(null);
  const [forwardedCount, setForwardedCount] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      try {
        const list = await invoke<any[]>("get_docker_containers");
        if (active) setDockerCount(list.length);
      } catch {
        if (active) setDockerCount(null);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  const backdropVisible = !!openPanel && ["codereview", "git", "kanban", "calendar", "fileexplorer"].includes(openPanel);

  return (
    <>
      {backdropVisible && (
        <div
          className="fixed inset-0 bg-black/85 z-[45] animate-in fade-in duration-300"
          onClick={() => setOpenPanel(null)}
        />
      )}

      <ModalBoundary><CodeReviewPanel
        currentProject={currentProject}
        isOpen={showCodeReview}
        onClose={() => setShowCodeReview(false)}
        onStatsUpdate={setCodeReviewStats}
      /></ModalBoundary>
      <ModalBoundary><GitPanel
        currentProject={currentProject}
        isOpen={showGitPanel}
        onClose={() => setShowGitPanel(false)}
        onOpenFullscreen={() => {
          setShowGitPanel(false);
          setShowGitFullscreen(true);
        }}
      /></ModalBoundary>
      <ModalBoundary><SourceControlFullscreen
        currentProject={currentProject}
        isOpen={showGitFullscreen}
        onClose={() => setShowGitFullscreen(false)}
      /></ModalBoundary>
      <ModalBoundary><PersonalKanban
        workspaceId={activeWorkspaceId}
        isOpen={showPersonalKanban}
        onClose={() => setShowPersonalKanban(false)}
      /></ModalBoundary>
      <ModalBoundary><CalendarPanel
        workspaceId={activeWorkspaceId}
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
      /></ModalBoundary>
      <ModalBoundary><ProjectFileExplorer
        currentProject={currentProject}
        isOpen={showFileExplorer}
        onClose={() => setShowFileExplorer(false)}
      /></ModalBoundary>

      <StatusBar
        portCount={portCount}
        dockerCount={dockerCount}
        forwardedCount={forwardedCount}
        onOpenPortManager={() => setShowPortManager(true)}
        onOpenDbViewer={() => setShowDbViewer(true)}
        onOpenDockerManager={() => setShowDockerManager(true)}
        onOpenPortForwarding={() => setShowPortForwarding(true)}
      />

      <ModalBoundary><PortForwardingPanel
        isOpen={showPortForwarding}
        onClose={() => setShowPortForwarding(false)}
        onForwardedCountChange={setForwardedCount}
      /></ModalBoundary>

      <ModalBoundary><PortManager
        isOpen={showPortManager}
        onClose={() => setShowPortManager(false)}
        onPortsUpdate={setPortCount}
      /></ModalBoundary>
      <ModalBoundary><DockerManager
        isOpen={showDockerManager}
        onClose={() => setShowDockerManager(false)}
      /></ModalBoundary>
      <ModalBoundary><EnvManager
        currentProject={currentProject}
        isOpen={showEnvManager}
        onClose={() => setShowEnvManager(false)}
      /></ModalBoundary>
      <ModalBoundary><PackageManager
        currentProject={currentProject}
        isOpen={showPackageManager}
        onClose={() => setShowPackageManager(false)}
      /></ModalBoundary>
      <ModalBoundary><ApiLab
        isOpen={showApiLab}
        onClose={() => setShowApiLab(false)}
      /></ModalBoundary>
      <ModalBoundary><DbViewer
        isOpen={showDbViewer}
        onClose={() => setShowDbViewer(false)}
      /></ModalBoundary>
      <ModalBoundary><MdViewer
        currentProject={currentProject}
        isOpen={showMdViewer}
        onClose={() => setShowMdViewer(false)}
      /></ModalBoundary>
      <ModalBoundary><ConfigEditor
        currentProject={currentProject}
        isOpen={showConfigEditor}
        onClose={() => setShowConfigEditor(false)}
      /></ModalBoundary>
      <ModalBoundary><IconBrowser
        isOpen={showIconBrowser}
        onClose={() => setShowIconBrowser(false)}
      /></ModalBoundary>
      <ModalBoundary><TailwindLabs
        isOpen={showTailwindLabs}
        onClose={() => setShowTailwindLabs(false)}
      /></ModalBoundary>
      <ModalBoundary><NpmLookup
        isOpen={showNpmLookup}
        onClose={() => setShowNpmLookup(false)}
      /></ModalBoundary>
      <ModalBoundary><HtmlToJsx
        isOpen={showHtmlToJsx}
        onClose={() => setShowHtmlToJsx(false)}
      /></ModalBoundary>
      <ModalBoundary><SvgOptimizer
        isOpen={showSvgOptimizer}
        onClose={() => setShowSvgOptimizer(false)}
      /></ModalBoundary>
      <ModalBoundary><StorageInspector
        isOpen={showStorageInspector}
        onClose={() => setShowStorageInspector(false)}
      /></ModalBoundary>
      <ModalBoundary><MockDataGenerator
        isOpen={showMockDataGenerator}
        onClose={() => setShowMockDataGenerator(false)}
      /></ModalBoundary>

      {showSecurityPanel && (
        <ModalBoundary title="Panel crashed"><SecurityPanel
          workspaceId={showSecurityPanel}
          workspaceName={workspaces.find(w => w.id === showSecurityPanel)?.name || ""}
          isOpen={!!showSecurityPanel}
          onClose={() => setShowSecurityPanel(null)}
        /></ModalBoundary>
      )}
      {pendingWorkspaceId && (
        <ModalBoundary title="Panel crashed"><TwoFactorModal
          isOpen={!!pendingWorkspaceId}
          workspaceId={pendingWorkspaceId}
          workspaceName={workspaces.find(w => w.id === pendingWorkspaceId)?.name || ""}
          onVerify={success => {
            if (success) {
              setActiveWorkspaceId(pendingWorkspaceId);
              setPendingWorkspaceId(null);
            }
          }}
          onCancel={() => setPendingWorkspaceId(null)}
        /></ModalBoundary>
      )}
    </>
  );
}
