import { Panel, Group, Separator } from "react-resizable-panels";
import { TerminalInstance } from "./components/TerminalInstance";
import { useEffect, useState, useRef, FormEvent, Fragment, lazy, Suspense } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Terminal, FolderOpen, ShieldAlert, Cpu, Columns, Rows, Plus, X, Activity, Grid2X2, PanelLeftClose, PanelLeft, Network, Settings, Server } from "lucide-react";

const NetworkGraph = lazy(() => import("./components/NetworkGraph").then(module => ({ default: module.NetworkGraph })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(module => ({ default: module.SettingsModal })));

const EXISTING_AGENT_FALLBACK_MS = 1000;
const NEW_AGENT_FALLBACK_MS = 6000;
const HANDOFF_SUBMIT_DELAY_MS = 400;

const getPtyKey = (agentName: string) => agentName.trim().toLowerCase();

const getAgentId = (agentName: string) =>
  getPtyKey(agentName).replace(/[^a-z0-9]/g, "");

const getUniqueAgents = (agentNames: string[]) => {
  const seen = new Set<string>();

  return agentNames.filter(agentName => {
    const id = getAgentId(agentName);
    if (!id || seen.has(id)) return false;

    seen.add(id);
    return true;
  });
};

const findMatchingAgent = (agentNames: string[], targetName: string) => {
  const targetPtyKey = getPtyKey(targetName);
  const targetId = getAgentId(targetName);

  return agentNames.find(agentName =>
    getPtyKey(agentName) === targetPtyKey || getAgentId(agentName) === targetId
  );
};

const isCompletionMessage = (payload: string) =>
  /^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b/i.test(payload) ||
  /\bCOMPLETED TASK\b/i.test(payload) ||
  /completion callback/i.test(payload);

const getHandoffKind = (handoff: HandoffPayload): HandoffKind => {
  if (handoff.kind) return handoff.kind;
  return isCompletionMessage(handoff.payload) ? "completion" : "task";
};

const getTaskSummary = (payload: string) =>
  payload
    .replace(/\[[^\]]+\]\s*:\s*/g, "")
    .replace(/\[SYSTEM RULE:[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

interface ActivityLog {
  id: number;
  time: string;
  message: string;
  type: "system" | "handoff";
}

type HandoffKind = "task" | "completion" | "status";
type TaskStatus = "pending" | "in_progress" | "complete";

interface HandoffPayload {
  target: string;
  payload: string;
  kind?: HandoffKind;
  sender?: string;
  taskId?: string;
  parentTaskId?: string;
}

interface TaskRecord {
  id: string;
  sender: string;
  target: string;
  summary: string;
  status: TaskStatus;
  updatedAt: string;
}

interface GraphHandoff {
  id: string;
  source: string;
  target: string;
  kind: string;
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const standaloneAgent = params.get('agent');

  if (standaloneAgent) {
    return (
      <div className="h-screen w-screen bg-app-bg">
        <TerminalInstance agentName={standaloneAgent} />
      </div>
    );
  }

  const [agents, setAgents] = useState<string[]>(() => {
    const saved = localStorage.getItem("didi_agents");
    return saved ? getUniqueAgents(JSON.parse(saved)) : ["Main Terminal"];
  });
  const [newAgentName, setNewAgentName] = useState("");
  const [currentProject, setCurrentProject] = useState<string | null>(() => localStorage.getItem("didi_project"));
  const [layoutOrientation, setLayoutOrientation] = useState<"horizontal" | "vertical" | "grid">(() => {
    return (localStorage.getItem("didi_layout") as any) || "horizontal";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem("didi_sidebar") !== "false");
  const [showNetworkGraph, setShowNetworkGraph] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState("Checking...");
  const [activity, setActivity] = useState<ActivityLog[]>([{ id: 0, time: new Date().toLocaleTimeString(), message: "System initialized", type: 'system' }]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [graphHandoffs, setGraphHandoffs] = useState<GraphHandoff[]>([]);

  const pendingHandoffs = useRef<Map<string, string>>(new Map());
  const readyAgents = useRef<Set<string>>(new Set());
  const agentsRef = useRef(agents);
  const currentProjectRef = useRef(currentProject);
  const fallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const logIdCounter = useRef(1);
  const tasksRef = useRef<TaskRecord[]>([]);

  const addLog = (message: string, type: 'system' | 'handoff' = 'system') => {
    setActivity(prev => {
      const newLog = { id: logIdCounter.current++, time: new Date().toLocaleTimeString(), message, type };
      return [newLog, ...prev].slice(0, 50); // Keep last 50
    });
  };

  useEffect(() => {
    const uniqueAgents = getUniqueAgents(agents);
    if (uniqueAgents.length !== agents.length) {
      setAgents(uniqueAgents);
      return;
    }

    agentsRef.current = uniqueAgents;
    localStorage.setItem("didi_agents", JSON.stringify(uniqueAgents));
  }, [agents]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);



  useEffect(() => {
    localStorage.setItem("didi_layout", layoutOrientation);
  }, [layoutOrientation]);

  useEffect(() => {
    localStorage.setItem("didi_sidebar", String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    if (currentProject) {
      localStorage.setItem("didi_project", currentProject);
    } else {
      localStorage.removeItem("didi_project");
    }
    currentProjectRef.current = currentProject;
  }, [currentProject]);

  useEffect(() => {
    // Initial config load for theme
    invoke<any>("get_config").then(config => {
      document.documentElement.style.setProperty('--tw-colors-brand-cyan', config.theme_cyan);
      document.documentElement.style.setProperty('--tw-colors-brand-amber', config.theme_amber);
    }).catch(console.error);

    const interval = setInterval(() => {
      invoke<string>("get_sidecar_status").then(setSidecarStatus).catch(() => setSidecarStatus("Error"));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const writeHandoff = (agentKey: string, payload: string) => {
      console.log(`[JS] Injecting handoff into ${agentKey}`);
      readyAgents.current.delete(agentKey);
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

    const registerTask = (handoff: HandoffPayload, targetName: string, kind: HandoffKind) => {
      const sender = handoff.sender?.trim() || "Main";
      const id = handoff.taskId || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const updatedAt = new Date().toLocaleTimeString();

      setGraphHandoffs(prev => [
        { id, source: sender, target: targetName, kind },
        ...prev,
      ].slice(0, 80));

      if (kind === "task") {
        const record: TaskRecord = {
          id,
          sender,
          target: targetName,
          summary: getTaskSummary(handoff.payload),
          status: "in_progress",
          updatedAt,
        };
        setTasks(prev => [record, ...prev.filter(task => task.id !== id)].slice(0, 30));
        return;
      }

      if (kind === "completion") {
        const completedAgentId = getAgentId(sender);
        setTasks(prev => prev.map(task => {
          if (task.status !== "in_progress" || getAgentId(task.target) !== completedAgentId) return task;
          return { ...task, status: "complete", updatedAt };
        }));
      }
    };

    const enrichPayload = async (handoff: HandoffPayload, kind: HandoffKind) => {
      const safePayload = handoff.payload.replace(/\r?\n/g, " ").trim();
      if (kind !== "task" || !currentProjectRef.current) return safePayload;

      try {
        const context = await invoke<string>("get_project_context", { cwd: currentProjectRef.current });
        return `${safePayload} WORKSPACE CONTEXT: ${context.replace(/\r?\n/g, " ").trim()}`;
      } catch (err) {
        console.warn("Failed to add workspace context", err);
        return safePayload;
      }
    };

    const handleHandoff = async (handoff: HandoffPayload) => {
      const { target } = handoff;
      const targetName = target.trim();
      const matchingAgent = findMatchingAgent(agentsRef.current, targetName);
      const resolvedAgentName = matchingAgent ?? targetName;
      const agentKey = getPtyKey(resolvedAgentName);
      const kind = getHandoffKind(handoff);

      addLog(
        matchingAgent && matchingAgent !== targetName
          ? `${kind} to ${matchingAgent} (${targetName})`
          : `${kind} to ${targetName}`,
        "handoff"
      );
      registerTask(handoff, resolvedAgentName, kind);

      const agentExists = Boolean(matchingAgent);
      if (!agentExists) {
        setAgents(prev => {
          if (findMatchingAgent(prev, targetName)) return prev;
          const nextAgents = getUniqueAgents([...prev, targetName]);
          agentsRef.current = nextAgents;
          return nextAgents;
        });
      }

      const safePayload = await enrichPayload(handoff, kind);

      if (agentExists && readyAgents.current.has(agentKey)) {
        writeHandoff(agentKey, safePayload);
      } else {
        queueHandoff(agentKey, safePayload, agentExists ? EXISTING_AGENT_FALLBACK_MS : NEW_AGENT_FALLBACK_MS);
      }
    };

    const unlistenHandoff = listen<HandoffPayload>("agent-handoff", (event) => {
      handleHandoff(event.payload).catch(console.error);
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
    if (name && !findMatchingAgent(agents, name)) {
      setAgents([...agents, name]);
      setNewAgentName("");
      addLog(`Spawned agent: ${name}`, 'system');
    }
  };

  const removeAgent = (agentToRemove: string) => {
    invoke("close_pty", { agent: getPtyKey(agentToRemove) }).catch(console.error);
    pendingHandoffs.current.delete(getPtyKey(agentToRemove));
    readyAgents.current.delete(getPtyKey(agentToRemove));
    setAgents(agents.filter(a => a !== agentToRemove));
    addLog(`Terminated agent: ${agentToRemove}`, 'system');
  };

  const detachAgent = (agentToDetach: string) => {
    setAgents(agents.filter(a => a !== agentToDetach));
    addLog(`Detached agent: ${agentToDetach}`, "system");
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('agentIndex', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    const dragIndex = parseInt(e.dataTransfer.getData('agentIndex'));
    if (isNaN(dragIndex) || dragIndex === dropIndex) return;

    const newAgents = [...agents];
    const [draggedAgent] = newAgents.splice(dragIndex, 1);
    newAgents.splice(dropIndex, 0, draggedAgent);
    setAgents(newAgents);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // necessary to allow drop
  };

  return (
    <main className="h-screen w-screen bg-app-bg text-slate-300 font-plex overflow-hidden flex selection:bg-brand-cyan/20 relative">
      
      {showNetworkGraph && (
        <Suspense fallback={<div className="absolute inset-0 z-50 bg-black/80" />}>
          <NetworkGraph agents={agents} handoffs={graphHandoffs} onClose={() => setShowNetworkGraph(false)} />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal onClose={() => setShowSettings(false)} />
        </Suspense>
      )}

      {/* Sidebar */}
      {isSidebarOpen && (
      <aside className="w-72 border-r border-app-border bg-app-panel flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)] z-10 shrink-0">
        <div className="p-4 border-b border-app-border flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-brand-cyan mb-1">
              <Terminal size={20} className="stroke-[2.5]" />
              <h1 className="text-lg font-bold tracking-widest uppercase">DidiTerminal</h1>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Orchestrator Node v2.0</p>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-brand-cyan transition-colors mt-1" title="Settings">
            <Settings size={16} />
          </button>
        </div>

        {/* Project Setup */}
        <div className="p-4 border-b border-app-border space-y-3">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
             <div className="flex items-center gap-2"><Server size={12} /> LLM Sidecar</div>
             <span className={`${sidecarStatus === 'Running' ? 'text-emerald-400' : 'text-brand-amber'}`}>{sidecarStatus}</span>
          </div>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mt-4">
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

        <div className="h-44 flex flex-col min-h-0 border-b border-app-border bg-[#050506]">
          <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between border-b border-app-border">
            <span>Task State</span>
            <span className="text-slate-600">{tasks.filter(task => task.status !== "complete").length} active</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {tasks.length === 0 ? (
              <div className="text-[11px] text-slate-600 px-2 py-2">No tracked tasks</div>
            ) : (
              tasks.slice(0, 8).map(task => (
                <div key={task.id} className="border border-app-border bg-black px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-brand-cyan truncate">{task.target}</span>
                    <span className={`text-[9px] uppercase ${task.status === "complete" ? "text-emerald-400" : "text-brand-amber"}`}>
                      {task.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-1">{task.summary || "Delegated task"}</div>
                </div>
              ))
            )}
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
            <button
              onClick={() => setShowNetworkGraph(true)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-cyan bg-[#0a0a0c] border border-app-border"
              title="Collaboration Graph"
            >
              <Network size={16} />
            </button>
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
                                <TerminalInstance 
                                  agentName={agent}
                                  cwd={currentProject} 
                                  onRemove={() => removeAgent(agent)} 
                                  onDetach={() => detachAgent(agent)}
                                  onDragStart={(e) => handleDragStart(e, agents.indexOf(agent))}
                                  onDrop={(e) => handleDrop(e, agents.indexOf(agent))}
                                  onDragOver={handleDragOver}
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
                    {index > 0 && <Separator className={`bg-app-border transition-colors hover:bg-brand-cyan focus:bg-brand-cyan ${layoutOrientation === 'horizontal' ? 'w-1 mx-0.5' : 'h-1 my-0.5'}`} />}
                    <Panel defaultSize={100 / agents.length} minSize={10}>
                      <TerminalInstance 
                        agentName={agent} 
                        cwd={currentProject} 
                        onRemove={() => removeAgent(agent)} 
                        onDetach={() => detachAgent(agent)}
                        onDragStart={(e: React.DragEvent) => handleDragStart(e, index)}
                        onDrop={(e: React.DragEvent) => handleDrop(e, index)}
                        onDragOver={handleDragOver}
                      />
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
