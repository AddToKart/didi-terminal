import { ReactFlow, Background, Controls, Node as FlowNode, Edge as FlowEdge, MarkerType, Handle, Position, NodeProps } from "@xyflow/react";
import { Network, X, Cpu, Clock, CheckCircle2 } from "lucide-react";
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
  handoffs: Array<{ id: string; source: string; target: string; kind: string }>;
  tasks?: TaskRecord[];
  onClose: () => void;
}

function AgentNode({ data }: NodeProps) {
  const { label, isWorking, isWaiting, waitingOn } = data as any;
  
  return (
    <div className={`px-4 py-3 rounded-md border-2 bg-[#0a0a0c] min-w-[200px] max-w-[250px] shadow-lg
      ${isWorking ? 'border-brand-warn shadow-brand-warn/20' : 
        isWaiting ? 'border-slate-500 shadow-slate-500/20' : 
        'border-brand-accent shadow-brand-accent/20'}`}>
      
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-brand-accent opacity-0" />
      
      <div className="flex items-center justify-between mb-3 border-b border-app-border pb-2">
        <div className="flex items-center gap-2">
          <Cpu size={16} className={isWorking ? 'text-brand-warn' : 'text-brand-primary'} />
          <span className="font-bold text-sm tracking-wider text-slate-200 truncate">{label}</span>
        </div>
      </div>
      
      <div className="text-xs space-y-2">
        {isWorking && (
          <div className="flex items-start gap-2 text-brand-warn bg-brand-warn/10 p-2 rounded border border-brand-warn/20">
            <Clock size={14} className="animate-spin-slow shrink-0 mt-0.5" />
            <span className="font-medium leading-tight">Working...</span>
          </div>
        )}
        {isWaiting && (
          <div className="flex items-start gap-2 text-slate-400 bg-slate-800/50 p-2 rounded border border-slate-700">
            <Clock size={14} className="shrink-0 mt-0.5" />
            <span className="leading-tight break-words">Waiting on {waitingOn.join(', ')}</span>
          </div>
        )}
        {!isWorking && !isWaiting && (
          <div className="flex items-start gap-2 text-brand-primary bg-brand-accent/10 p-2 rounded border border-brand-accent/20">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span className="font-medium">Idle / Ready</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-brand-accent opacity-0" />
    </div>
  );
}

const nodeTypes = {
  agentNode: AgentNode,
};

function getLayoutedElements(nodes: FlowNode[], edges: FlowEdge[]) {
  // Circular layout
  const radius = Math.max(250, nodes.length * 60);
  const centerX = radius + 100;
  const centerY = radius + 100;

  const spacedNodes = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2; // Start from top
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle) - 100, // adjust by half width approx
        y: centerY + radius * Math.sin(angle) - 50,  // adjust by half height approx
      }
    };
  });
  return { nodes: spacedNodes, edges };
}

export function NetworkGraph({ agents, tasks = [], onClose }: Props) {
  
  const { nodes, edges } = useMemo(() => {
    const activeTasks = tasks.filter(t => t.status === "in_progress");
    
    const initialNodes: FlowNode[] = agents.map((agent) => {
      const workingOn = activeTasks.filter(t => t.target === agent);
      const waitingTasks = activeTasks.filter(t => t.sender === agent);
      
      const isWorking = workingOn.length > 0;
      const isWaiting = waitingTasks.length > 0;
      const waitingOn = Array.from(new Set(waitingTasks.map(t => t.target)));
      
      return {
        id: agent,
        type: 'agentNode',
        position: { x: 0, y: 0 },
        data: { label: agent, isWorking, isWaiting, waitingOn },
      };
    });

    const initialEdges: FlowEdge[] = activeTasks.map((task) => ({
      id: task.id,
      source: task.sender,
      target: task.target,
      label: 'Waiting...',
      labelStyle: { fill: '#ffb000', fontSize: 11, fontWeight: 'bold' },
      labelBgStyle: { fill: '#0a0a0c', fillOpacity: 0.9 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 4,
      animated: true,
      style: { stroke: '#ffb000', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#ffb000',
      },
    }));

    const completedTasks = tasks.filter(t => t.status === "complete").slice(0, 20); // show only recent
    completedTasks.forEach(task => {
      if (!initialEdges.find(e => e.id === task.id)) {
        initialEdges.push({
          id: task.id,
          source: task.sender,
          target: task.target,
          label: 'Completed',
          labelStyle: { fill: '#22c55e', fontSize: 9 },
          labelBgStyle: { fill: '#0a0a0c', fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
          animated: false,
          style: { stroke: '#22c55e', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.4 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#22c55e',
          },
        });
      }
    });

    return getLayoutedElements(initialNodes, initialEdges);
  }, [agents, tasks]);

  return (
    <div className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex flex-col p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl text-brand-primary font-bold font-medium tracking-tight flex items-center gap-3 mb-1">
            <Network className="stroke-[2.5]" /> Orchestration Map
          </h2>
          <p className="text-slate-400 text-sm font-medium">Live visualization of agent task delegations and dependencies.</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-brand-warn p-2 border border-app-border hover:border-brand-warn rounded bg-app-bg transition-colors">
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 border border-brand-accent/20 rounded-lg bg-[#020202] overflow-hidden relative shadow-md">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.2} maxZoom={2}>
          <Background color="#18181b" gap={24} size={2} />
          <Controls className="bg-[#0a0a0c] text-brand-primary border border-brand-accent/30 !fill-brand-accent" />
        </ReactFlow>
      </div>
    </div>
  );
}
