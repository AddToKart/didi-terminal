import { AlignLeft, Columns, Grid2X2, Layers, Rows, Sparkles } from "lucide-react";
import type { TerminalLayoutOrientation } from "@/types/workspace";

interface TerminalPaneLayoutControlsProps {
  layoutOrientation: TerminalLayoutOrientation;
  onSetLayoutOrientation: (orientation: TerminalLayoutOrientation) => void;
}

const layoutActions: Array<{
  orientation: TerminalLayoutOrientation;
  title: string;
  icon: typeof Columns;
}> = [
  { orientation: "vertical", title: "Side-by-side", icon: Columns },
  { orientation: "horizontal", title: "Stack", icon: Rows },
  { orientation: "grid", title: "Grid", icon: Grid2X2 },
  { orientation: "dynamic", title: "Dynamic", icon: Sparkles },
  { orientation: "canvas", title: "Canvas", icon: Layers },
  { orientation: "waterfall", title: "Waterfall", icon: AlignLeft },
];

export function TerminalPaneLayoutControls({
  layoutOrientation,
  onSetLayoutOrientation,
}: TerminalPaneLayoutControlsProps) {
  return (
    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      {layoutActions.map(({ orientation, title, icon: Icon }) => (
        <button
          key={orientation}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSetLayoutOrientation(orientation);
          }}
          className={`rounded p-0.5 transition-colors ${
            layoutOrientation === orientation
              ? "bg-brand-accent/25 text-white"
              : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
          }`}
          title={title}
        >
          <Icon size={11} strokeWidth={2.5} />
        </button>
      ))}
    </div>
  );
}
