import { EditorShell } from "@/features/EditorShell";
import type { AppController } from "@/services/use-app-controller";

interface EditorModeProps {
  controller: AppController;
}

export function EditorModePage({ controller }: EditorModeProps) {
  return <EditorShell controller={controller} />;
}
