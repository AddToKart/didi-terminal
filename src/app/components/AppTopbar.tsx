import type { FormEvent } from "react";
import { Brain, ClipboardList, Columns, Grid2X2, Network, PanelLeft, PanelLeftClose, Plus, Rows } from "lucide-react";

interface AppTopbarProps {
  appMode: "terminal" | "orchestrator";
  onSpawnAgent: (e: FormEvent) => void;
  newAgentName: string;
  onChangeNewAgentName: (value: string) => void;
  onOpenBrainstorm: () => void;
  onOpenMasterPlan: () => void;
  onOpenNetworkGraph: () => void;
  layoutOrientation: "horizontal" | "vertical" | "grid";
  onSetLayoutOrientation: (orientation: "horizontal" | "vertical" | "grid") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
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
}: AppTopbarProps) {
  return (
    <div className="h-14 border-b border-app-border flex items-center justify-between px-4 bg-app-bg">
      <form onSubmit={onSpawnAgent} className="flex items-center gap-2">
        <div className="relative flex items-center">
          <button type="submit" className="absolute left-1.5 text-slate-500 hover:text-brand-primary transition-colors p-1 z-10 rounded">
            <Plus size={14} />
          </button>
          <input
            type="text"
            value={newAgentName}
            onChange={e => onChangeNewAgentName(e.target.value)}
            placeholder={appMode === "terminal" ? "Spawn new terminal..." : "Spawn new agent..."}
            className="bg-[#0a0a0c] border border-app-border focus:border-brand-accent text-slate-200 pl-8 pr-3 py-1.5 text-xs outline-none transition-colors w-64 placeholder:text-slate-600 rounded-lg"
          />
        </div>
      </form>

      <div className="flex items-center gap-2">
        {appMode === "orchestrator" && (
          <>
            <button
              onClick={onOpenBrainstorm}
              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Brainstorm Mode"
            >
              <Brain size={16} />
            </button>
            <button
              onClick={onOpenMasterPlan}
              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Master Plan Board"
            >
              <ClipboardList size={16} />
            </button>
            <button
              onClick={onOpenNetworkGraph}
              className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Collaboration Graph"
            >
              <Network size={16} />
            </button>
          </>
        )}

        <div className="flex items-center gap-1 bg-[#0a0a0c] p-1 border border-app-border rounded-lg">
          <button
            onClick={() => onSetLayoutOrientation("horizontal")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "horizontal" ? "bg-brand-accent/20 text-brand-primary" : "text-slate-500 hover:text-slate-300"}`}
            title="Vertical Splits"
          >
            <Columns size={14} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("vertical")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "vertical" ? "bg-brand-accent/20 text-brand-primary" : "text-slate-500 hover:text-slate-300"}`}
            title="Horizontal Splits"
          >
            <Rows size={14} />
          </button>
          <button
            onClick={() => onSetLayoutOrientation("grid")}
            className={`p-1.5 rounded-lg transition-colors ${layoutOrientation === "grid" ? "bg-brand-accent/20 text-brand-primary" : "text-slate-500 hover:text-slate-300"}`}
            title="Grid Split"
          >
            <Grid2X2 size={14} />
          </button>
        </div>

        {appMode === "orchestrator" && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}
