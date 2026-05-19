import { invoke } from "@tauri-apps/api/core";
import { WindowControls } from "../components/layout/WindowControls";
import { ZenTerminalArea } from "../components/terminal/ZenTerminalArea";
import { getTerminalLanePtyKey } from "@/services/terminal-lanes";
import type { ZenModeProps } from "../types/zen-mode.types";

export function ZenModeView({ controller }: ZenModeProps) {
  const {
    isGlass,
    setAppMode,
    activeWorkspaceId,
    zenAgents,
    setZenAgents,
    zenLayout,
    lastActiveZenAgent,
    setLastActiveZenAgent,
    focusedZenAgent,
  } = controller;
  const zenWorkspaceId = `zen::${activeWorkspaceId}`;

  const removeZenAgent = (agent: string) => {
    invoke("close_pty", { agent: getTerminalLanePtyKey(zenWorkspaceId, agent) }).catch(console.error);
    setZenAgents(prev => prev.filter(a => a !== agent));
  };

  return (
    <section className="flex-1 flex flex-col min-w-0">
      <div
        className="flex-1 min-h-0 min-w-0 flex relative transition-colors duration-500"
        style={{ backgroundColor: isGlass ? "transparent" : "#000000" }}
      >
        {/* Hidden hover zone at top → reveals exit + window controls */}
        <div className="absolute top-0 left-0 right-0 h-2 z-[100] group/exit pointer-events-auto">
          <div className="absolute top-0 left-0 right-0 -translate-y-full group-hover/exit:translate-y-0 transition-transform duration-300 flex items-center justify-center py-4">
            <button
              onClick={() => setAppMode("terminal")}
              className="bg-zinc-900 hover:bg-zinc-800 text-brand-primary text-[10px] font-bold px-6 py-2 rounded-full border border-zinc-700 shadow-2xl transition-all uppercase tracking-[0.3em]"
            >
              Exit Zen Mode (Alt + Q)
            </button>
            <div className="absolute right-4 top-4 h-9 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
              <WindowControls />
            </div>
          </div>
        </div>

        <ZenTerminalArea
          agents={zenAgents.map(a => ({ id: a, name: a }))}
          layoutOrientation={zenLayout}
          onRemoveAgent={removeZenAgent}
          onReorderAgents={() => {}}
          onSplit={() => {
            const newId = `zen-terminal-${crypto.randomUUID().slice(0, 4)}`;
            setZenAgents(prev => [...prev, newId]);
            setLastActiveZenAgent(newId);
          }}
          spotlightAgentId={lastActiveZenAgent}
          onSpotlightAgent={setLastActiveZenAgent}
          focusedAgentId={focusedZenAgent}
          workspaceId={zenWorkspaceId}
          isGlass={isGlass}
        />
      </div>
    </section>
  );
}
