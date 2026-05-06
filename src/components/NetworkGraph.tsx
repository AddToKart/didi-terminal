import { ReactFlow, Background, Controls, Node as FlowNode, Edge as FlowEdge, MarkerType } from "@xyflow/react";
import { Network, X } from "lucide-react";
import "@xyflow/react/dist/style.css";

interface Props {
  agents: string[];
  handoffs: Array<{ id: string; source: string; target: string; kind: string }>;
  onClose: () => void;
}

export function NetworkGraph({ agents, handoffs, onClose }: Props) {
  const nodes: FlowNode[] = agents.map((agent, index) => ({
    id: agent,
    position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 150 },
    data: { label: agent },
    style: {
      background: "#0a0a0c",
      color: "#00f0ff",
      border: "1px solid #00f0ff",
      borderRadius: "4px",
      width: 160,
      padding: 10,
      fontFamily: "monospace",
    },
  }));

  const edges: FlowEdge[] = handoffs.map((handoff, index) => ({
    id: handoff.id || `edge-${index}`,
    source: handoff.source || agents[0],
    target: handoff.target,
    animated: handoff.kind === "task",
    style: { stroke: handoff.kind === "completion" ? "#22c55e" : "#ffb000" },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: handoff.kind === "completion" ? "#22c55e" : "#ffb000",
    },
  }));

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl text-brand-cyan font-bold uppercase tracking-widest flex items-center gap-2">
          <Network /> Collaboration Graph
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-brand-amber p-2 border border-app-border rounded bg-app-bg">
          <X />
        </button>
      </div>
      <div className="flex-1 border border-brand-cyan/30 rounded bg-[#020202]">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background color="#18181b" gap={16} />
          <Controls className="bg-app-bg text-brand-cyan border border-brand-cyan/30" />
        </ReactFlow>
      </div>
    </div>
  );
}
