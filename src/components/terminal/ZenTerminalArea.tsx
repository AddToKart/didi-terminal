import { memo, useCallback, useEffect, useRef } from "react";
import { TerminalInstance } from "../terminal/TerminalInstance";
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
import { cn } from "../../lib/cn";
import type { AgentInstance } from "../../types/workspace";
import type { ZenLayoutOrientation } from "../../types/workspace";

// ── Props ─────────────────────────────────────────────────────────────────────

interface ZenTerminalAreaProps {
  agents: AgentInstance[];
  layoutOrientation: ZenLayoutOrientation;
  onRemoveAgent: (agent: string) => void;
  onReorderAgents: (oldIndex: number, newIndex: number) => void;
  onSplit: () => void;
  spotlightAgentId: string | null;
  onSpotlightAgent: (agentId: string) => void;
  isGlass?: boolean;
}

// ── Per-pane wrapper ──────────────────────────────────────────────────────────

interface ZenPaneProps {
  agent: AgentInstance;
  isSpotlit: boolean;
  onFocus: () => void;
  onRemove: () => void;
}

const ZenPane = memo(function ZenPane({ agent, isSpotlit, onFocus, onRemove }: ZenPaneProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: agent.id,
    data: { agentName: agent.name },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        // inset box-shadow draws INSIDE the element — zero space consumed, no clipping.
        // Adjacent panes' shadows overlap at the exact same pixel → always 1px between any two panes.
        // Outer-edge panes get 1px on the outer sides too → perfectly uniform everywhere.
        boxShadow: isSpotlit
          ? "inset 0 0 0 1px rgba(59,130,246,0.65)"
          : "inset 0 0 0 1px rgba(255,255,255,0.15)",
      }}
      className={cn(
        "min-h-0 min-w-0 flex-1 flex flex-col relative bg-black",
        isDragging && "z-50 opacity-90"
      )}
    >
      <TerminalInstance
        agentId={agent.id}
        agentName={agent.name}
        cwd={null}
        workspaceId="zen"
        onRemove={onRemove}
        dragAttributes={attributes}
        dragListeners={listeners}
        isZenMode
        onFocus={onFocus}
      />
    </div>
  );
}, (prev, next) =>
  prev.agent.id === next.agent.id &&
  prev.agent.name === next.agent.name &&
  prev.isSpotlit === next.isSpotlit &&
  prev.onFocus === next.onFocus &&
  prev.onRemove === next.onRemove
);

// ── Grid layout helper ────────────────────────────────────────────────────────

function getGridStyle(count: number): React.CSSProperties {
  const cols = Math.ceil(Math.sqrt(Math.max(1, count)));
  const rows = Math.ceil(count / cols);
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export function ZenTerminalArea({
  agents,
  layoutOrientation,
  onRemoveAgent,
  onReorderAgents,
  onSplit,
  spotlightAgentId,
  onSpotlightAgent,
}: ZenTerminalAreaProps) {
  const onRemoveRef = useRef(onRemoveAgent);
  const onReorderRef = useRef(onReorderAgents);

  useEffect(() => {
    onRemoveRef.current = onRemoveAgent;
    onReorderRef.current = onReorderAgents;
  }, [onRemoveAgent, onReorderAgents]);

  const stableRemove = useCallback((id: string) => onRemoveRef.current(id), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = agents.findIndex(a => a.id === active.id as string);
    const newIndex = agents.findIndex(a => a.id === over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderRef.current(oldIndex, newIndex);
    }
  };

  const isGrid = layoutOrientation === "grid";
  const isHorizontal = layoutOrientation === "horizontal";

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={agents.map(a => a.id)} strategy={rectSortingStrategy}>
        {/*
          The container has a very subtle bg color.
          gap-[1px] makes 1px gaps between panes revealing that bg as a hairline divider.
          This is identical to how AppTerminalArea draws its separators — fully reliable.
        */}
        <div
          className={cn(
            "flex-1 min-h-0 min-w-0",
            isGrid && "grid",
            !isGrid && isHorizontal && "flex flex-row",
            !isGrid && !isHorizontal && "flex flex-col",
          )}
          style={isGrid ? getGridStyle(agents.length) : undefined}
        >
          {agents.map(agent => (
            <ZenPane
              key={agent.id}
              agent={agent}
              isSpotlit={agent.id === spotlightAgentId}
              onFocus={() => onSpotlightAgent(agent.id)}
              onRemove={() => stableRemove(agent.id)}
            />
          ))}
          {/* Hidden split button — split is triggered externally by keyboard shortcut */}
          <button className="hidden" onClick={onSplit} />
        </div>
      </SortableContext>
    </DndContext>
  );
}
