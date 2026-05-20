import { AmbientMode } from "./AmbientMode";
import { useAppController } from "../../services/use-app-controller";
import { TerminalModePage } from "../../pages/TerminalModePage";
import { OrchestrationModePage } from "../../pages/OrchestrationModePage";
import { ZenModePage } from "../../pages/ZenModePage";
import { EditorModePage } from "../../pages/EditorModePage";

export function OrchestratorApp() {
  const controller = useAppController();

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 overflow-hidden flex selection:bg-brand-accent/20 relative">
      {controller.appMode === "zen" && <ZenModePage />}
      {controller.appMode === "terminal" && <TerminalModePage />}
      {controller.appMode === "orchestrator" && <OrchestrationModePage />}
      {controller.appMode === "editor" && <EditorModePage />}
      <AmbientMode />
    </main>
  );
}

export default OrchestratorApp;
