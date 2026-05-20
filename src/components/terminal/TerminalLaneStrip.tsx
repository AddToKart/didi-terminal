import { memo } from "react";
import { X, Plus } from "lucide-react";
import { ROOT_TERMINAL_LANE_ID, type TerminalLane } from "../../services/terminal-lanes";

export interface TerminalLaneStripProps {
  lanes: TerminalLane[];
  activeLaneId: string;
  editingLaneId: string | null;
  editLaneLabel: string;
  onSelectLane: (laneId: string) => void;
  onAddLane: (event: React.MouseEvent) => void;
  onCloseLane: (event: React.MouseEvent, laneId: string) => void;
  onStartRenameLane: (lane: TerminalLane) => void;
  onEditLaneLabelChange: (value: string) => void;
  onCommitRenameLane: () => void;
  onCancelRenameLane: () => void;
  containerWidth: number;
}

export const TerminalLaneStrip = memo(({
  lanes,
  activeLaneId,
  editingLaneId,
  editLaneLabel,
  onSelectLane,
  onAddLane,
  onCloseLane,
  onStartRenameLane,
  onEditLaneLabelChange,
  onCommitRenameLane,
  onCancelRenameLane,
  containerWidth,
}: TerminalLaneStripProps) => {
  const isCompact = containerWidth < 420;
  const isSuperCompact = containerWidth < 300;

  return (
    <div
      className="h-full flex items-center min-w-0 flex-1 overflow-x-auto custom-scrollbar border-l border-app-border"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <div className="flex items-center h-full">
        {lanes.map((lane, index) => {
          const isActive = lane.id === activeLaneId;
          const isEditing = lane.id === editingLaneId;
          const displayText = isSuperCompact ? `${index + 1}` : lane.label;

          return (
            <div
              key={lane.id}
              onClick={() => {
                if (!isEditing) onSelectLane(lane.id);
              }}
              onDoubleClick={() => onStartRenameLane(lane)}
              className={`group flex items-center gap-1.5 h-full border-r border-app-border cursor-pointer select-none transition-all ${
                isSuperCompact
                  ? "px-2.5 min-w-[28px] max-w-[40px]"
                  : isCompact
                  ? "px-2 min-w-[50px] max-w-[80px]"
                  : "px-3 min-w-[92px] max-w-[160px]"
              } ${isActive
                  ? "bg-app-panel text-white shadow-[inset_0_-2px_0_0_var(--tw-colors-brand-accent)]"
                  : "bg-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              title={`Switch to ${lane.label}`}
            >
              {isEditing ? (
                <input
                  value={editLaneLabel}
                  onChange={(event) => onEditLaneLabelChange(event.target.value)}
                  onBlur={onCommitRenameLane}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onCommitRenameLane();
                    if (event.key === "Escape") onCancelRenameLane();
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  autoFocus
                  className="bg-transparent border-none outline-none text-xs font-bold text-white flex-1 min-w-0"
                />
              ) : (
                <span className={`text-[10px] truncate flex-1 text-center ${isActive ? "font-bold" : "font-medium"}`}>
                  {displayText}
                </span>
              )}
              {lane.id !== ROOT_TERMINAL_LANE_ID && !isSuperCompact && (
                <button
                  type="button"
                  onClick={(event) => onCloseLane(event, lane.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  className={`p-0.5 rounded transition-colors ${isActive
                      ? "text-brand-primary/80 hover:text-white hover:bg-white/10"
                      : "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                    }`}
                  title={`Close ${lane.label}`}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAddLane}
        onPointerDown={(event) => event.stopPropagation()}
        className={`h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border-r border-app-border shrink-0 ${
          isSuperCompact ? "w-6" : isCompact ? "w-8" : "w-10"
        }`}
      >
        <Plus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
});
