import { NonZenModeShell } from "../features/NonZenModeShell";
import type { TerminalModeProps } from "../types/terminal-mode.types";

export function TerminalModePage({ controller }: TerminalModeProps) {
  return <NonZenModeShell controller={controller} />;
}
