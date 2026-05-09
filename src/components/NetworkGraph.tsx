import { ReactFlow, Background, Controls, Node as FlowNode, Edge as FlowEdge, MarkerType, Handle, Position, NodeProps, Connection } from "@xyflow/react";
import { Network, X, Cpu, Clock, CheckCircle2, Server, TerminalSquare, AlertTriangle, Send } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState, MouseEvent as ReactMouseEvent, useCallback } from "react";

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
  tasks?: TaskRecord[];
  onClose: () => void;
  onKillAgent?: (agent: string) => void;
  onInterruptAgent?: (agent: string) => void;
  onInjectHint?: (agent: string, hint: string) => void;
  onQuickDispatch?: (target: string, task: string) => void;
}

function AgentNode({ data }: NodeProps) {
  const { label, isWorking, isWaiting, waitingOn, isMain } = data as any;
  
  return (
    <div className={`px-4 py-4 rounded-sm border bg-zinc-950 min-w-[220px] max-w-[260px] shadow-md transition-all duration-300
      ${isWorking ? 'border-amber-500/50 shadow-amber-500/10' : 
        isWaiting ? 'border-zinc-600 shadow-zinc-900/20' : 
        isMain ? 'border-brand-accent/50 shadow-brand-accent/10' : 'border-zinc-800 shadow-zinc-900/10'}`}>
      
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-brand-accent opacity-0" />
      
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
        {isMain && <span className="text-[9px] uppercase font-bold tracking-widest text-brand-accent/80 bg-brand-accent/10 px-1.5 py-0.5 rounded-xl">ROOT</span>}
      </div>
      
      <div className="text-xs space-y-2">
        {isWorking && (
          <div className="flex items-start gap-2 text-amber-400 bg-amber-400/10 p-2 rounded-xl border border-amber-400/20">
            <Clock size={14} className="animate-spin-slow shrink-0 mt-0.5" />
            <span className="font-medium leading-tight">Working...</span>
          </div>
        )}
        {isWaiting && (
          <div className="flex items-start gap-2 text-zinc-400 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
            <Clock size={14} className="shrink-0 mt-0.5" />
            <span className="leading-tight break-words">Waiting on {waitingOn.join(', ')}</span>
          </div>
        )}
        {!isWorking && !isWaiting && (
          <div className="flex items-start gap-2 text-emerald-400 bg-emerald-400/10 p-2 rounded-xl border border-emerald-400/20">
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
  if (nodes.length === 0) return { nodes, edges };

  const orchestratorIndex = nodes.findIndex(n => n.id.toLowerCase() === 'orchestrator' || n.id.toLowerCase() === 'main terminal');
  const mainNodeIndex = orchestratorIndex >= 0 ? orchestratorIndex : 0;
  
  const mainNode = nodes[mainNodeIndex];
  const otherNodes = nodes.filter((_, i) => i !== mainNodeIndex);

  const centerX = window.innerWidth / 2; 
  const topY = 80;
  const bottomY = 320;

  mainNode.position = { x: centerX - 110, y: topY };

  const spacingX = 280;
  const maxPerRow = Math.max(3, Math.floor(window.innerWidth / spacingX) - 1);
  
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

export function NetworkGraph({ agents, tasks = [], onClose, onKillAgent, onInterruptAgent, onInjectHint, onQuickDispatch }: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, agent: string } | null>(null);
  const [hintModal, setHintModal] = useState<{ agent: string, text: string } | null>(null);
  const [dispatchModal, setDispatchModal] = useState<{ source: string, target: string, text: string } | null>(null);
  
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

    agents.forEach(agent => {
      if (agent !== orchestratorId) {
        initialEdges.push({
          id: `structural-${orchestratorId}-${agent}`,
          source: orchestratorId,
          target: agent,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#27272a', strokeWidth: 1.5 },
          focusable: false,
          selectable: false,
          zIndex: -1,
        });
      }
    });

    activeTasks.forEach((task) => {
      initialEdges.push({
        id: task.id,
        source: task.sender,
        target: task.target,
        label: 'Delegating...',
        labelStyle: { fill: '#fbbf24', fontSize: 11, fontWeight: 600, fontFamily: 'Inter, sans-serif' },
        labelBgStyle: { fill: '#09090b', fillOpacity: 0.9 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 0,
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

  const handleNodeContextMenu = useCallback((event: ReactMouseEvent, node: FlowNode) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, agent: node.id });
  }, []);

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;
    setDispatchModal({ source: connection.source, target: connection.target, text: "" });
  }, []);

  const handleInjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hintModal || !hintModal.text.trim()) return;
    onInjectHint?.(hintModal.agent, hintModal.text);
    setHintModal(null);
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModal || !dispatchModal.text.trim()) return;
    onQuickDispatch?.(dispatchModal.target, dispatchModal.text);
    setDispatchModal(null);
  };

  return (
    <div className="absolute inset-0 z-50 bg-app-bg/95 backdrop-blur-sm flex flex-col p-6" onClick={handlePaneClick}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl text-brand-primary font-bold tracking-tight flex items-center gap-2.5 mb-1">
            <Network className="text-brand-accent stroke-[2]" size={22} /> Orchestration Map
          </h2>
          <p className="text-zinc-500 text-xs font-medium">Drag lines between agents to dispatch tasks. Right-click nodes for Command & Control.</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-2 border border-zinc-800 hover:border-zinc-600 rounded-xl bg-zinc-950 transition-colors shadow-sm">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 border border-zinc-800 rounded-xl bg-app-bg overflow-hidden relative shadow-inner">
        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          nodeTypes={nodeTypes} 
          onNodeContextMenu={handleNodeContextMenu}
          onConnect={handleConnect}
          fitView 
          minZoom={0.2} 
          maxZoom={1.5}
          connectOnClick={false}
          connectionLineStyle={{ stroke: '#00f0ff', strokeWidth: 2, strokeDasharray: '4 4' }}
        >
          <Background color="#27272a" gap={24} size={1.5} />
          <Controls className="bg-zinc-950 text-brand-primary border border-zinc-800 shadow-md !rounded-xl" />
        </ReactFlow>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-zinc-950 border border-zinc-800 shadow-2xl py-1 flex flex-col w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-zinc-800/50 mb-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Agent Control</span>
            <div className="text-sm font-semibold text-brand-primary truncate">{contextMenu.agent}</div>
          </div>
          <button 
            onClick={() => { setHintModal({ agent: contextMenu.agent, text: "" }); setContextMenu(null); }}
            className="px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-brand-accent text-left flex items-center gap-2 transition-colors"
          >
            <TerminalSquare size={14} /> Inject Hint / Message
          </button>
          <button 
            onClick={() => { onInterruptAgent?.(contextMenu.agent); setContextMenu(null); }}
            className="px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 text-left flex items-center gap-2 transition-colors"
          >
            <Clock size={14} /> Pause / Send SIGINT
          </button>
          <button 
            onClick={() => { onKillAgent?.(contextMenu.agent); setContextMenu(null); }}
            className="px-3 py-2 text-xs font-medium text-brand-warn hover:bg-brand-warn/10 hover:text-red-400 text-left flex items-center gap-2 transition-colors"
          >
            <AlertTriangle size={14} /> Force Kill PTY
          </button>
        </div>
      )}

      {/* Inject Hint Modal */}
      {hintModal && (
        <div className="fixed inset-0 z-[110] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setHintModal(null)}>
          <form 
            onSubmit={handleInjectSubmit} 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col rounded-xl"
          >
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <TerminalSquare size={16} className="text-brand-accent" /> Inject Hint to {hintModal.agent}
              </span>
              <button type="button" onClick={() => setHintModal(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4">
              <textarea 
                value={hintModal.text}
                onChange={e => setHintModal(prev => prev ? { ...prev, text: e.target.value } : null)}
                placeholder="Type your hint or override instruction..."
                className="w-full h-24 bg-zinc-900 border border-zinc-800 focus:border-brand-accent text-zinc-200 px-3 py-2 text-sm outline-none rounded-xl resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setHintModal(null)} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
                <button type="submit" disabled={!hintModal.text.trim()} className="px-4 py-2 text-xs font-bold bg-brand-accent text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2">
                  <Send size={14} /> Send Directly
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Quick Dispatch Modal */}
      {dispatchModal && (
        <div className="fixed inset-0 z-[110] bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setDispatchModal(null)}>
          <form 
            onSubmit={handleDispatchSubmit} 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-lg bg-zinc-950 border border-brand-accent/50 shadow-2xl flex flex-col rounded-xl"
          >
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Network size={16} className="text-brand-accent" /> Quick Dispatch
              </span>
              <button type="button" onClick={() => setDispatchModal(null)} className="text-zinc-500 hover:text-zinc-300"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 text-xs bg-zinc-900/50 border border-zinc-800 p-2 text-zinc-400">
                <span className="font-bold text-brand-primary">{dispatchModal.source}</span>
                <span className="text-zinc-600">→</span>
                <span className="font-bold text-amber-400">{dispatchModal.target}</span>
              </div>
              <textarea 
                value={dispatchModal.text}
                onChange={e => setDispatchModal(prev => prev ? { ...prev, text: e.target.value } : null)}
                placeholder={`What task should ${dispatchModal.target} do?`}
                className="w-full h-24 bg-zinc-900 border border-zinc-800 focus:border-brand-accent text-zinc-200 px-3 py-2 text-sm outline-none rounded-xl resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDispatchModal(null)} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">Cancel</button>
                <button type="submit" disabled={!dispatchModal.text.trim()} className="px-4 py-2 text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2">
                  <Send size={14} /> Dispatch Task
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
