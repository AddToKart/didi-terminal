import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { StatusBar } from "../components/layout/StatusBar";
import { useUIStore } from "../services/stores/ui-store";
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
  const showCodeReview = useUIStore(s => s.showCodeReview);
  const setShowCodeReview = useUIStore(s => s.setShowCodeReview);
  const showGitPanel = useUIStore(s => s.showGitPanel);
  const setShowGitPanel = useUIStore(s => s.setShowGitPanel);
  const showGitFullscreen = useUIStore(s => s.showGitFullscreen);
  const setShowGitFullscreen = useUIStore(s => s.setShowGitFullscreen);
  const showPersonalKanban = useUIStore(s => s.showPersonalKanban);
  const setShowPersonalKanban = useUIStore(s => s.setShowPersonalKanban);
  const showCalendar = useUIStore(s => s.showCalendar);
  const setShowCalendar = useUIStore(s => s.setShowCalendar);
  const showFileExplorer = useUIStore(s => s.showFileExplorer);
  const setShowFileExplorer = useUIStore(s => s.setShowFileExplorer);
  const showPortManager = useUIStore(s => s.showPortManager);
  const setShowPortManager = useUIStore(s => s.setShowPortManager);
  const showPortForwarding = useUIStore(s => s.showPortForwarding);
  const setShowPortForwarding = useUIStore(s => s.setShowPortForwarding);
  const showDockerManager = useUIStore(s => s.showDockerManager);
  const setShowDockerManager = useUIStore(s => s.setShowDockerManager);
  const showEnvManager = useUIStore(s => s.showEnvManager);
  const setShowEnvManager = useUIStore(s => s.setShowEnvManager);
  const showPackageManager = useUIStore(s => s.showPackageManager);
  const setShowPackageManager = useUIStore(s => s.setShowPackageManager);
  const showApiLab = useUIStore(s => s.showApiLab);
  const setShowApiLab = useUIStore(s => s.setShowApiLab);
  const showDbViewer = useUIStore(s => s.showDbViewer);
  const setShowDbViewer = useUIStore(s => s.setShowDbViewer);
  const showMdViewer = useUIStore(s => s.showMdViewer);
  const setShowMdViewer = useUIStore(s => s.setShowMdViewer);
  const showConfigEditor = useUIStore(s => s.showConfigEditor);
  const setShowConfigEditor = useUIStore(s => s.setShowConfigEditor);
  const showIconBrowser = useUIStore(s => s.showIconBrowser);
  const setShowIconBrowser = useUIStore(s => s.setShowIconBrowser);
  const showTailwindLabs = useUIStore(s => s.showTailwindLabs);
  const setShowTailwindLabs = useUIStore(s => s.setShowTailwindLabs);
  const showNpmLookup = useUIStore(s => s.showNpmLookup);
  const setShowNpmLookup = useUIStore(s => s.setShowNpmLookup);
  const showHtmlToJsx = useUIStore(s => s.showHtmlToJsx);
  const setShowHtmlToJsx = useUIStore(s => s.setShowHtmlToJsx);
  const showSvgOptimizer = useUIStore(s => s.showSvgOptimizer);
  const setShowSvgOptimizer = useUIStore(s => s.setShowSvgOptimizer);
  const showStorageInspector = useUIStore(s => s.showStorageInspector);
  const setShowStorageInspector = useUIStore(s => s.setShowStorageInspector);
  const showMockDataGenerator = useUIStore(s => s.showMockDataGenerator);
  const setShowMockDataGenerator = useUIStore(s => s.setShowMockDataGenerator);
  const showSecurityPanel = useUIStore(s => s.showSecurityPanel);
  const setShowSecurityPanel = useUIStore(s => s.setShowSecurityPanel);
  const pendingWorkspaceId = useUIStore(s => s.pendingWorkspaceId);
  const setPendingWorkspaceId = useUIStore(s => s.setPendingWorkspaceId);

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

  const backdropVisible = showCodeReview || showGitPanel || showPersonalKanban || showCalendar || showFileExplorer;

  return (
    <>
      {backdropVisible && (
        <div
          className="fixed inset-0 bg-black/85 z-[45] animate-in fade-in duration-300"
          onClick={() => {
            setShowCodeReview(false);
            setShowGitPanel(false);
            setShowPersonalKanban(false);
            setShowCalendar(false);
            setShowFileExplorer(false);
          }}
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
