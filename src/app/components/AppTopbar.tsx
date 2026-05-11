import { useState, type FormEvent } from "react";
import { Brain, ClipboardList, Columns, Globe, Grid2X2, Network, PanelLeft, PanelLeftClose, Plus, Rows, Layers, AlignLeft, Sparkles, ChevronRight, ChevronLeft, GitMerge, LayoutList, FolderSearch, FileKey2, Package, Zap } from "lucide-react";

interface AppTopbarProps {
  appMode: "terminal" | "orchestrator";
  onSpawnAgent: (e: FormEvent) => void;
  newAgentName: string;
  onChangeNewAgentName: (value: string) => void;
  onOpenBrainstorm: () => void;
  onOpenMasterPlan: () => void;
  onOpenNetworkGraph: () => void;
  layoutOrientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic";
  onSetLayoutOrientation: (orientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSpawnBrowser: () => void;
  codeReviewStats?: { additions: number; deletions: number };
  onToggleCodeReview?: () => void;
  onToggleGitPanel?: () => void;
  onTogglePersonalKanban?: () => void;
  onToggleFileExplorer?: () => void;
  onToggleEnvManager?: () => void;
  onTogglePackageManager?: () => void;
  onToggleApiLab?: () => void;
  currentProject: string | null;
}

export function AppTopbar({
  appMode,
  onSpawnAgent,
  newAgentName,
  onChangeNewAgentName,
  onOpenBrainstorm,
  onOpenMasterPlan,
  onOpenNetworkGraph,
  layoutOrientation,
  onSetLayoutOrientation,
  isSidebarOpen,
  onToggleSidebar,
  onSpawnBrowser,
  codeReviewStats,
  onToggleCodeReview,
  onToggleGitPanel,
  onTogglePersonalKanban,
  onToggleFileExplorer,
  onToggleEnvManager,
  onTogglePackageManager,
  onToggleApiLab,
  currentProject,
}: AppTopbarProps) {
  const [isExtraLayoutsOpen, setIsExtraLayoutsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(true);

  // Auto-expand if current orientation is one of the "extra" ones
  const isExtraActive = ["focus", "presentation", "dynamic", "canvas", "waterfall"].includes(layoutOrientation);
  const showExtras = isExtraLayoutsOpen || isExtraActive;
  return (
    <div className="h-14 border-b border-app-border flex items-center justify-between px-4 bg-app-bg">
      <form onSubmit={onSpawnAgent} className="flex items-center gap-2">
        <div className="relative flex items-center">
          <button type="submit" className="absolute left-1.5 text-brand-primary transition-colors p-1 z-10 rounded">
            <Plus size={14} strokeWidth={3} />
          </button>
          <input
            type="text"
            value={newAgentName}
            onChange={e => onChangeNewAgentName(e.target.value)}
            placeholder={appMode === "terminal" ? "Spawn new terminal..." : "Spawn new agent..."}
            className="bg-app-panel border border-app-border focus:border-brand-accent text-white pl-8 pr-3 py-1.5 text-xs font-bold outline-none transition-colors w-64 placeholder:text-zinc-400 rounded-lg shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={onSpawnBrowser}
          className="p-1.5 rounded-lg transition-colors text-zinc-300 hover:text-brand-primary bg-app-panel border border-app-border"
          title="Open Browser Pane"
        >
          <Globe size={16} strokeWidth={2.5} />
        </button>
      </form>

      <div className="flex items-center gap-2">
        {appMode === "orchestrator" && (
          <>
            <button
              onClick={onOpenBrainstorm}
              className="p-1.5 rounded-lg transition-colors text-zinc-300 hover:text-brand-primary bg-app-panel border border-app-border"
              title="Brainstorm Mode"
            >
              <Brain size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={onOpenMasterPlan}
              className="p-1.5 rounded-lg transition-colors text-zinc-300 hover:text-brand-primary bg-app-panel border border-app-border"
              title="Master Plan Board"
            >
              <ClipboardList size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={onOpenNetworkGraph}
              className="p-1.5 rounded-lg transition-colors text-zinc-300 hover:text-brand-primary bg-app-panel border border-app-border"
              title="Collaboration Graph"
            >
              <Network size={16} strokeWidth={2.5} />
            </button>
          </>
        )}
        {currentProject && (
          <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-1 gap-1 shadow-sm ml-2">
            <div className={`flex items-center gap-1 transition-all duration-700 ease-in-out overflow-hidden ${isToolsOpen ? "max-w-[700px] opacity-100 px-0.5" : "max-w-0 opacity-0"}`}>
              <button
                onClick={onToggleFileExplorer}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Project Explorer"
              >
                <FolderSearch size={12} />
                <span>Files</span>
              </button>

              <button
                onClick={onTogglePersonalKanban}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="My Tasks"
              >
                <LayoutList size={12} />
                <span>My Tasks</span>
              </button>

              <button
                onClick={onToggleEnvManager}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Env Manager"
              >
                <FileKey2 size={12} />
                <span>.env</span>
              </button>

              <button
                onClick={onTogglePackageManager}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Package Manager"
              >
                <Package size={12} />
                <span>Packages</span>
              </button>

              <button
                onClick={onToggleApiLab}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="API Lab"
              >
                <Zap size={12} />
                <span>API Lab</span>
              </button>

              <button
                onClick={onToggleGitPanel}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Source Control"
              >
                <GitMerge size={12} />
                <span>Source Control</span>
              </button>
            </div>

            <button
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className={`p-1 rounded-md transition-all ${isToolsOpen ? "bg-white/5 text-zinc-300" : "text-zinc-500 hover:text-zinc-300"}`}
              title={isToolsOpen ? "Collapse Tools" : "Expand Tools"}
            >
              {isToolsOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            {codeReviewStats && (
              <button
                onClick={onToggleCodeReview}
                className="flex items-center group relative overflow-hidden bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600 rounded-full px-3 py-1 transition-all ml-1 shadow-lg shrink-0"
                title="Open Code Review"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex items-center gap-3 relative z-10 font-mono text-[11px] font-bold tracking-tight">
                  <span className={`flex items-center gap-0.5 ${codeReviewStats.additions > 0 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" : "text-emerald-400/50"}`}>
                    <span>+</span>{codeReviewStats.additions}
                  </span>
                  <span className={`flex items-center gap-0.5 ${codeReviewStats.deletions > 0 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]" : "text-red-400/50"}`}>
                    <span>-</span>{codeReviewStats.deletions}
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-1 gap-1 shadow-sm ml-2">
          <button
            onClick={() => onSetLayoutOrientation("vertical")}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${layoutOrientation === "vertical" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Vertical Split (Side-by-side)"
          >
            <Columns size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("horizontal")}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${layoutOrientation === "horizontal" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Horizontal Stack"
          >
            <Rows size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("grid")}
            className={`p-1.5 rounded-lg transition-all shrink-0 ${layoutOrientation === "grid" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Grid Layout"
          >
            <Grid2X2 size={14} strokeWidth={2.5} />
          </button>

          <div className={`flex items-center gap-1 transition-all duration-700 ease-in-out overflow-hidden ${showExtras ? "max-w-[200px] opacity-100 ml-1 border-l border-zinc-800 pl-1" : "max-w-0 opacity-0"}`}>
            <button
              onClick={() => onSetLayoutOrientation("dynamic")}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${layoutOrientation === "dynamic" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Dynamic Bento Grid"
            >
              <Sparkles size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onSetLayoutOrientation("canvas")}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${layoutOrientation === "canvas" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Canvas (Free Float)"
            >
              <Layers size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onSetLayoutOrientation("waterfall")}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${layoutOrientation === "waterfall" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Waterfall Stream"
            >
              <AlignLeft size={14} strokeWidth={2.5} />
            </button>
          </div>

          <button
            onClick={() => setIsExtraLayoutsOpen(!isExtraLayoutsOpen)}
            className={`p-1 rounded-md transition-all ${showExtras ? "bg-white/5 text-zinc-300" : "text-zinc-500 hover:text-zinc-300"}`}
            title={showExtras ? "Collapse Layouts" : "More Layouts"}
          >
            {showExtras ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>


        {appMode === "orchestrator" && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg transition-colors text-zinc-300 hover:text-brand-primary bg-app-panel border border-app-border"
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose size={16} strokeWidth={2.5} /> : <PanelLeft size={16} strokeWidth={2.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
