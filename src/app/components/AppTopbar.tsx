import { useState, type FormEvent } from "react";
import { Brain, ClipboardList, Columns, Globe, Grid2X2, Network, PanelLeft, PanelLeftClose, Plus, Rows, PanelRight, Presentation, Layers, AlignLeft, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";

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
}: AppTopbarProps) {
  const [isExtraLayoutsOpen, setIsExtraLayoutsOpen] = useState(false);

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

        <div className="flex items-center gap-1 bg-app-panel p-1 border border-app-border rounded-lg shadow-inner">
          <button
            onClick={() => onSetLayoutOrientation("horizontal")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "horizontal" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
            title="Vertical Splits"
          >
            <Columns size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("vertical")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "vertical" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
            title="Horizontal Splits"
          >
            <Rows size={14} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("grid")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "grid" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
            title="Grid Split"
          >
            <Grid2X2 size={14} strokeWidth={2.5} />
          </button>
          <div className="w-px h-4 bg-zinc-700/50 mx-1" />
          
          <div className={`flex items-center gap-1 transition-all duration-300 overflow-hidden ${showExtras ? "max-w-[400px] opacity-100" : "max-w-0 opacity-0"}`}>
            <button
              onClick={() => onSetLayoutOrientation("focus")}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${layoutOrientation === "focus" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Focus Mode (The Pilot)"
            >
              <PanelRight size={14} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => onSetLayoutOrientation("presentation")}
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${layoutOrientation === "presentation" ? "bg-brand-accent/30 text-white" : "text-zinc-400 hover:text-white"}`}
              title="Broadcast Mode"
            >
              <Presentation size={14} strokeWidth={2.5} />
            </button>
            <div className="w-px h-4 bg-zinc-700/50 mx-0.5 shrink-0" />
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
