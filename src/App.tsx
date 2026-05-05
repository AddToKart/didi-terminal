import { Panel, Group, Separator } from "react-resizable-panels";
import { TerminalInstance } from "./components/TerminalInstance";
import { useEffect, useState, useRef, FormEvent, Fragment } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const EXISTING_AGENT_FALLBACK_MS = 1000;
const NEW_AGENT_FALLBACK_MS = 6000;

function App() {
  const [agents, setAgents] = useState<string[]>(["Main Terminal"]);
  const [newAgentName, setNewAgentName] = useState("");
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  // Use a ref to always have fresh state inside async callbacks
  // (fixes stale closure bug in useEffect with [] deps)
  const pendingHandoffs = useRef<Map<string, string>>(new Map());
  const readyAgents = useRef<Set<string>>(new Set());
  const agentsRef = useRef(agents);
  const fallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    const writeHandoff = (agentKey: string, payload: string) => {
      console.log(`[JS] Injecting handoff into ${agentKey}`);
      invoke("write_pty", { agent: agentKey, data: payload + "\r" }).catch(console.error);
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

        console.warn(`[JS] Prompt-ready event missed for ${agentKey}; flushing queued handoff`);
        readyAgents.current.add(agentKey);
        flushQueuedHandoff(agentKey);
      }, fallbackMs);

      fallbackTimers.current.set(agentKey, timer);
    };

    // Listen for agent handoffs from the Rust message bus
    const unlistenHandoff = listen<{ target: string, payload: string }>("agent-handoff", (event) => {
      const { target, payload } = event.payload;
      const targetName = target.trim();
      const agentKey = targetName.toLowerCase();
      console.log(`[JS] Handoff: target=${agentKey}, ${payload.length} bytes`);

      const agentExists = agentsRef.current.some(a => a.toLowerCase() === agentKey);
      if (!agentExists) {
        setAgents(prev => {
          if (prev.some(a => a.toLowerCase() === agentKey)) return prev;

          const nextAgents = [...prev, targetName];
          agentsRef.current = nextAgents;
          return nextAgents;
        });
      }

      // Clean the payload so it's safe for single-line TUI input
      const safePayload = payload.replace(/\r?\n/g, ' ').trim();

      if (agentExists && readyAgents.current.has(agentKey)) {
        // Agent already exists and is at the prompt — inject immediately
        console.log(`[JS] Agent ${agentKey} is ready, injecting now`);
        writeHandoff(agentKey, safePayload);
      } else {
        // Queue the payload; TerminalInstance will flush it when the prompt is detected
        console.log(`[JS] Agent ${agentKey} not ready yet, queueing payload`);
        queueHandoff(agentKey, safePayload, agentExists ? EXISTING_AGENT_FALLBACK_MS : NEW_AGENT_FALLBACK_MS);
      }
    });

    // Listen for agents reporting their prompt is ready
    const unlistenReady = listen<{ agent: string }>("agent-prompt-ready", (event) => {
      const agentKey = event.payload.agent.toLowerCase();
      console.log(`[JS] Agent ${agentKey} prompt is ready`);
      readyAgents.current.add(agentKey);

      // If there's a queued handoff for this agent, send it now
      if (pendingHandoffs.current.has(agentKey)) {
        console.log(`[JS] Flushing queued payload to ${agentKey}`);
        // Wait a tiny bit more to ensure the TUI is settled
        setTimeout(() => {
          flushQueuedHandoff(agentKey);
        }, 500);
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
    if (newAgentName.trim() && !agents.includes(newAgentName.trim())) {
      setAgents([...agents, newAgentName.trim()]);
      setNewAgentName("");
    }
  };

  const handleOpenProject = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setCurrentProject(selected as string);
  };

  const handleInitialize = async () => {
    if (currentProject) {
      try {
        await invoke("initialize_project", { cwd: currentProject });
        alert("Project initialized! .didi folder and AGENTS.md created.");
      } catch (err) {
        alert("Failed to initialize: " + err);
      }
    }
  };

  return (
    <main className="h-screen w-screen bg-[#0a0a0c] text-slate-200 font-mono p-1 flex flex-col">
      <div className="flex justify-between items-center p-2 border-b-2 border-zinc-800 mb-2">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold uppercase tracking-widest text-sky-400">DidiTerminal</div>
          <div className="flex gap-2">
            <button onClick={handleOpenProject} className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 text-xs font-bold uppercase border border-zinc-700 transition-all active:scale-95">
              {currentProject ? "Change Workspace" : "Open Workspace"}
            </button>
            {currentProject && (
              <button onClick={handleInitialize} className="bg-sky-900/50 hover:bg-sky-800/50 text-sky-200 px-3 py-1 text-xs font-bold uppercase border border-sky-700/50 transition-all active:scale-95">
                Init Didi
              </button>
            )}
          </div>
        </div>
        <form onSubmit={spawnAgent} className="flex gap-2">
          <input
            type="text"
            value={newAgentName}
            onChange={e => setNewAgentName(e.target.value)}
            placeholder="Spawn Agent..."
            className="bg-black/50 border border-zinc-800 text-sky-400 px-2 py-1 text-xs outline-none focus:border-sky-500 transition-colors"
          />
          <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-black px-3 py-1 text-xs font-black uppercase transition-all active:scale-95">
            + Agent
          </button>
        </form>
      </div>
      <div className="flex-1 overflow-hidden">
        <Group orientation="horizontal">
          {agents.map((agent, index) => (
            <Fragment key={agent}>
              {index > 0 && <Separator className="w-1 mx-1 bg-zinc-800 hover:bg-zinc-600 transition-colors" />}
              <Panel defaultSize={100 / agents.length} minSize={10}>
                <TerminalInstance agentName={agent} cwd={currentProject} />
              </Panel>
            </Fragment>
          ))}
        </Group>
      </div>
    </main>
  );
}

export default App;
