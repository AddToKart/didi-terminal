import { useState, useRef, useEffect, type FormEvent } from "react";
import { Brain, ClipboardList, Columns, Globe, Grid2X2, Network, PanelLeft, PanelLeftClose, Plus, Rows, Layers, AlignLeft, Sparkles, ChevronRight, ChevronLeft, GitMerge, LayoutList, FolderSearch, FileKey2, Package, Zap, FolderTree, FileText, FileCode, Palette, Box, HardDrive, Code2, Database, Calendar } from "lucide-react";
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
  onToggleCalendar?: () => void;
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
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const updateCoords = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8, // equivalent to mt-2
        right: window.innerWidth - rect.right,
      });
    }
  };

  const toggleOpen = () => {
    if (!open) {
      updateCoords();
    }
    setOpen(!open);
  };

  useEffect(() => {
    const handleUpdate = () => {
      if (open) updateCoords();
    };

    const handleClick = (e: MouseEvent) => {
      // Direct containment check as well as checking if the click was inside a fixed portal/child
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Also safeguard if the target element belongs to the popover itself (which is fixed)
        const popoverEl = document.getElementById("web-dev-popover-menu");
        if (popoverEl && popoverEl.contains(e.target as Node)) {
          return;
        }
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClick);
      window.addEventListener("resize", handleUpdate);
      // Listen to scroll events on horizontal container to update placement dynamically.
      const topbar = document.querySelector(".overflow-x-auto");
      if (topbar) topbar.addEventListener("scroll", handleUpdate);
    }
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleUpdate);
      const topbar = document.querySelector(".overflow-x-auto");
      if (topbar) topbar.removeEventListener("scroll", handleUpdate);
    };
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
        onClick={toggleOpen}
        className={`flex items-center justify-center p-1 rounded-lg transition-all border ${open
            ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.08)]'
            : 'text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border-zinc-800/60 hover:border-zinc-700'
          }`}
        title="Web Development Tools (⌘K)"
      >
        <Palette size={14} />
      </button>

      {open && coords && (
        <div 
          id="web-dev-popover-menu"
          className="fixed w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden z-[500]"
          style={{
            top: `${coords.top}px`,
            right: `${coords.right}px`
          }}
        >
          <div className="px-4 py-2.5 border-b border-zinc-900">
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Web Development</span>
          </div>
          <div className="p-1.5">
            {items.map(item => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-zinc-900 group text-left"
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${item.gradient} border border-zinc-900`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">{item.label}</div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">{item.desc}</div>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">{item.badge}</span>
                )}
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-900/30">
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
  onToggleCalendar,
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
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  // Auto-expand if current orientation is one of the "extra" ones
  const isExtraActive = ["focus", "presentation", "dynamic", "canvas", "waterfall"].includes(layoutOrientation);
  const showExtras = isExtraLayoutsOpen || isExtraActive;
  return (
    <div 
      className="h-10 border-b border-app-border bg-app-bg relative z-50 select-none flex items-stretch justify-between pl-2 pr-0 overflow-x-auto scrollbar-hide overflow-y-hidden"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2 h-full" data-tauri-drag-region>
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md transition-all duration-200 hover:text-white hover:bg-white/5 hover:scale-105 active:scale-95 z-10"
          title="Toggle Sidebar"
        >
          {isSidebarOpen ? <PanelLeftClose size={16} strokeWidth={2} /> : <PanelLeft size={16} strokeWidth={2} />}
        </button>
        <form onSubmit={onSpawnAgent} className="flex items-center gap-1 md:gap-2" data-tauri-drag-region>
        <div className="relative flex items-center">
          <button type="submit" className="absolute left-1.5 text-zinc-500 hover:text-brand-primary transition-all duration-200 hover:scale-110 active:scale-95 p-1 z-10 rounded">
            <Plus size={14} strokeWidth={3} />
          </button>
          <input
            type="text"
            value={newAgentName}
            onChange={e => onChangeNewAgentName(e.target.value)}
            placeholder={appMode === "terminal" ? "Spawn new terminal..." : "Spawn new agent..."}
            className="bg-zinc-950/80 border border-zinc-800 focus:border-brand-accent/60 text-white pl-8 pr-14 py-0 text-[10px] font-bold outline-none transition-all duration-300 w-24 sm:w-32 md:w-48 lg:w-64 placeholder:text-zinc-500 rounded-md shadow-inner h-6 focus:shadow-[0_0_10px_rgba(0,240,255,0.1)] focus:ring-1 focus:ring-brand-accent/30"
          />
          <div className="absolute right-2 flex items-center gap-0.5 pointer-events-none select-none">
            <kbd className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5 text-[7px] font-mono text-zinc-400 font-bold uppercase tracking-wide">Ctrl</kbd>
            <kbd className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-[7px] font-mono text-zinc-400 font-bold uppercase tracking-wide">K</kbd>
          </div>
        </div>
        <button
          type="button"
          onClick={onSpawnBrowser}
          className="p-1 h-6 w-6 flex items-center justify-center rounded-md transition-all duration-200 text-zinc-400 hover:text-brand-primary bg-app-panel border border-app-border hover:border-brand-primary/30 hover:scale-105 active:scale-95 hover:shadow-[0_0_8px_rgba(228,228,231,0.2)]"
          title="Open Browser Pane"
        >
          <Globe size={14} strokeWidth={2.5} />
        </button>
      </form>
      </div>

      <div className="flex items-center h-full gap-1.5" data-tauri-drag-region>
        {appMode === "orchestrator" && (
          <>
            <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-1.5 py-0.5 gap-1 shadow-sm" data-tauri-drag-region>
              <button
                onClick={onOpenBrainstorm}
                className="p-1 rounded-lg transition-all duration-200 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 hover:scale-105 active:scale-95 shrink-0"
                title="Brainstorm Mode"
              >
                <Brain size={14} strokeWidth={2} />
              </button>
              <button
                onClick={onOpenMasterPlan}
                className="p-1 rounded-lg transition-all duration-200 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 hover:scale-105 active:scale-95 shrink-0"
                title="Master Plan Board"
              >
                <ClipboardList size={14} strokeWidth={2} />
              </button>
              <button
                onClick={onOpenNetworkGraph}
                className="p-1 rounded-lg transition-all duration-200 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 hover:scale-105 active:scale-95 shrink-0"
                title="Collaboration Graph"
              >
                <Network size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="w-[1px] h-4 bg-zinc-800/60 shrink-0 self-center mx-1" />
          </>
        )}

        {currentProject && (
          <>
            <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-1.5 py-0.5 gap-1 shadow-sm">
              <div className={`flex items-center gap-1 transition-all duration-700 ease-in-out ${isToolsOpen ? "max-w-[1200px] opacity-100 px-0.5" : "max-w-0 opacity-0 overflow-hidden"}`}>
                <button
                  onClick={onToggleFileExplorer}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Project Explorer"
                >
                  <FolderSearch size={14} />
                </button>

                <button
                  onClick={onTogglePersonalKanban}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="My Tasks"
                >
                  <LayoutList size={14} />
                </button>

                <button
                  onClick={onToggleCalendar}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Calendar"
                >
                  <Calendar size={14} />
                </button>

                <button
                  onClick={onToggleEnvManager}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Env Manager"
                >
                  <FileKey2 size={14} />
                </button>

                <button
                  onClick={onTogglePackageManager}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Package Manager"
                >
                  <Package size={14} />
                </button>

                <button
                  onClick={onToggleApiLab}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="API Lab"
                >
                  <Zap size={14} />
                </button>

                <button
                  onClick={onToggleMonorepoGraph}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Dependency Graph"
                >
                  <FolderTree size={14} />
                </button>

                <button
                  onClick={onToggleMdViewer}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Markdown Viewer"
                >
                  <FileText size={14} />
                </button>

                <button
                  onClick={onToggleConfigEditor}
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Config Editor"
                >
                  <FileCode size={14} />
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
                  className="p-1 text-zinc-400 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-200 shrink-0 hover:scale-105 active:scale-95"
                  title="Source Control"
                >
                  <GitMerge size={14} />
                </button>
              </div>

              <button
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                className={`p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95 ${isToolsOpen ? "bg-white/5 text-zinc-300" : "text-zinc-500 hover:text-zinc-300"}`}
                title={isToolsOpen ? "Collapse Tools" : "Expand Tools"}
              >
                {isToolsOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>

              {codeReviewStats && (
                <button
                  onClick={onToggleCodeReview}
                  className="flex items-center group relative overflow-hidden bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600 rounded-lg px-2 py-0.5 transition-all ml-0.5 shadow-lg shrink-0"
                  title="Open Code Review"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-center gap-1.5 relative z-10 font-mono text-[10px] font-bold tracking-tight">
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
            <div className="w-[1px] h-4 bg-zinc-800/60 shrink-0 self-center mx-1" />
          </>
        )}

        <div className="flex items-center bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-1.5 py-0.5 gap-1 shadow-sm">
          <button
            onClick={() => onSetLayoutOrientation("vertical")}
            className={`p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95 ${layoutOrientation === "vertical" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Vertical Split (Side-by-side)"
          >
            <Columns size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("horizontal")}
            className={`p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95 ${layoutOrientation === "horizontal" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Horizontal Stack"
          >
            <Rows size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("grid")}
            className={`p-1 rounded-lg transition-all shrink-0 ${layoutOrientation === "grid" ? "bg-brand-accent/30 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"}`}
            title="Grid Layout"
          >
            <Grid2X2 size={14} strokeWidth={2.5} />
          </button>

          <div className={`flex items-center gap-1 transition-all duration-700 ease-in-out overflow-hidden ${showExtras ? "max-w-[200px] opacity-100 ml-1 border-l border-zinc-800 pl-1" : "max-w-0 opacity-0"}`}>
            <button
              onClick={() => onSetLayoutOrientation("dynamic")}
              className={`p-1 rounded-lg transition-colors shrink-0 ${layoutOrientation === "dynamic" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Dynamic Bento Grid"
            >
              <Sparkles size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onSetLayoutOrientation("canvas")}
              className={`p-1 rounded-lg transition-colors shrink-0 ${layoutOrientation === "canvas" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Canvas (Free Float)"
            >
              <Layers size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onSetLayoutOrientation("waterfall")}
              className={`p-1 rounded-lg transition-colors shrink-0 ${layoutOrientation === "waterfall" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Waterfall Stream"
            >
              <AlignLeft size={14} strokeWidth={2.5} />
            </button>
          </div>

          <button
            onClick={() => setIsExtraLayoutsOpen(!isExtraLayoutsOpen)}
            className={`p-1 rounded-md transition-all duration-200 hover:scale-105 active:scale-95 ${showExtras ? "bg-white/5 text-zinc-300" : "text-zinc-500 hover:text-zinc-300"}`}
            title={showExtras ? "Collapse Layouts" : "More Layouts"}
          >
            {showExtras ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>

        <div className="w-[1px] h-4 bg-zinc-800/60 shrink-0 self-center mx-1" />

        <div className="h-full flex items-center shrink-0">
          <WindowControls />
        </div>
      </div>
    </div>
  );
}
