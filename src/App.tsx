import { Panel, Group, Separator } from "react-resizable-panels";
import { TerminalInstance } from "./components/TerminalInstance";
import { useEffect, useState, useRef, FormEvent, Fragment } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Terminal, FolderOpen, ShieldAlert, Cpu, Columns, Rows, Plus, X, Activity, Grid2X2, PanelLeftClose, PanelLeft } from "lucide-react";

const EXISTING_AGENT_FALLBACK_MS = 1000;
const NEW_AGENT_FALLBACK_MS = 6000;
const HANDOFF_SUBMIT_DELAY_MS = 120;

interface ActivityLog {
  id: number;
  time: string;
  message: string;
  type: 'system' | 'handoff';
}

function App() {
  const [agents, setAgents] = useState<string[]>(["Main Terminal"]);
  const [newAgentName, setNewAgentName] = useState("");
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [layoutOrientation, setLayoutOrientation] = useState<"horizontal" | "vertical" | "grid">("horizontal");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activity, setActivity] = useState<ActivityLog[]>([{ id: 0, time: new Date().toLocaleTimeString(), message: "System initialized", type: 'system' }]);

  const pendingHandoffs = useRef<Map<string, string>>(new Map());
  const readyAgents = useRef<Set<string>>(new Set());
  const agentsRef = useRef(agents);
  const fallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const logIdCounter = useRef(1);

  const addLog = (message: string, type: 'system' | 'handoff' = 'system') => {
    setActivity(prev => {
      const newLog = { id: logIdCounter.current++, time: new Date().toLocaleTimeString(), message, type };
      return [newLog, ...prev].slice(0, 50); // Keep last 50
    });
  };

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    const writeHandoff = (agentKey: string, payload: string) => {
      console.log(`[JS] Injecting handoff into ${agentKey}`);
      invoke("write_pty", { agent: agentKey, data: payload }).catch(console.error);
      setTimeout(() => {
        invoke("write_pty", { agent: agentKey, data: "\r" }).catch(console.error);
      }, HANDOFF_SUBMIT_DELAY_MS);
    };

    const clearFallbackTimer = (agentKey: string) => {
      const timer = fallbackTimers.current.get(agentKey);
      if (!timer) return;
      clearTimeout(timer);
      fallbackTimers.current.delete(agentKey);
    };

    const flushQueuedHandoff = (agentKey: string) => {
      const queued = pendingHandoffs.current.get(agentKey);
      if (!queued) return;

      pendingHandoffs.current.delete(agentKey);
      clearFallbackTimer(agentKey);
      writeHandoff(agentKey, queued);
    };

    const queueHandoff = (agentKey: string, payload: string, fallbackMs: number) => {
      pendingHandoffs.current.set(agentKey, payload);
      clearFallbackTimer(agentKey);

      const timer = setTimeout(() => {
        if (!pendingHandoffs.current.has(agentKey)) return;
        readyAgents.current.add(agentKey);
        flushQueuedHandoff(agentKey);
      }, fallbackMs);

      fallbackTimers.current.set(agentKey, timer);
    };

    const unlistenHandoff = listen<{ target: string, payload: string }>("agent-handoff", (event) => {
      const { target, payload } = event.payload;
      const targetName = target.trim();
      const agentKey = targetName.toLowerCase();
      
      addLog(`Handoff to ${targetName}`, 'handoff');

      const agentExists = agentsRef.current.some(a => a.toLowerCase() === agentKey);
      if (!agentExists) {
        setAgents(prev => {
          if (prev.some(a => a.toLowerCase() === agentKey)) return prev;
          const nextAgents = [...prev, targetName];
          agentsRef.current = nextAgents;
          return nextAgents;
        });
      }

      const safePayload = payload.replace(/\r?\n/g, ' ').trim();

      if (agentExists && readyAgents.current.has(agentKey)) {
        writeHandoff(agentKey, safePayload);
      } else {
        queueHandoff(agentKey, safePayload, agentExists ? EXISTING_AGENT_FALLBACK_MS : NEW_AGENT_FALLBACK_MS);
      }
    });

    const unlistenReady = listen<{ agent: string }>("agent-prompt-ready", (event) => {
      const agentKey = event.payload.agent.toLowerCase();
      readyAgents.current.add(agentKey);

      if (pendingHandoffs.current.has(agentKey)) {
        setTimeout(() => flushQueuedHandoff(agentKey), 500);
      }
    });

    return () => {
      fallbackTimers.current.forEach(timer => clearTimeout(timer));
      fallbackTimers.current.clear();
      unlistenHandoff.then(f => f());
      unlistenReady.then(f => f());
    };
  }, []);

  const spawnAgent = (e: FormEvent) => {
    e.preventDefault();
    const name = newAgentName.trim();
    if (name && !agents.some(a => a.toLowerCase() === name.toLowerCase())) {
      setAgents([...agents, name]);
      setNewAgentName("");
      addLog(`Spawned agent: ${name}`, 'system');
    }
  };

  const removeAgent = (agentToRemove: string) => {
    setAgents(agents.filter(a => a !== agentToRemove));
    addLog(`Terminated agent: ${agentToRemove}`, 'system');
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setCurrentProject(selected as string);
      addLog(`Opened workspace: ${selected}`, 'system');
    }
  };

  const handleInitialize = async () => {
    if (currentProject) {
      try {
        await invoke("initialize_project", { cwd: currentProject });
        addLog("Project initialized for Didi orchestration.", 'system');
      } catch (err) {
        addLog(`Init failed: ${err}`, 'system');
      }
    }
  };

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 font-plex overflow-hidden flex selection:bg-brand-cyan/20">
      
      {/* Sidebar */}
      {isSidebarOpen && (
      <aside className="w-72 border-r border-app-border bg-app-panel flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-10 shrink-0">
        <div className="p-4 border-b border-app-border">
          <div className="flex items-center gap-2 text-brand-cyan mb-1">
            <Terminal size={20} className="stroke-[2.5]" />
            <h1 className="text-lg font-bold tracking-widest uppercase">DidiTerminal</h1>
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Orchestrator Node v2.0</p>
        </div>

        {/* Project Setup */}
        <div className="p-4 border-b border-app-border space-y-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <FolderOpen size={12} /> Workspace
          </div>
          <button 
            onClick={handleOpenProject} 
            className="w-full bg-[#121214] hover:bg-[#1a1a1e] border border-app-border hover:border-slate-700 px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors group"
          >
            <span className="truncate">{currentProject ? currentProject.split('\\').pop() : "Select Directory..."}</span>
            <FolderOpen size={14} className="text-slate-500 group-hover:text-brand-cyan transition-colors" />
          </button>
          
          {currentProject && (
            <button 
              onClick={handleInitialize} 
              className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 hover:border-brand-cyan/50 px-3 py-2 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2"
            >
              <ShieldAlert size={14} /> Initialize Didi Protocol
            </button>
          )}
        </div>

        {/* Agents List */}
        <div className="flex-1 flex flex-col min-h-0 border-b border-app-border">
          <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 bg-[#080809]">
            <Cpu size={12} /> Active Agents ({agents.length})
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {agents.map(agent => (
              <div key={agent} className="group flex items-center justify-between px-3 py-2 bg-black border border-app-border hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse"></div>
                  <span className="text-xs font-medium truncate">{agent}</span>
                </div>
                <button 
                  onClick={() => removeAgent(agent)}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                  title="Terminate Agent"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="h-1/3 flex flex-col min-h-0 bg-[#030303]">
          <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-app-border">
            <Activity size={12} /> System Feed
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activity.map(log => (
              <div key={log.id} className="text-[11px] leading-tight">
                <span className="text-slate-600 mr-2">[{log.time}]</span>
                <span className={log.type === 'handoff' ? 'text-brand-amber font-medium' : 'text-slate-400'}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
      )}

      {/* Main Content Area */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 border-b border-app-border flex items-center justify-between px-4 bg-app-bg">
          <form onSubmit={spawnAgent} className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Plus size={14} className="absolute left-2 text-slate-500" />
              <input
                type="text"
                value={newAgentName}
                onChange={e => setNewAgentName(e.target.value)}
                placeholder="Spawn new agent..."
                className="bg-[#0a0a0c] border border-app-border focus:border-brand-cyan text-slate-200 pl-7 pr-3 py-1.5 text-xs outline-none transition-colors w-64 placeholder:text-slate-600"
              />
            </div>
            <button type="submit" className="hidden" /> {/* Hidden submit so enter works */}
          </form>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0a0a0c] p-1 border border-app-border rounded-sm">
              <button 
                onClick={() => setLayoutOrientation('horizontal')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'horizontal' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vertical Splits"
              >
                <Columns size={14} />
              </button>
              <button 
                onClick={() => setLayoutOrientation('vertical')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'vertical' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                title="Horizontal Splits"
              >
                <Rows size={14} />
              </button>
              <button 
                onClick={() => setLayoutOrientation('grid')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'grid' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-slate-500 hover:text-slate-300'}`}
                title="Grid Split"
              >
                <Grid2X2 size={14} />
              </button>
            </div>
            
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-cyan bg-[#0a0a0c] border border-app-border"
              title="Toggle Sidebar"
            >
              {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
            </button>
          </div>
        </div>

        {/* Terminals Container */}
        <div className="flex-1 p-2 bg-[#020202]">
          {agents.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm font-mono border border-dashed border-app-border">
              NO ACTIVE AGENTS
            </div>
          ) : (
            layoutOrientation === 'grid' ? (
              <Group orientation="vertical" className="h-full w-full rounded-sm overflow-hidden border border-app-border">
                {Array.from({ length: Math.ceil(agents.length / Math.ceil(Math.sqrt(agents.length))) }).map((_, rowIndex) => {
                  const cols = Math.ceil(Math.sqrt(agents.length));
                  const rowAgents = agents.slice(rowIndex * cols, rowIndex * cols + cols);
                  const rowsCount = Math.ceil(agents.length / cols);
                  return (
                    <Fragment key={`row-${rowIndex}`}>
                      {rowIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-cyan focus:bg-brand-cyan h-1 my-0.5" />}
                      <Panel defaultSize={100 / rowsCount} minSize={10}>
                        <Group orientation="horizontal" className="h-full w-full">
                          {rowAgents.map((agent, colIndex) => (
                            <Fragment key={agent}>
                              {colIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-cyan focus:bg-brand-cyan w-1 mx-0.5" />}
                              <Panel defaultSize={100 / rowAgents.length} minSize={10}>
                                <TerminalInstance agentName={agent} cwd={currentProject} onRemove={() => removeAgent(agent)} />
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
                    {index > 0 && <Separator className={`bg-app-border transition-colors hover:bg-brand-cyan focus:bg-brand-cyan ${layoutOrientation === 'horizontal' ? 'w-1 mx-0.5' : 'h-1 my-0.5'}`} />}
                    <Panel defaultSize={100 / agents.length} minSize={10}>
                      <TerminalInstance agentName={agent} cwd={currentProject} onRemove={() => removeAgent(agent)} />
                    </Panel>
                  </Fragment>
                ))}
              </Group>
            )
          )}
        </div>
      </section>

    </main>
  );
}

export default App;
