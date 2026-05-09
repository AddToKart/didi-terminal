import { Fragment, type DragEvent } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { TerminalInstance } from "../../components/TerminalInstance";

interface AppTerminalAreaProps {
  agents: string[];
  currentProject: string | null;
  layoutOrientation: "horizontal" | "vertical" | "grid";
  onRemoveAgent: (agent: string) => void;
  onDetachAgent: (agent: string) => void;
  onDragStart: (e: DragEvent, index: number) => void;
  onDrop: (e: DragEvent, index: number) => void;
  onDragOver: (e: DragEvent) => void;
}

export function AppTerminalArea({
  agents,
  currentProject,
  layoutOrientation,
  onRemoveAgent,
  onDetachAgent,
  onDragStart,
  onDrop,
  onDragOver,
}: AppTerminalAreaProps) {
  return (
    <div className="flex-1 p-2 bg-[#020202]">
      {agents.length === 0 ? (
        <div className="h-full flex items-center justify-center text-slate-600 text-sm font-mono border border-dashed border-app-border">
          NO ACTIVE AGENTS
        </div>
      ) : (
        layoutOrientation === "grid" ? (
          <Group orientation="vertical" className="h-full w-full rounded-sm overflow-hidden border border-app-border">
            {Array.from({ length: Math.ceil(agents.length / Math.ceil(Math.sqrt(agents.length))) }).map((_, rowIndex) => {
              const cols = Math.ceil(Math.sqrt(agents.length));
              const rowAgents = agents.slice(rowIndex * cols, rowIndex * cols + cols);
              const rowsCount = Math.ceil(agents.length / cols);
              return (
                <Fragment key={`row-${rowIndex}`}>
                  {rowIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent h-1 my-0.5" />}
                  <Panel defaultSize={100 / rowsCount} minSize={10}>
                    <Group orientation="horizontal" className="h-full w-full">
                      {rowAgents.map((agent, colIndex) => (
                        <Fragment key={agent}>
                          {colIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent w-1 mx-0.5" />}
                          <Panel defaultSize={100 / rowAgents.length} minSize={10}>
                            <TerminalInstance
                              agentName={agent}
                              cwd={currentProject}
                              onRemove={() => onRemoveAgent(agent)}
                              onDetach={() => onDetachAgent(agent)}
                              onDragStart={(e) => onDragStart(e, agents.indexOf(agent))}
                              onDrop={(e) => onDrop(e, agents.indexOf(agent))}
                              onDragOver={onDragOver}
                            />
                          </Panel>
                        </Fragment>
                      ))}
                    </Group>
                  </Panel>
                </Fragment>
              );
            })}
          </Group>
        ) : (
          <Group orientation={layoutOrientation} className="h-full w-full rounded-sm overflow-hidden border border-app-border">
            {agents.map((agent, index) => (
              <Fragment key={agent}>
                {index > 0 && <Separator className={`bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent ${layoutOrientation === "horizontal" ? "w-1 mx-0.5" : "h-1 my-0.5"}`} />}
                <Panel defaultSize={100 / agents.length} minSize={10}>
                  <TerminalInstance
                    agentName={agent}
                    cwd={currentProject}
                    onRemove={() => onRemoveAgent(agent)}
                    onDetach={() => onDetachAgent(agent)}
                    onDragStart={(e: DragEvent) => onDragStart(e, index)}
                    onDrop={(e: DragEvent) => onDrop(e, index)}
                    onDragOver={onDragOver}
                  />
                </Panel>
              </Fragment>
            ))}
          </Group>
        )
      )}
    </div>
  );
}
