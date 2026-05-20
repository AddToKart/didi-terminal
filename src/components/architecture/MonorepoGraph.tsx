import { ReactFlow, Background, Controls, Node as FlowNode, Edge as FlowEdge, Handle, Position, NodeProps, Panel, useNodesState, useEdgesState } from "@xyflow/react";
import { FolderTree, X, Folder, Package, FileCode, Box, ExternalLink, Map as MapIcon, RefreshCw } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface GraphNode {
    id: string;
    name: string;
    path: string;
    type_info: string;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label: string;
}

interface ProjectGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

interface Props {
    currentProject: string | null;
    onClose: () => void;
    onOpenInTerminal: (path: string, name: string) => void;
}

function ProjectNode({ data }: NodeProps) {
    const { name, type, path, onClick } = data as any;
    
    const Icon = type === 'node' ? Package : 
                 type === 'rust' ? Box : 
                 type === 'python' ? FileCode : Folder;

    const colorClass = type === 'node' ? 'text-emerald-400 border-emerald-500/30 bg-[#070e0a]' :
                       type === 'rust' ? 'text-orange-400 border-orange-500/30 bg-[#120a05]' :
                       type === 'python' ? 'text-blue-400 border-blue-500/30 bg-[#060a12]' :
                       'text-zinc-400 border-zinc-800 bg-[#0a0a0c]';

    return (
        <div 
            className={`px-4 py-3 rounded-xl border min-w-[180px] shadow-lg transition-all hover:scale-105 hover:border-brand-accent/50 group cursor-pointer ${colorClass}`}
            onClick={() => onClick(path, name)}
        >
            <Handle type="target" position={Position.Top} className="!bg-zinc-600 !w-1 !h-1 border-none" />
            
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-black/20 ${colorClass}`}>
                    <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{name}</div>
                    <div className="text-[9px] uppercase tracking-widest font-black opacity-50">{type}</div>
                </div>
                <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-accent" />
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-zinc-600 !w-1 !h-1 border-none" />
        </div>
    );
}

const nodeTypes = {
    projectNode: ProjectNode,
};

export function MonorepoGraph({ currentProject, onClose, onOpenInTerminal }: Props) {
    const [loading, setLoading] = useState(false);
    
    // React Flow state hooks required for interactivity (dragging nodes)
    const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

    const fetchGraph = useCallback(async () => {
        if (!currentProject) return;
        setLoading(true);
        try {
            const data = await invoke<ProjectGraph>("get_project_graph", { cwd: currentProject });
            
            // Map raw data to ReactFlow nodes
            const flowNodes: FlowNode[] = data.nodes.map((node, i) => {
                // Simple grid layout to prevent overlapping
                const perRow = 4;
                const x = (i % perRow) * 250;
                const y = Math.floor(i / perRow) * 150;

                return {
                    id: node.id,
                    type: 'projectNode',
                    position: { x, y },
                    data: { 
                        name: node.name, 
                        type: node.type_info, 
                        path: node.path,
                        onClick: onOpenInTerminal
                    },
                };
            });

            // Map raw data to ReactFlow edges
            const flowEdges: FlowEdge[] = data.edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                animated: true,
                type: 'smoothstep',
                style: { stroke: '#4b5563', strokeWidth: 1 },
                labelStyle: { fill: '#9ca3af', fontSize: 10, fontWeight: 500 },
                labelBgStyle: { fill: '#09090b', fillOpacity: 0.8 },
                labelBgPadding: [4, 2],
            }));

            setNodes(flowNodes);
            setEdges(flowEdges);
        } catch (err) {
            console.error("Failed to fetch project graph:", err);
        } finally {
            setLoading(false);
        }
    }, [currentProject, setNodes, setEdges, onOpenInTerminal]);

    useEffect(() => {
        fetchGraph();
    }, [fetchGraph]);

    return (
        <div className="absolute inset-0 z-50 bg-black/85 flex flex-col p-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                        <FolderTree className="text-brand-accent" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl text-white font-bold tracking-tight">Monorepo Dependency Graph</h2>
                        <p className="text-zinc-500 text-xs font-medium">Visualizing folder relationships and workspace dependencies.</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchGraph}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c0c0f] border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-[#121215] transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-2.5 border border-zinc-800 rounded-xl bg-[#0c0c0f] transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 border border-zinc-800 rounded-2xl bg-[#030304] overflow-hidden relative shadow-2xl">
                <ReactFlow 
                    nodes={nodes} 
                    edges={edges} 
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    minZoom={0.2}
                    maxZoom={2}
                >
                    <Background color="#27272a" gap={32} size={1} />
                    <Controls className="!bg-[#0c0c0f] !border !border-zinc-800 fill-white !rounded-xl overflow-hidden" />
                    
                    <Panel position="bottom-right" className="bg-[#0a0a0c] border border-zinc-800 p-3 rounded-xl flex flex-col gap-2 shadow-2xl">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 border-b border-zinc-800 pb-2 mb-1">Legend</div>
                        <div className="flex items-center gap-2 text-xs text-emerald-400"><Package size={14}/> Node.js / TS</div>
                        <div className="flex items-center gap-2 text-xs text-orange-400"><Box size={14}/> Rust / Cargo</div>
                        <div className="flex items-center gap-2 text-xs text-blue-400"><FileCode size={14}/> Python</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400"><Folder size={14}/> General Folder</div>
                    </Panel>
                </ReactFlow>
            </div>

            <div className="mt-4 flex items-center justify-center gap-8 text-[10px] text-zinc-500 font-medium uppercase tracking-widest">
                <div className="flex items-center gap-2"><MapIcon size={12}/> Drag nodes to organize</div>
                <div className="flex items-center gap-2"><ExternalLink size={12}/> Click to open in terminal</div>
            </div>
        </div>
    );
}