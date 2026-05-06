import { ReactFlow, Background, Controls, Node as FlowNode, Edge as FlowEdge, MarkerType, Handle, Position, NodeProps } from "@xyflow/react";
import { Network, X, Cpu, Clock, CheckCircle2, Server } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

interface TaskRecord {
  id: string;
  sender: string;
  target: string;
  summary: string;
  status: "pending" | "in_progress" | "complete";
  updatedAt: string;
}

interface Props {
  agents: string[];
  handoffs?: Array<{ id: string; source: string; target: string; kind: string }>;
  tasks?: TaskRecord[];
  onClose: () => void;
}

function AgentNode({ data }: NodeProps) {
  const { label, isWorking, isWaiting, waitingOn, isMain } = data as any;
  
  return (
    <div className={`px-4 py-4 rounded-lg border bg-zinc-950 min-w-[220px] max-w-[260px] shadow-md transition-all duration-300
      ${isWorking ? 'border-amber-500/50 shadow-amber-500/10' : 
        isWaiting ? 'border-zinc-600 shadow-zinc-900/20' : 
        isMain ? 'border-brand-accent/50 shadow-brand-accent/10' : 'border-zinc-800 shadow-zinc-900/10'}`}>
      
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-zinc-600 border-none opacity-0" />
      
      <div className="flex items-center justify-between mb-3 border-b border-zinc-800/60 pb-3">
        <div className="flex items-center gap-2">
          {isMain ? (
            <Server size={16} className="text-brand-accent" />
          ) : (
            <Cpu size={16} className={isWorking ? 'text-amber-400' : 'text-zinc-400'} />
          )}
          <span className={`font-semibold text-sm tracking-tight truncate ${isMain ? 'text-brand-primary' : 'text-zinc-200'}`}>
            {label}
          </span>
        </div>
        {isMain && <span className="text-[9px] uppercase font-bold tracking-widest text-brand-accent/80 bg-brand-accent/10 px-1.5 py-0.5 rounded-sm">ROOT</span>}
      </div>
      
      <div className="text-xs space-y-2">
        {isWorking && (
          <div className="flex items-start gap-2 text-amber-400 bg-amber-400/10 p-2 rounded-sm border border-amber-400/20">
            <Clock size={14} className="animate-spin-slow shrink-0 mt-0.5" />
            <span className="font-medium leading-tight">Working...</span>
          </div>
        )}
        {isWaiting && (
          <div className="flex items-start gap-2 text-zinc-400 bg-zinc-900 p-2 rounded-sm border border-zinc-800">
            <Clock size={14} className="shrink-0 mt-0.5" />
            <span className="leading-tight break-words">Waiting on {waitingOn.join(', ')}</span>
          </div>
        )}
        {!isWorking && !isWaiting && (
          <div className="flex items-start gap-2 text-emerald-400 bg-emerald-400/10 p-2 rounded-sm border border-emerald-400/20">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span className="font-medium">Idle / Ready</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-zinc-600 border-none opacity-0" />
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentNode,
};

function getLayoutedElements(nodes: FlowNode[], edges: FlowEdge[]) {
  if (nodes.length === 0) return { nodes, edges };

  // Find orchestrator node
  const orchestratorIndex = nodes.findIndex(n => n.id.toLowerCase() === 'orchestrator' || n.id.toLowerCase() === 'main terminal');
  const mainNodeIndex = orchestratorIndex >= 0 ? orchestratorIndex : 0;
  
  const mainNode = nodes[mainNodeIndex];
  const otherNodes = nodes.filter((_, i) => i !== mainNodeIndex);

  const centerX = 500; 
  const topY = 100;
  const bottomY = 350;

  mainNode.position = { x: centerX - 110, y: topY }; // Adjust by approx half node width

  // Arrange other nodes in a row or grid below
  const spacingX = 280;
  const maxPerRow = 5;
  
  otherNodes.forEach((node, i) => {
    const row = Math.floor(i / maxPerRow);
    const col = i % maxPerRow;
    const nodesInThisRow = Math.min(otherNodes.length - row * maxPerRow, maxPerRow);
    
    const totalWidth = (nodesInThisRow - 1) * spacingX;
    const startX = centerX - (totalWidth / 2);

    node.position = {
      x: startX + (col * spacingX) - 110,
      y: bottomY + (row * 200)
    };
  });

  return { nodes, edges };
}

export function NetworkGraph({ agents, tasks = [], onClose }: Props) {
  
  const { nodes, edges } = useMemo(() => {
    const activeTasks = tasks.filter(t => t.status === "in_progress");
    
    const orchestratorId = agents.find(a => a.toLowerCase() === 'orchestrator' || a.toLowerCase() === 'main terminal') || agents[0];

    const initialNodes: FlowNode[] = agents.map((agent) => {
      const workingOn = activeTasks.filter(t => t.target === agent);
      const waitingTasks = activeTasks.filter(t => t.sender === agent);
      
      const isWorking = workingOn.length > 0;
      const isWaiting = waitingTasks.length > 0;
      const waitingOn = Array.from(new Set(waitingTasks.map(t => t.target)));
      const isMain = agent === orchestratorId;
      
      return {
        id: agent,
        type: 'agentNode',
        position: { x: 0, y: 0 },
        data: { label: agent, isWorking, isWaiting, waitingOn, isMain },
      };
    });

    const initialEdges: FlowEdge[] = [];

    // Implicit edges from Orchestrator to all other nodes (structural)
    agents.forEach(agent => {
      if (agent !== orchestratorId) {
        initialEdges.push({
          id: `structural-${orchestratorId}-${agent}`,
          source: orchestratorId,
          target: agent,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#27272a', strokeWidth: 1.5 }, // zinc-800
          focusable: false,
          selectable: false,
          zIndex: -1,
        });
      }
    });

    // Active Task Edges
    activeTasks.forEach((task) => {
      initialEdges.push({
        id: task.id,
        source: task.sender,
        target: task.target,
        label: 'Delegating...',
        labelStyle: { fill: '#fbbf24', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' },
        labelBgStyle: { fill: '#09090b', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        animated: true,
        type: 'smoothstep',
        style: { stroke: '#fbbf24', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#fbbf24',
        },
        zIndex: 10,
      });
    });

    // Recently Completed Tasks
    const completedTasks = tasks.filter(t => t.status === "complete").slice(0, 15);
    completedTasks.forEach(task => {
      if (!initialEdges.find(e => e.id === task.id)) {
        initialEdges.push({
          id: task.id,
          source: task.sender,
          target: task.target,
          label: 'Completed',
          labelStyle: { fill: '#34d399', fontSize: 10, fontFamily: 'Inter, sans-serif' },
          labelBgStyle: { fill: '#09090b', fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
          animated: false,
          type: 'smoothstep',
          style: { stroke: '#34d399', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#34d399',
          },
          zIndex: 5,
        });
      }
    });

    return getLayoutedElements(initialNodes, initialEdges);
  }, [agents, tasks]);

  return (
    <div className="absolute inset-0 z-50 bg-app-bg/95 backdrop-blur-sm flex flex-col p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl text-brand-primary font-bold tracking-tight flex items-center gap-2.5 mb-1">
            <Network className="text-brand-accent stroke-[2]" size={22} /> Orchestration Map
          </h2>
          <p className="text-zinc-500 text-xs font-medium">Live visualization of hierarchy and task dependencies.</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-2 border border-zinc-800 hover:border-zinc-600 rounded-sm bg-zinc-950 transition-colors shadow-sm">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 border border-zinc-800 rounded-lg bg-app-bg overflow-hidden relative shadow-inner">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={1.5}>
          <Background color="#27272a" gap={24} size={1.5} />
          <Controls className="bg-zinc-950 text-brand-primary border border-zinc-800 shadow-md" />
        </ReactFlow>
      </div>
    </div>
  );
}
