import { useState, useEffect } from 'react';
import { bridge } from './DashboardBridge';
import { Activity, Cpu, Database, Layout, ShieldAlert, Zap, Terminal as TerminalIcon, Clock, Server } from 'lucide-react';

interface AgentStats {
  agent: string;
  workspace: string;
  cpu: number;
  mem: number;
  lastUpdate: number;
  status: 'IDLE' | 'BUSY' | 'PAUSED';
}

interface HandoffEvent {
  id: string;
  time: string;
  target: string;
  sender: string;
  payload: string;
}

export function Dashboard() {
  const [agents, setAgents] = useState<Record<string, AgentStats>>({});
  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);

  useEffect(() => {
    // Listen for PTY output to track agent activity and stats
    const unlistenPty = bridge.listen('pty-output', (data: { agent: string, workspace: string, data: string }) => {
      setAgents(prev => ({
        ...prev,
        [data.agent]: {
          ...(prev[data.agent] || { cpu: 0, mem: 0, status: 'IDLE' }),
          agent: data.agent,
          workspace: data.workspace || 'Default',
          lastUpdate: Date.now(),
          status: 'BUSY'
        }
      }));
      
      // Auto-set back to idle after a period of no output
      setTimeout(() => {
        setAgents(prev => {
            if (!prev[data.agent] || Date.now() - prev[data.agent].lastUpdate < 2000) return prev;
            return {
                ...prev,
                [data.agent]: { ...prev[data.agent], status: 'IDLE' }
            };
        });
      }, 3000);
    });

    const unlistenHandoff = bridge.listen('agent-handoff', (data: any) => {
      const newEvent: HandoffEvent = {
        id: crypto.randomUUID(),
        time: new Date().toLocaleTimeString(),
        target: data.target,
        sender: data.sender || 'Unknown',
        payload: data.payload
      };
      setHandoffs(prev => [newEvent, ...prev].slice(0, 50));
    });

    return () => {
      unlistenPty();
      unlistenHandoff();
    };
  }, []);

  // Group agents by workspace
  const agentsByWorkspace = Object.values(agents).reduce((acc, agent) => {
    const ws = agent.workspace || 'Default';
    if (!acc[ws]) acc[ws] = [];
    acc[ws].push(agent);
    return acc;
  }, {} as Record<string, AgentStats[]>);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans p-6 selection:bg-brand-accent/30">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/20 rounded-2xl flex items-center justify-center border border-brand-accent/30 shadow-[0_0_20px_-5px_rgba(0,240,255,0.3)]">
            <Server className="text-brand-accent" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              DIDI <span className="text-brand-accent font-black tracking-widest text-xs border border-brand-accent/40 px-2 py-0.5 rounded-full shadow-[0_0_10px_-2px_rgba(0,240,255,0.2)]">REMOTE</span>
            </h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-0.5">Autonomous Agent Orchestration Node</p>
          </div>
        </div>

        <div className="flex gap-6 items-center">
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Agents</span>
                <span className="text-xl font-mono font-bold text-brand-accent">{Object.keys(agents).length}</span>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Workspaces</span>
                <span className="text-xl font-mono font-bold text-white">{Object.keys(agentsByWorkspace).length}</span>
            </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Agents Column */}
        <div className="lg:col-span-2 space-y-12">
          {Object.keys(agentsByWorkspace).length === 0 ? (
             <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                        <Activity size={14} className="text-brand-accent" /> Active Fleet
                    </h2>
                    <div className="h-px flex-1 bg-zinc-800/50 mx-4" />
                </div>
                <div className="py-20 border border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-600 gap-2 grayscale opacity-50">
                    <TerminalIcon size={40} strokeWidth={1} />
                    <p className="text-xs font-bold uppercase tracking-widest">No active agents detected</p>
                </div>
             </div>
          ) : Object.entries(agentsByWorkspace).map(([workspace, workspaceAgents]) => (
            <div key={workspace} className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Layout size={14} className="text-brand-accent" /> {workspace}
                </h2>
                <div className="h-px flex-1 bg-zinc-800/50 mx-4" />
                <span className="text-[10px] font-mono text-zinc-500">{workspaceAgents.length} Agents</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workspaceAgents.map(agent => (
                  <div key={agent.agent} className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 hover:border-brand-accent/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 blur-[60px] -mr-16 -mt-16 rounded-full group-hover:bg-brand-accent/10 transition-all"></div>
                    
                    <div className="flex items-center justify-between mb-6 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${agent.status === 'BUSY' ? 'bg-brand-accent animate-pulse' : 'bg-emerald-500'}`} />
                        <h3 className="font-bold text-white uppercase tracking-tighter text-lg">{agent.agent}</h3>
                      </div>
                      <span className="text-[10px] font-black bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full uppercase tracking-widest">{agent.status}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 relative z-10">
                      <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Cpu size={10} /> Intelligence
                        </p>
                        <p className="text-lg font-mono font-bold text-white">0.0%</p>
                      </div>
                      <div className="bg-black/20 rounded-2xl p-3 border border-white/5">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Database size={10} /> Neural
                        </p>
                        <p className="text-lg font-mono font-bold text-white">0 MB</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Global Activity Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <Zap size={14} className="text-brand-warn" /> Neural Bus
            </h2>
            <div className="h-px flex-1 bg-zinc-800/50 ml-4" />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/80 flex items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Live Handoffs</span>
                <Clock size={12} className="text-zinc-600" />
            </div>
            <div className="h-[600px] overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {handoffs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-40 py-10">
                      <Layout size={32} strokeWidth={1} className="mb-2" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-center">Waiting for agent<br/>communication...</p>
                  </div>
              ) : handoffs.map(h => (
                <div key={h.id} className="border-l-2 border-brand-accent/40 pl-4 py-1 space-y-2 group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-brand-accent uppercase tracking-tighter">
                      {h.sender} <span className="text-zinc-600 mx-1">→</span> {h.target}
                    </p>
                    <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-400 transition-colors">{h.time}</span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-800/30 p-2 rounded-lg border border-white/5 italic">
                    "{h.payload}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-zinc-800/40 flex items-center justify-between text-zinc-600">
        <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-zinc-700" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Didi Node Secured</span>
        </div>
        <p className="text-[10px] font-mono uppercase tracking-widest">© 2026 AGENT ORCHESTRATOR v0.1.0-remote</p>
      </footer>
    </div>
  );
}
