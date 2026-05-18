import { NonZenModeShell } from "../features/NonZenModeShell";
import { OrchestrationSidebarFeature } from "../features/OrchestrationSidebarFeature";
import type { OrchestrationModeProps } from "../types/orchestration-mode.types";

export function OrchestrationModePage({ controller }: OrchestrationModeProps) {
  return (
    <NonZenModeShell
      controller={controller}
      rightSidebar={<OrchestrationSidebarFeature controller={controller} />}
    />
  );
}
