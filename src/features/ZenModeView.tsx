import { AppTerminalArea } from "../components/layout/AppTerminalArea";
import type { ZenModeProps } from "../types/zen-mode.types";

export function ZenModeView({ controller }: ZenModeProps) {
  const {
    isGlass,
    setAppMode,
    zenAgents,
    setZenAgents,
    zenLayout,
    focusedZenAgent,
    setLastActiveZenAgent,
  } = controller;

  return (
    <section className="flex-1 flex flex-col min-w-0">
      <div
        className="flex-1 min-h-0 min-w-0 flex relative transition-colors duration-500"
        style={{ backgroundColor: isGlass ? "transparent" : "#000000" }}
      >
        <div className="absolute top-0 left-0 right-0 h-2 z-[100] group/exit pointer-events-auto">
          <div className="absolute top-0 left-0 right-0 -translate-y-full group-hover/exit:translate-y-0 transition-transform duration-300 flex items-center justify-center py-4">
            <button
              onClick={() => setAppMode("terminal")}
              className="bg-brand-accent/20 hover:bg-brand-accent/40 text-brand-primary text-[10px] font-bold px-6 py-2 rounded-full border border-brand-accent/30 backdrop-blur-xl shadow-2xl transition-all uppercase tracking-[0.3em]"
            >
              Exit Zen Mode (Alt + Q)
            </button>
          </div>
        </div>

        <AppTerminalArea
          agents={zenAgents}
          currentProject={null}
          layoutOrientation={zenLayout as any}
          onRemoveAgent={agent => setZenAgents(prev => prev.filter(a => a !== agent))}
          onDetachAgent={() => {}}
          onReorderAgents={() => {}}
          onSplit={() => {
            const newId = `zen-terminal-${crypto.randomUUID().slice(0, 4)}`;
            setZenAgents(prev => [...prev, newId]);
            setLastActiveZenAgent(newId);
          }}
          workspaceId="zen"
          isZenMode
          focusedAgentId={focusedZenAgent}
          onFocusAgent={agent => {
            setLastActiveZenAgent(agent);
          }}
          isGlass={isGlass}
        />
      </div>
    </section>
  );
}
