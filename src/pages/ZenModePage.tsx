import { ZenModeView } from "../features/ZenModeView";
import type { ZenModeProps } from "../types/zen-mode.types";

export function ZenModePage({ controller }: ZenModeProps) {
  return <ZenModeView controller={controller} />;
}
