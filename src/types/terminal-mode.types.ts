import type { ReactNode } from "react";
import type { AppController } from "../services/use-app-controller";

export interface TerminalModeProps {
  controller: AppController;
}

export interface NonZenModeShellProps extends TerminalModeProps {
  rightSidebar?: ReactNode;
}
