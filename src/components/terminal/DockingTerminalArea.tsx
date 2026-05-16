/**
 * DockingTerminalArea
 *
 * Replaces AppTerminalArea with a proper IDE-grade docking layout engine.
 * Users can:
 *   - Drag terminal tabs to left/right/top/bottom edges to split the view.
 *   - Drop tabs directly onto other tabs to group them (tabbed panel).
 *   - Resize any pane using the splitters.
 *   - Add new terminals via the "+" button in any tab strip.
 *
 * Built on flexlayout-react (same engine pattern used by many IDE UIs).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Layout,
  Model,
  Actions,
  DockLocation,
  TabNode,
  type IJsonModel,
  type ILayoutApi,
} from "flexlayout-react";
import { TerminalInstance } from "./TerminalInstance";
import { BrowserInstance } from "./BrowserInstance";
import { FolderOpen, Plus } from "lucide-react";
import type { AgentInstance } from "../../types/workspace";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DockingTerminalAreaProps {
  agents: AgentInstance[];
  currentProject: string | null;
  onRemoveAgent: (agentId: string) => void;
  onDetachAgent: (agentId: string) => void;
  onReorderAgents: (oldIndex: number, newIndex: number) => void;
  onSplit: (agentId: string) => void;
  onOpenDirectory?: () => void;
  workspaceName?: string;
  workspaceId: string;
  isGlass?: boolean;
  onFocusAgent?: (agentId: string) => void;
}

// ── Initial model builder ─────────────────────────────────────────────────────

function buildInitialModel(agents: AgentInstance[]): IJsonModel {
  if (agents.length === 0) {
    return {
      global: globalConfig,
      borders: [],
      layout: {
        type: "row",
        children: [],
      },
    };
  }

  return {
    global: globalConfig,
    borders: [],
    layout: {
      type: "row",
      children: [
        {
          type: "tabset",
          weight: 100,
          children: agents.map((agent) => ({
            type: "tab",
            id: agent.id,
            name: agent.name,
            component: agent.name.startsWith("browser:") ? "browser" : "terminal",
          })),
        },
      ],
    },
  };
}

const globalConfig = {
  tabEnableClose: true,
  tabEnableRename: false,
  tabSetEnableMaximize: true,
  tabSetEnableClose: false,
  tabSetMinWidth: 120,
  tabSetMinHeight: 80,
  borderMinSize: 80,
  splitterSize: 2,
  splitterExtra: 6,
  enableEdgeDock: true,
};

// ── Main component ────────────────────────────────────────────────────────────

export function DockingTerminalArea({
  agents,
  currentProject,
  onRemoveAgent,
  onDetachAgent,
  onSplit,
  onOpenDirectory,
  workspaceName,
  workspaceId,
  isGlass,
  onFocusAgent,
}: DockingTerminalAreaProps) {
  const layoutRef = useRef<ILayoutApi>(null);
  const [model, setModel] = useState<Model>(() =>
    Model.fromJson(buildInitialModel(agents))
  );

  // Track which agent IDs are currently in the model
  const agentsInModelRef = useRef<Set<string>>(new Set(agents.map((a) => a.id)));

  // Sync external agent additions/removals into the flexlayout model
  useEffect(() => {
    const currentIds = new Set(agents.map((a) => a.id));
    const modelIds = agentsInModelRef.current;

    // Add new agents that appeared externally (e.g., spawnAgent)
    for (const agent of agents) {
      if (!modelIds.has(agent.id)) {
        try {
          // Find the first tabset to add into
          let targetTabsetId: string | null = null;
          model.visitNodes((node) => {
            if (node.getType() === "tabset" && !targetTabsetId) {
              targetTabsetId = node.getId();
            }
          });

          if (targetTabsetId) {
            model.doAction(
              Actions.addNode(
                {
                  type: "tab",
                  id: agent.id,
                  name: agent.name,
                  component: agent.name.startsWith("browser:") ? "browser" : "terminal",
                },
                targetTabsetId,
                DockLocation.CENTER,
                -1
              )
            );
          } else {
            // No tabset exists — rebuild model
            setModel(Model.fromJson(buildInitialModel(agents)));
            agentsInModelRef.current = new Set(agents.map((a) => a.id));
            return;
          }
        } catch {
          // Model state mismatch — rebuild
          setModel(Model.fromJson(buildInitialModel(agents)));
          agentsInModelRef.current = new Set(agents.map((a) => a.id));
          return;
        }
        modelIds.add(agent.id);
      }
    }

    // Remove agents that were removed externally
    for (const id of Array.from(modelIds)) {
      if (!currentIds.has(id)) {
        try {
          model.doAction(Actions.deleteTab(id));
        } catch {
          // Already removed from model by user drag/close
        }
        modelIds.delete(id);
      }
    }
  }, [agents, model]);

  // Render the content of each tab
  const renderFactory = useCallback(
    (node: TabNode) => {
      const agentId = node.getId();
      const agentName = node.getName();
      const component = node.getComponent();

      const handleRemove = () => {
        onRemoveAgent(agentId);
        agentsInModelRef.current.delete(agentId);
      };
      const handleDetach = () => onDetachAgent(agentId);
      const handleSplit = () => onSplit(agentId);

      if (component === "browser") {
        const url = agentName.split(":").slice(2).join(":") || "";
        return (
          <BrowserInstance
            id={agentId}
            url={url}
            onRemove={handleRemove}
          />
        );
      }

      return (
        <TerminalInstance
          agentId={agentId}
          agentName={agentName}
          cwd={currentProject}
          workspaceName={workspaceName}
          workspaceId={workspaceId}
          onRemove={handleRemove}
          onDetach={handleDetach}
          onSplit={handleSplit}
          onFocus={() => onFocusAgent?.(agentId)}
        />
      );
    },
    [currentProject, workspaceName, workspaceId, onRemoveAgent, onDetachAgent, onSplit, onFocusAgent]
  );

  // Custom tab title renderer
  const onRenderTab = useCallback(
    (node: TabNode, renderValues: { leading: React.ReactNode; content: React.ReactNode }) => {
      renderValues.content = (
        <span className="text-[11px] font-mono font-medium tracking-wide uppercase truncate max-w-[120px]">
          {node.getName()}
        </span>
      );
    },
    []
  );

  // "+" button on each tabset header
  const onRenderTabSet = useCallback(
    (node: any, renderValues: { buttons: React.ReactNode[] }) => {
      renderValues.buttons.push(
        <button
          key="add-tab"
          title="New Terminal"
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors mr-1"
          onClick={() => {
            onSplit(node.getId?.() ?? "");
          }}
        >
          <Plus size={12} />
        </button>
      );
    },
    [onSplit]
  );

  // Sync tab closes back to agent state
  const onAction = useCallback(
    (action: any) => {
      if (action.type === Actions.DELETE_TAB) {
        const tabId = action.data?.node;
        if (tabId) {
          onRemoveAgent(tabId);
          agentsInModelRef.current.delete(tabId);
        }
      }
      return action;
    },
    [onRemoveAgent]
  );

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4 border border-dashed border-app-border rounded-lg">
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
    );
  }

  return (
    <div
      className="flex-1 min-h-0 min-w-0 relative docking-layout"
      data-glass={isGlass ? "true" : undefined}
    >
      <Layout
        ref={layoutRef}
        model={model}
        factory={renderFactory}
        onRenderTab={onRenderTab}
        onRenderTabSet={onRenderTabSet}
        onAction={onAction}
        classNameMapper={(defaultClassName) => defaultClassName}
      />
    </div>
  );
}
