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
import { useState } from "react";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface AppTerminalAreaProps {
  agents: string[];
  currentProject: string | null;
  layoutOrientation: "horizontal" | "vertical" | "grid" | "focus" | "presentation" | "canvas" | "waterfall" | "dynamic";
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
  width?: string;
  styleOverrides?: React.CSSProperties;
}

function SortableTerminalWrapper({ agent, currentProject, onRemove, onDetach, onSplit, flexBasis, height, width, styleOverrides }: SortableTerminalWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({
    id: agent,
    data: { agentName: agent }
  });

  const style: React.CSSProperties = {
    position: 'relative' as const,
    flexBasis,
    flexGrow: flexBasis ? 1 : undefined,
    height,
    width,
    ...styleOverrides,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : (styleOverrides?.zIndex ?? 1),
  };

  return (
    <div ref={setNodeRef} style={style} className={`min-h-0 min-w-0 flex-1 flex flex-col bg-app-panel ${isDragging ? "shadow-2xl opacity-90 scale-[1.02] ring-1 ring-brand-accent/50 rounded-md overflow-hidden" : ""}`}>
      {agent.startsWith("browser:") ? (
        <BrowserInstance
          id={agent}
          url={agent.split(":").slice(2).join(":") || ""}
          onRemove={onRemove}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      ) : (
        <TerminalInstance
          agentName={agent}
          cwd={currentProject}
          onRemove={onRemove}
          onDetach={onDetach}
          onSplit={onSplit}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      )}
    </div>
  );
}

// ── Free float terminal wrapper ────────────────────────────────────────────

interface FreeFloatTerminalWrapperProps {
  agent: string;
  currentProject: string | null;
  onRemove: () => void;
  onDetach: () => void;
  onSplit: () => void;
  positionX: number;
  positionY: number;
  zIndex: number;
}

function FreeFloatTerminalWrapper({ agent, currentProject, onRemove, onDetach, onSplit, positionX, positionY, zIndex }: FreeFloatTerminalWrapperProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: agent,
    data: { agentName: agent }
  });

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
  };

  return (
    <div ref={setNodeRef} style={style} className={`min-h-0 min-w-0 flex flex-col bg-app-panel rounded-lg overflow-hidden ring-1 ring-brand-accent/20 ${isDragging ? "opacity-90 scale-[1.02] ring-brand-accent/50 cursor-grabbing" : "cursor-grab"}`}>
      {agent.startsWith("browser:") ? (
        <BrowserInstance
          id={agent}
          url={agent.split(":").slice(2).join(":") || ""}
          onRemove={onRemove}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      ) : (
        <TerminalInstance
          agentName={agent}
          cwd={currentProject}
          onRemove={onRemove}
          onDetach={onDetach}
          onSplit={onSplit}
          dragAttributes={attributes}
          dragListeners={listeners}
        />
      )}
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

  return (
    <div className="flex-1 p-2 bg-transparent flex flex-col min-h-0 min-w-0">
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
                    onRemove={() => onRemoveAgent(agent)}
                    onDetach={() => onDetachAgent(agent)}
                    onSplit={() => onSplit(agent)}
                    positionX={pos.x}
                    positionY={pos.y}
                    zIndex={index + 10}
                  />
                );
              })}
            </div>
          ) : (
            <SortableContext items={agents} strategy={rectSortingStrategy}>
                <div
                className={`flex-1 min-h-0 min-w-0 rounded-lg overflow-hidden border border-app-border bg-app-border flex gap-1 ${
                  layoutOrientation === "horizontal" ? "flex-row" : 
                  layoutOrientation === "vertical" ? "flex-col" : 
                  layoutOrientation === "focus" ? "flex-col flex-wrap content-stretch" :
                  layoutOrientation === "presentation" ? "flex-row flex-wrap content-stretch" :
                  layoutOrientation === "waterfall" ? "flex-col overflow-y-auto block p-1 scroll-smooth" :
                  layoutOrientation === "dynamic" ? "grid grid-cols-4 auto-rows-fr p-1" :
                  "flex-row flex-wrap content-stretch" // grid
                }`}
                style={layoutOrientation === "waterfall" || layoutOrientation === "dynamic" ? { display: layoutOrientation === "dynamic" ? "grid" : "block" } : undefined}
              >
                {agents.map((agent, index) => {
                  let flexBasis: string | undefined = undefined;
                  let height: string | undefined = undefined;
                  let width: string | undefined = undefined;
                  let styleOverrides: React.CSSProperties = {};

                  if (layoutOrientation === "grid") {
                    const cols = Math.ceil(Math.sqrt(agents.length));
                    const rows = Math.ceil(agents.length / cols);
                    const gapTotal = (cols - 1) * 4;
                    flexBasis = `calc((100% - ${gapTotal}px) / ${cols})`; 
                    const gapRowsTotal = (rows - 1) * 4;
                    height = `calc((100% - ${gapRowsTotal}px) / ${rows})`;
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
                  }
                  
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
                      width={width}
                      styleOverrides={styleOverrides}
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
