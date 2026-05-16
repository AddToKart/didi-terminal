import { useState, useRef, useEffect, type FormEvent } from "react";
import { Brain, ClipboardList, Columns, Globe, Grid2X2, Network, PanelLeft, PanelLeftClose, Plus, Rows, Layers, AlignLeft, Sparkles, ChevronRight, ChevronLeft, GitMerge, LayoutList, FolderSearch, FileKey2, Package, Zap, FolderTree, FileText, FileCode, Palette, Box, HardDrive, Code2, Database } from "lucide-react";
import { WindowControls } from "./WindowControls";


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
  onToggleMonorepoGraph?: () => void;
  onToggleMdViewer?: () => void;
  onToggleConfigEditor?: () => void;
  onToggleIconBrowser?: () => void;
  onToggleTailwindLabs?: () => void;
  onToggleNpmLookup?: () => void;
  onToggleHtmlToJsx?: () => void;
  onToggleSvgOptimizer?: () => void;
  onToggleStorageInspector?: () => void;
  onToggleMockDataGenerator?: () => void;
  currentProject: string | null;
  }

  function WebDevPopover({ onToggleIconBrowser, onToggleTailwindLabs, onToggleNpmLookup, onToggleHtmlToJsx, onToggleSvgOptimizer, onToggleStorageInspector, onToggleMockDataGenerator }: {
  onToggleIconBrowser?: () => void; onToggleTailwindLabs?: () => void;
  onToggleNpmLookup?: () => void; onToggleHtmlToJsx?: () => void; onToggleSvgOptimizer?: () => void; onToggleStorageInspector?: () => void; onToggleMockDataGenerator?: () => void;
  }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    {
      icon: Database,
      label: "Mock Data Generator",
      desc: "Generate JSON, CSV, or SQL",
      gradient: "from-green-500/20 to-emerald-500/20",
      color: "text-green-400",
      badge: "Tool",
      action: () => { onToggleMockDataGenerator?.(); setOpen(false); },
    },
    {
      icon: Palette,
      label: "Icon Browser",
      desc: "Browse & copy lucide icons",
      gradient: "from-indigo-500/20 to-purple-500/20",
      color: "text-indigo-400",
      badge: "1,703",
      action: () => { onToggleIconBrowser?.(); setOpen(false); },
    },
    {
      icon: Palette,
      label: "Tailwind Labs",
      desc: "Colors, classes & spacing tokens",
      gradient: "from-sky-500/20 to-blue-500/20",
      color: "text-sky-400",
      badge: "170+",
      action: () => { onToggleTailwindLabs?.(); setOpen(false); },
    },
    {
      icon: Box,
      label: "npm Lookup",
      desc: "Search npm package registry",
      gradient: "from-red-500/20 to-orange-500/20",
      color: "text-red-400",
      badge: "Live",
      action: () => { onToggleNpmLookup?.(); setOpen(false); },
    },
    {
      icon: Code2,
      label: "HTML to JSX",
      desc: "Convert HTML to React JSX",
      gradient: "from-orange-500/20 to-amber-500/20",
      color: "text-orange-400",
      badge: "Tool",
      action: () => { onToggleHtmlToJsx?.(); setOpen(false); },
    },
    {
      icon: FileCode,
      label: "SVG Optimizer",
      desc: "Clean and minify SVGs",
      gradient: "from-amber-500/20 to-yellow-500/20",
      color: "text-amber-400",
      badge: "Tool",
      action: () => { onToggleSvgOptimizer?.(); setOpen(false); },
    },
    {
      icon: HardDrive,
      label: "Storage Inspector",
      desc: "Browse localStorage & cookies",
      gradient: "from-emerald-500/20 to-teal-500/20",
      color: "text-emerald-400",
      badge: "Live",
      action: () => { onToggleStorageInspector?.(); setOpen(false); },
    },
  ];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-[11px] font-bold border whitespace-nowrap ${
          open
            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.08)]'
            : 'text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800/60 hover:border-zinc-700'
        }`}
        title="Web Development Tools"
      >
        <Palette size={12} />
        <span>Web Dev</span>
        <kbd className={`text-[8px] font-mono px-1 py-0.5 rounded transition-colors ${open ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-zinc-600'}`}>⌘K</kbd>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#0b0b0d]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-[500]">
          <div className="px-4 py-2.5 border-b border-white/5">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Web Development</span>
          </div>
          <div className="p-1.5">
            {items.map(item => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.04] group text-left"
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient} border border-white/5`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">{item.label}</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">{item.desc}</div>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono text-zinc-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02]">
            <span className="text-[8px] text-zinc-700">More tools coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
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
  onToggleMonorepoGraph,
  onToggleMdViewer,
  onToggleConfigEditor,
  onToggleIconBrowser,
  onToggleTailwindLabs,
  onToggleNpmLookup,
  onToggleHtmlToJsx,
  onToggleSvgOptimizer,
  onToggleStorageInspector,
  onToggleMockDataGenerator,
  currentProject,
}: AppTopbarProps) {
  const [isExtraLayoutsOpen, setIsExtraLayoutsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(true);

  // Auto-expand if current orientation is one of the "extra" ones
  const isExtraActive = ["focus", "presentation", "dynamic", "canvas", "waterfall"].includes(layoutOrientation);
  const showExtras = isExtraLayoutsOpen || isExtraActive;
  return (
    <div 
      className="h-7 border-b border-app-border flex items-center justify-between pl-4 pr-0 bg-app-bg relative z-50 select-none"
    >
      <div className="absolute inset-0 -z-10" data-tauri-drag-region />
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
            className="bg-app-panel border border-app-border focus:border-brand-accent text-white pl-8 pr-3 py-0 text-[10px] font-bold outline-none transition-colors w-64 placeholder:text-zinc-400 rounded-md shadow-sm h-5"
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

      <div className="flex items-center gap-4 px-2">
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
          <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-2 py-1 gap-2 shadow-sm ml-6">
          <div className={`flex items-center gap-1 transition-all duration-700 ease-in-out ${isToolsOpen ? "max-w-[1200px] opacity-100 px-0.5 overflow-visible" : "max-w-0 opacity-0 overflow-hidden"}`}>
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
                onClick={onToggleMonorepoGraph}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Dependency Graph"
              >
                <FolderTree size={12} />
                <span>Graph</span>
              </button>

              <button
                onClick={onToggleMdViewer}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Markdown Viewer"
              >
                <FileText size={12} />
                <span>Docs</span>
              </button>

              <button
                onClick={onToggleConfigEditor}
                className="flex items-center gap-1.5 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 px-2.5 py-1 rounded-full transition-all text-[11px] font-bold shrink-0"
                title="Config Editor"
              >
                <FileCode size={12} />
                <span>Config</span>
              </button>

              {/* Web Dev Tools Popover */}
              <WebDevPopover
                onToggleIconBrowser={onToggleIconBrowser}
                onToggleTailwindLabs={onToggleTailwindLabs}
                onToggleNpmLookup={onToggleNpmLookup}
                onToggleHtmlToJsx={onToggleHtmlToJsx}
                onToggleSvgOptimizer={onToggleSvgOptimizer}
                onToggleStorageInspector={onToggleStorageInspector}
                onToggleMockDataGenerator={onToggleMockDataGenerator}
              />
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

        <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-2 py-1 gap-2 shadow-sm ml-4">
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
        
        <div className="h-full ml-6">
          <WindowControls />
        </div>
      </div>
    </div>
  );
}
