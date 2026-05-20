import { NonZenModeShell } from "../features/NonZenModeShell";
import { OrchestrationSidebarFeature } from "../features/OrchestrationSidebarFeature";

export function OrchestrationModePage() {
  return (
    <NonZenModeShell
      rightSidebar={<OrchestrationSidebarFeature />}
    />
  );
}
