import { AmbientMode } from "./AmbientMode";
import { useAppController } from "../../services/use-app-controller";
import { TerminalModePage } from "../../pages/TerminalModePage";
import { OrchestrationModePage } from "../../pages/OrchestrationModePage";
import { ZenModePage } from "../../pages/ZenModePage";

export function OrchestratorApp() {
  const controller = useAppController();

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 overflow-hidden flex selection:bg-brand-accent/20 relative">
      {controller.appMode === "zen" && <ZenModePage controller={controller} />}
      {controller.appMode === "terminal" && <TerminalModePage controller={controller} />}
      {controller.appMode === "orchestrator" && <OrchestrationModePage controller={controller} />}
      <AmbientMode />
    </main>
  );
}

export default OrchestratorApp;
