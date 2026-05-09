import { Code2, FolderOpen, TerminalSquare, Workflow, Settings, Bell, Palette, Plus } from "lucide-react";

interface AppGlobalSidebarProps {
  appMode: "terminal" | "orchestrator";
  onSetAppMode: (mode: "terminal" | "orchestrator") => void;
  currentProject: string | null;
  onOpenProject: () => void;
  onOpenSettings: () => void;
}

export function AppGlobalSidebar({
  appMode,
  onSetAppMode,
  currentProject,
  onOpenProject,
  onOpenSettings,
}: AppGlobalSidebarProps) {
  return (
    <aside className="w-64 border-r border-app-border bg-[#0d0d0f] flex flex-col shadow-xl z-20 shrink-0">
      <div className="p-4 border-b border-app-border/50">
        <div className="flex items-center gap-2.5 text-zinc-200 font-bold tracking-wide">
          <Code2 className="text-brand-accent" size={22} />
          <span>DidiTerminal</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Modes</div>
          <div className="space-y-1">
            <button
              onClick={() => onSetAppMode("terminal")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                appMode === "terminal"
                  ? "bg-brand-accent/10 text-brand-accent shadow-sm ring-1 ring-brand-accent/30"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <TerminalSquare size={16} className={appMode === "terminal" ? "text-brand-accent" : "text-zinc-500"} />
              Terminal
            </button>
            <button
              onClick={() => onSetAppMode("orchestrator")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                appMode === "orchestrator"
                  ? "bg-purple-500/10 text-purple-400 shadow-sm ring-1 ring-purple-500/30"
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <Workflow size={16} className={appMode === "orchestrator" ? "text-purple-400" : "text-zinc-500"} />
              Orchestrator
            </button>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">Projects</div>
          <div className="space-y-1">
            {currentProject ? (
              <div className="group flex items-center justify-between px-3 py-2.5 bg-zinc-900 border border-zinc-800/80 rounded-lg shadow-sm">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FolderOpen size={12} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-zinc-200 truncate">{currentProject.split("\\").pop()?.split("/").pop()}</div>
                    <div className="text-[10px] text-zinc-500 font-medium">Active</div>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              onClick={onOpenProject}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-800"
            >
              <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0">
                <Plus size={12} />
              </div>
              Add Project
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-app-border/50 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
            <Palette size={16} />
          </button>
          <button className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
            <Bell size={16} />
          </button>
        </div>
        <button onClick={onOpenSettings} className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
