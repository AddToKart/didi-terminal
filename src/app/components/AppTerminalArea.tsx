import { TerminalInstance } from "../../components/TerminalInstance";
import { BrowserInstance } from "../../components/BrowserInstance";
import { FolderOpen } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../lib/utils";

interface AppTerminalAreaProps {
  agents: string[];
  currentProject: string | null;
  layoutOrientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic";
  onRemoveAgent: (agent: string) => void;
  onDetachAgent: (agent: string) => void;
  onReorderAgents: (oldIndex: number, newIndex: number) => void;
  onSplit: (agent: string) => void;
  onOpenDirectory?: () => void;
  workspaceName?: string;
  workspaceId: string;
  isZenMode?: boolean;
  focusedAgentId?: string | null;
  onFocusAgent?: (agent: string) => void;
  isGlass?: boolean;
}

// ── Sortable terminal wrapper ──────────────────────────────────────────────

interface SortableTerminalWrapperProps {
  agent: string;
  currentProject: string | null;
  onRemoveAgent: (agent: string) => void;
  onDetachAgent: (agent: string) => void;
  onSplitAgent: (agent: string) => void;
  flexBasis?: string;
  height?: string;
  width?: string;
  styleOverrides?: React.CSSProperties;
  workspaceName?: string;
  workspaceId: string;
  isZenMode?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  focusedAgentId?: string | null;
  isGlass?: boolean;
}

const shallowEqualStyle = (left?: React.CSSProperties, right?: React.CSSProperties) => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(key => left[key as keyof React.CSSProperties] === right[key as keyof React.CSSProperties]);
};

const SortableTerminalWrapper = memo(function SortableTerminalWrapper({ agent, currentProject, onRemoveAgent, onDetachAgent, onSplitAgent, flexBasis, height, width, styleOverrides, workspaceName, workspaceId, isZenMode, isFocused, onFocus, focusedAgentId, isGlass }: SortableTerminalWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: agent,
    data: { agentName: agent }
  });
  const handleRemove = useCallback(() => onRemoveAgent(agent), [agent, onRemoveAgent]);
  const handleDetach = useCallback(() => onDetachAgent(agent), [agent, onDetachAgent]);
  const handleSplit = useCallback(() => onSplitAgent(agent), [agent, onSplitAgent]);

  const style: React.CSSProperties = {
    position: 'relative' as const,
    flexBasis: isFocused ? '100%' : (focusedAgentId ? '0%' : flexBasis),
    flexGrow: isFocused ? 1 : (focusedAgentId ? 0 : (flexBasis ? 1 : undefined)),
    height: isFocused ? '100%' : (focusedAgentId ? '0%' : height),
    width: isFocused ? '100%' : (focusedAgentId ? '0%' : width),
    opacity: focusedAgentId && !isFocused ? 0 : 1,
    pointerEvents: focusedAgentId && !isFocused ? 'none' : 'auto',
    overflow: 'hidden',
    ...styleOverrides,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : (styleOverrides?.zIndex ?? 1),
  };

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "min-h-0 min-w-0 flex-1 flex flex-col transition-all duration-500 ease-in-out",
        isZenMode && "rounded-lg overflow-hidden",
        isZenMode && isFocused ? "bg-app-panel border-brand-accent/30 ring-1 ring-brand-accent/10 shadow-[0_0_20px_rgba(59,130,246,0.05)]" : "bg-app-panel",
        isZenMode && !isFocused && "border border-app-border",
        isDragging && "shadow-2xl opacity-90 scale-[1.02] ring-1 ring-brand-accent/50 rounded-md overflow-hidden"
      )}
      style={style} 
    >
      {agent.startsWith("browser:") ? (
        <BrowserInstance
          id={agent}
          url={agent.split(":").slice(2).join(":") || ""}
          onRemove={handleRemove}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      ) : (
        <TerminalInstance
          agentName={agent}
          cwd={currentProject}
          workspaceName={workspaceName}
          workspaceId={workspaceId}
          onRemove={handleRemove}
          onDetach={handleDetach}
          onSplit={handleSplit}
          dragAttributes={attributes}
          dragListeners={listeners}
          isZenMode={isZenMode}
          onFocus={onFocus}
        />
      )}
    </div>
  );
}, (prev, next) =>
  prev.agent === next.agent &&
  prev.currentProject === next.currentProject &&
  prev.flexBasis === next.flexBasis &&
  prev.height === next.height &&
  prev.width === next.width &&
  prev.workspaceName === next.workspaceName &&
  prev.workspaceId === next.workspaceId &&
  prev.isZenMode === next.isZenMode &&
  prev.onRemoveAgent === next.onRemoveAgent &&
  prev.onDetachAgent === next.onDetachAgent &&
  prev.onSplitAgent === next.onSplitAgent &&
  prev.isGlass === next.isGlass &&
  shallowEqualStyle(prev.styleOverrides, next.styleOverrides)
);

// ── Free float terminal wrapper ────────────────────────────────────────────

interface FreeFloatTerminalWrapperProps {
  agent: string;
  currentProject: string | null;
  onRemoveAgent: (agent: string) => void;
  onDetachAgent: (agent: string) => void;
  onSplitAgent: (agent: string) => void;
  positionX: number;
  positionY: number;
  zIndex: number;
  workspaceName?: string;
  workspaceId: string;
}

const FreeFloatTerminalWrapper = memo(function FreeFloatTerminalWrapper({ agent, currentProject, onRemoveAgent, onDetachAgent, onSplitAgent, positionX, positionY, zIndex, workspaceName, workspaceId }: FreeFloatTerminalWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: agent,
    data: { agentName: agent }
  });
  const handleRemove = useCallback(() => onRemoveAgent(agent), [agent, onRemoveAgent]);
  const handleDetach = useCallback(() => onDetachAgent(agent), [agent, onDetachAgent]);
  const handleSplit = useCallback(() => onSplitAgent(agent), [agent, onSplitAgent]);

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${positionY}px`,
    left: `${positionX}px`,
    width: '600px',
    height: '400px',
    zIndex: isDragging ? 1000 : zIndex,
    boxShadow: isDragging ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" : "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : "box-shadow 0.2s ease",
    backgroundColor: 'transparent'
  };

  return (
    <div ref={setNodeRef} style={style} className={`min-h-0 min-w-0 flex flex-col bg-transparent rounded-lg overflow-hidden ring-1 ring-brand-accent/20 ${isDragging ? "opacity-90 scale-[1.02] ring-brand-accent/50 cursor-grabbing" : "cursor-grab"}`}>
      {agent.startsWith("browser:") ? (
        <BrowserInstance
          id={agent}
          url={agent.split(":").slice(2).join(":") || ""}
          onRemove={handleRemove}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      ) : (
        <TerminalInstance
          agentName={agent}
          cwd={currentProject}
          workspaceName={workspaceName}
          workspaceId={workspaceId}
          onRemove={handleRemove}
          onDetach={handleDetach}
          onSplit={handleSplit}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      )}
    </div>
  );
}, (prev, next) =>
  prev.agent === next.agent &&
  prev.currentProject === next.currentProject &&
  prev.positionX === next.positionX &&
  prev.positionY === next.positionY &&
  prev.zIndex === next.zIndex &&
  prev.workspaceName === next.workspaceName &&
  prev.workspaceId === next.workspaceId &&
  prev.onRemoveAgent === next.onRemoveAgent &&
  prev.onDetachAgent === next.onDetachAgent &&
  prev.onSplitAgent === next.onSplitAgent
);

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
  workspaceName,
  workspaceId,
  isZenMode,
  focusedAgentId,
  onFocusAgent,
  isGlass,
}: AppTerminalAreaProps) {
  const onRemoveAgentRef = useRef(onRemoveAgent);
  const onDetachAgentRef = useRef(onDetachAgent);
  const onSplitRef = useRef(onSplit);

  useEffect(() => {
    onRemoveAgentRef.current = onRemoveAgent;
    onDetachAgentRef.current = onDetachAgent;
    onSplitRef.current = onSplit;
  }, [onRemoveAgent, onDetachAgent, onSplit]);

  const stableRemoveAgent = useCallback((agent: string) => onRemoveAgentRef.current(agent), []);
  const stableDetachAgent = useCallback((agent: string) => onDetachAgentRef.current(agent), []);
  const stableSplitAgent = useCallback((agent: string) => onSplitRef.current(agent), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [canvasPositions, setCanvasPositions] = useState<Record<string, {x: number, y: number}>>({});

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    
    if (layoutOrientation === "canvas") {
      setCanvasPositions(prev => {
        const existing = prev[active.id as string];
        const defaultIndex = agents.indexOf(active.id as string);
        const startX = existing ? existing.x : Math.min(defaultIndex * 40, 300);
        const startY = existing ? existing.y : Math.min(defaultIndex * 40, 300);
        
        return {
          ...prev,
          [active.id as string]: {
            x: startX + delta.x,
            y: startY + delta.y
          }
        };
      });
      
      const currentIndex = agents.indexOf(active.id as string);
      if (currentIndex !== -1 && currentIndex !== agents.length - 1) {
        onReorderAgents(currentIndex, agents.length - 1);
      }
      return;
    }

    if (!over || active.id === over.id) return;
    
    const oldIndex = agents.indexOf(active.id as string);
    const newIndex = agents.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorderAgents(oldIndex, newIndex);
    }
  };

  const agentsToRender = agents; // Keep all in DOM for animations

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
      {agents.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 border border-dashed border-app-border rounded-lg">
          <div className="text-sm font-mono">NO ACTIVE AGENTS</div>
          {!currentProject && onOpenDirectory && (
            <button
              onClick={onOpenDirectory}
              className="px-4 py-2 bg-zinc-900/40 text-zinc-300 border border-zinc-800/50 rounded-lg hover:bg-zinc-800/40 transition-colors text-xs font-bold flex items-center gap-2"
            >
              <FolderOpen size={14} /> Open Directory
            </button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {layoutOrientation === "canvas" ? (
            <div className="relative flex-1 min-h-0 min-w-0 rounded-lg overflow-hidden border border-app-border bg-app-bg/50 overflow-auto">
              {agents.map((agent, index) => {
                const pos = canvasPositions[agent] || { x: Math.min(index * 40, 300), y: Math.min(index * 40, 300) };
                return (
                  <FreeFloatTerminalWrapper
                    key={agent}
                    agent={agent}
                    currentProject={currentProject}
                    onRemoveAgent={stableRemoveAgent}
                    onDetachAgent={stableDetachAgent}
                    onSplitAgent={stableSplitAgent}
                    positionX={pos.x}
                    positionY={pos.y}
                    zIndex={index + 10}
                    workspaceName={workspaceName}
                    workspaceId={workspaceId}
                  />
                );
              })}
            </div>
          ) : (
            <SortableContext items={agentsToRender} strategy={rectSortingStrategy}>
              <div
                className={cn(
                  "flex-1 min-h-0 min-w-0 transition-all duration-500 ease-in-out",
                  isZenMode ? "bg-transparent gap-2 p-2" : "rounded-lg overflow-hidden border border-app-border bg-app-border gap-1",
                  !focusedAgentId && layoutOrientation === "horizontal" && "flex flex-row",
                  !focusedAgentId && layoutOrientation === "vertical" && "flex flex-col",
                  !focusedAgentId && layoutOrientation === "focus" && "flex flex-col flex-wrap content-stretch",
                  !focusedAgentId && layoutOrientation === "presentation" && "flex flex-row flex-wrap content-stretch",
                  !focusedAgentId && layoutOrientation === "waterfall" && "block overflow-y-auto p-1 scroll-smooth",
                  !focusedAgentId && layoutOrientation === "dynamic" && "grid grid-cols-4 auto-rows-fr p-1",
                  !focusedAgentId && layoutOrientation === "grid" && "grid"
                )}
                style={
                  !focusedAgentId && layoutOrientation === "grid" 
                    ? { 
                        gridTemplateColumns: `repeat(${Math.ceil(Math.sqrt(Math.max(1, agents.length)))}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${Math.ceil(agents.length / Math.ceil(Math.sqrt(Math.max(1, agents.length))))}, minmax(0, 1fr))`
                      } 
                    : (focusedAgentId ? { display: 'flex' } : undefined)
                }
              >
                {agentsToRender.map((agent, index) => {
                  let flexBasis: string | undefined = undefined;
                  let height: string | undefined = undefined;
                  let width: string | undefined = undefined;
                  let styleOverrides: React.CSSProperties = {};

                  if (layoutOrientation === "grid") {
                    styleOverrides = { width: "100%", height: "100%" };
                    
                    const cols = Math.ceil(Math.sqrt(Math.max(1, agents.length)));
                    const remainder = agents.length % cols;
                    
                    // If this is the last item and there's a remainder, span the rest of the columns
                    if (index === agents.length - 1 && remainder !== 0) {
                      const columnsToSpan = cols - remainder + 1;
                      styleOverrides.gridColumn = `span ${columnsToSpan}`;
                    }
                  } else if (layoutOrientation === "focus") {
                    if (agents.length === 1) {
                      flexBasis = "100%";
                      width = "100%";
                    } else {
                      if (index === 0) {
                        flexBasis = "100%";
                        width = "calc(75% - 2px)";
                      } else {
                        const rows = agents.length - 1;
                        const gapRowsTotal = (rows - 1) * 4;
                        flexBasis = `calc((100% - ${gapRowsTotal}px) / ${rows})`;
                        width = "calc(25% - 2px)";
                      }
                    }
                  } else if (layoutOrientation === "presentation") {
                    if (agents.length === 1) {
                      flexBasis = "100%";
                      height = "100%";
                    } else {
                      if (index === 0) {
                        flexBasis = "100%";
                        height = "calc(75% - 2px)";
                      } else {
                        const cols = agents.length - 1;
                        const gapColsTotal = (cols - 1) * 4;
                        flexBasis = `calc((100% - ${gapColsTotal}px) / ${cols})`;
                        height = "calc(25% - 2px)";
                      }
                    }
                  } else if (layoutOrientation === "waterfall") {
                    styleOverrides = {
                      width: "100%",
                      height: "400px",
                      marginBottom: "4px",
                      flexShrink: 0,
                    };
                  } else if (layoutOrientation === "dynamic") {
                    if (agents.length > 2 && index === 0) {
                      styleOverrides = {
                        gridColumn: "span 2",
                        gridRow: "span 2",
                      };
                    } else {
                      styleOverrides = {
                        gridColumn: "span 1",
                        gridRow: "span 1",
                      };
                    }
                    
                    // The dynamic grid has 4 columns.
                    // The first item (if >2 agents) takes up 2x2 (equivalent to 4 standard 1x1 cells).
                    // The remaining items take up 1 cell each.
                    // We calculate the total "cell slots" consumed so far to find the remainder on the last item.
                    if (index === agents.length - 1) {
                      let totalCellsConsumed = 0;
                      if (agents.length > 2) {
                        totalCellsConsumed = 4 + (agents.length - 1 - 1); // 4 for the big one, plus 1 for each other item before this one
                      } else {
                        totalCellsConsumed = agents.length - 1;
                      }
                      
                      const remainder = totalCellsConsumed % 4;
                      if (remainder !== 0) {
                        const columnsToSpan = 4 - remainder;
                        styleOverrides.gridColumn = `span ${columnsToSpan + 1}`; // +1 because the item itself is 1 column
                      }
                    }
                  }
                  
                  return (
                    <SortableTerminalWrapper
                      key={agent}
                      agent={agent}
                      currentProject={currentProject}
                      onRemoveAgent={stableRemoveAgent}
                      onDetachAgent={stableDetachAgent}
                      onSplitAgent={stableSplitAgent}
                      flexBasis={flexBasis}
                      height={height}
                      width={width}
                      styleOverrides={styleOverrides}
                      workspaceName={workspaceName}
                      workspaceId={workspaceId}
                      isZenMode={isZenMode}
                      focusedAgentId={focusedAgentId}
                      isFocused={agent === focusedAgentId}
                      isGlass={isGlass}
                      onFocus={() => onFocusAgent?.(agent)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          )}
        </DndContext>
      )}
    </div>
  );
}
