import { memo, useCallback, useEffect, useMemo, useRef } from "react";
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
  focusedAgentId: string | null;
  workspaceId: string;
  isGlass?: boolean;
}

// ── Per-pane wrapper ──────────────────────────────────────────────────────────

interface ZenPaneProps {
  agent: AgentInstance;
  isSpotlit: boolean;
  isFocused: boolean;
  hasFocusedPane: boolean;
  workspaceId: string;
  onFocus: () => void;
  onRemove: () => void;
}

const ZenPane = memo(function ZenPane({
  agent,
  isSpotlit,
  isFocused,
  hasFocusedPane,
  workspaceId,
  onFocus,
  onRemove,
}: ZenPaneProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: agent.id,
    data: { agentName: agent.name },
  });

  const style: React.CSSProperties = {
    display: hasFocusedPane && !isFocused ? "none" : undefined,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      data-agent-id={agent.id}
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
        "zen-pane min-h-0 min-w-0 flex flex-col relative overflow-hidden bg-black",
        hasFocusedPane ? "h-full w-full flex-1" : "flex-1",
        isDragging && "z-50 opacity-90 ring-1 ring-brand-accent/60"
      )}
      onMouseDown={onFocus}
    >
      <TerminalInstance
        agentId={agent.id}
        agentName={agent.name}
        cwd={null}
        workspaceId={workspaceId}
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
  prev.isFocused === next.isFocused &&
  prev.hasFocusedPane === next.hasFocusedPane &&
  prev.workspaceId === next.workspaceId &&
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
  focusedAgentId,
  workspaceId,
}: ZenTerminalAreaProps) {
  const onRemoveRef = useRef(onRemoveAgent);
  const onReorderRef = useRef(onReorderAgents);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const hasFocusedPane = Boolean(focusedAgentId);
  const visibleAgents = useMemo(
    () => agents.filter(agent => !hasFocusedPane || agent.id === focusedAgentId),
    [agents, focusedAgentId, hasFocusedPane]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("terminal-layout-resize-end"));
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedAgentId, layoutOrientation, agents.length]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={agents.map(a => a.id)} strategy={rectSortingStrategy}>
        {/*
          The container has a very subtle bg color.
          gap-[1px] makes 1px gaps between panes revealing that bg as a hairline divider.
          This is identical to how AppTerminalArea draws its separators — fully reliable.
        */}
        <div
          ref={containerRef}
          className={cn(
            "zen-terminal-grid flex-1 min-h-0 min-w-0 overflow-hidden bg-black",
            hasFocusedPane && "flex",
            !hasFocusedPane && isGrid && "grid",
            !hasFocusedPane && !isGrid && isHorizontal && "flex flex-row",
            !hasFocusedPane && !isGrid && !isHorizontal && "flex flex-col",
          )}
          style={!hasFocusedPane && isGrid ? getGridStyle(visibleAgents.length) : undefined}
        >
          {agents.map(agent => (
            <ZenPane
              key={agent.id}
              agent={agent}
              isSpotlit={agent.id === spotlightAgentId}
              isFocused={agent.id === focusedAgentId}
              hasFocusedPane={hasFocusedPane}
              workspaceId={workspaceId}
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
