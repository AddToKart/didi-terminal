import { TerminalInstance } from "../../components/TerminalInstance";
import { FolderOpen } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AppTerminalAreaProps {
  agents: string[];
  currentProject: string | null;
  layoutOrientation: "horizontal" | "vertical" | "grid";
  onRemoveAgent: (agent: string) => void;
  onDetachAgent: (agent: string) => void;
  onReorderAgents: (oldIndex: number, newIndex: number) => void;
  onSplit: (agent: string) => void;
  onOpenDirectory?: () => void;
}

// ── Sortable terminal wrapper ──────────────────────────────────────────────

interface SortableTerminalWrapperProps {
  agent: string;
  currentProject: string | null;
  onRemove: () => void;
  onDetach: () => void;
  onSplit: () => void;
  flexBasis?: string;
  height?: string;
}

function SortableTerminalWrapper({ agent, currentProject, onRemove, onDetach, onSplit, flexBasis, height }: SortableTerminalWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: agent,
    data: { agentName: agent }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    position: 'relative' as const,
    flexBasis,
    flexGrow: flexBasis ? 1 : undefined,
    height,
  };

  return (
    <div ref={setNodeRef} style={style} className={`min-h-0 min-w-0 flex-1 flex flex-col bg-[#020202] ${isDragging ? "shadow-2xl opacity-90 scale-[1.02] ring-1 ring-brand-accent/50 rounded-md overflow-hidden" : ""}`}>
      <TerminalInstance
        agentName={agent}
        cwd={currentProject}
        onRemove={onRemove}
        onDetach={onDetach}
        onSplit={onSplit}
        dragAttributes={attributes}
        dragListeners={listeners}
      />
    </div>
  );
}

// ── Main terminal area ────────────────────────────────────────────────────────

export function AppTerminalArea({
  agents,
  currentProject,
  layoutOrientation,
  onRemoveAgent,
  onDetachAgent,
  onReorderAgents,
  onSplit,
  onOpenDirectory,
}: AppTerminalAreaProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = agents.indexOf(active.id as string);
    const newIndex = agents.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderAgents(oldIndex, newIndex);
    }
  };

  return (
    <div className="flex-1 p-2 bg-[#020202] flex flex-col min-h-0 min-w-0">
      {agents.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 border border-dashed border-app-border rounded-lg">
          <div className="text-sm font-mono">NO ACTIVE AGENTS</div>
          {!currentProject && onOpenDirectory && (
            <button
              onClick={onOpenDirectory}
              className="px-4 py-2 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors text-xs font-bold flex items-center gap-2"
            >
              <FolderOpen size={14} /> Open Directory
            </button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={agents} strategy={rectSortingStrategy}>
            <div
              className={`flex-1 min-h-0 min-w-0 rounded-lg overflow-hidden border border-app-border bg-app-border ${
                layoutOrientation === "grid"
                  ? "flex flex-row flex-wrap content-stretch gap-1"
                  : `flex gap-1 ${layoutOrientation === "horizontal" ? "flex-row" : "flex-col"}`
              }`}
            >
              {agents.map((agent) => {
                const cols = Math.ceil(Math.sqrt(agents.length));
                const rows = Math.ceil(agents.length / cols);
                
                // Calculate the exact mathematical flex-basis to fit `cols` items perfectly.
                // gap-1 is 4px. A row of `cols` items has `cols - 1` gaps.
                const gapTotal = (cols - 1) * 4;
                const flexBasis = layoutOrientation === "grid" 
                  ? `calc((100% - ${gapTotal}px) / ${cols})` 
                  : undefined;
                  
                const gapRowsTotal = (rows - 1) * 4;
                const height = layoutOrientation === "grid"
                  ? `calc((100% - ${gapRowsTotal}px) / ${rows})`
                  : undefined;
                
                return (
                  <SortableTerminalWrapper
                    key={agent}
                    agent={agent}
                    currentProject={currentProject}
                    onRemove={() => onRemoveAgent(agent)}
                    onDetach={() => onDetachAgent(agent)}
                    onSplit={() => onSplit(agent)}
                    flexBasis={flexBasis}
                    height={height}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
