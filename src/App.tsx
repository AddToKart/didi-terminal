import { Panel, Group, Separator } from "react-resizable-panels";
import { TerminalInstance } from "./components/TerminalInstance";
import { useCallback, useEffect, useState, useRef, FormEvent, Fragment, lazy, Suspense } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Terminal, FolderOpen, ShieldAlert, Cpu, Columns, Rows, Plus, X, Activity, Grid2X2, PanelLeftClose, PanelLeft, Network, Settings, Server, Brain, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { SentinelIncident, SentinelPanel } from "./components/SentinelPanel";
import { GitSnapshotRecord, SnapshotPanel } from "./components/SnapshotPanel";
import { BrainstormModal, BrainstormSession } from "./components/BrainstormModal";
import { MasterPlanPanel } from "./components/MasterPlanPanel";

const NetworkGraph = lazy(() => import("./components/NetworkGraph").then(module => ({ default: module.NetworkGraph })));
const SettingsModal = lazy(() => import("./components/SettingsModal").then(module => ({ default: module.SettingsModal })));

const EXISTING_AGENT_FALLBACK_MS = 1000;
const NEW_AGENT_FALLBACK_MS = 6000;
const HANDOFF_SUBMIT_DELAY_MS = 400;
const BRAINSTORM_CALLBACK_TARGET = "Brainstorm";

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

const stripTerminalControls = (value: string) =>
  value
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_][0-?]*[ -/]*[@-~]/g, "");

const isFailureOutput = (value: string) =>
  /(error|failed|exception|traceback|cannot find|not recognized|command not found|permission denied|access is denied|tests? failed|build failed|compilation failed|panic|fatal:)/i.test(value);

const normalizeLoopSignature = (value: string) =>
  stripTerminalControls(value)
    .replace(/\s+/g, " ")
    .replace(/\d{2,}/g, "#")
    .trim()
    .slice(0, 220);

const getBrainstormResponse = (payload: string) => {
  const match = payload.match(/^\s*(?:\[[^\]]+\]\s*:\s*)?brainstorm\s+response\s+([a-z0-9-]+)\s+round\s+(\d+)\s*:\s*([\s\S]+)/i);
  if (!match) return null;

  return {
    sessionId: match[1],
    round: Number(match[2]),
    text: match[3].replace(/\[SYSTEM RULE:[\s\S]*$/i, "").trim(),
  };
};

const getHandoffSender = (handoff: HandoffPayload) => {
  const bracketSender = handoff.payload.match(/^\s*\[([^\]]+?)\s+(?:DELEGATED A TASK|COMPLETED TASK)\]/i)?.[1];
  return bracketSender?.trim() || handoff.sender?.trim() || "";
};

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

interface MasterPlanTaskDispatch {
  line: number;
  text: string;
  section: string;
}

interface GraphHandoff {
  id: string;
  source: string;
  target: string;
  kind: string;
}

interface TerminalInputPayload {
  agent: string;
  data: string;
}

interface TerminalOutputPayload {
  agent: string;
  data: string;
}

interface SentinelAgentState {
  inputBuffer: string;
  lastCommand: string;
  lastFailureCommand: string;
  failureCount: number;
  lastFailureAt: number;
  lastSignature: string;
  signatureCount: number;
  lastInterventionAt: number;
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const standaloneAgent = params.get('agent');
  const standaloneCwd = params.get('cwd') || localStorage.getItem("didi_project");

  if (standaloneAgent) {
    return (
      <div className="h-screen w-screen bg-app-bg">
        <TerminalInstance agentName={standaloneAgent} cwd={standaloneCwd} />
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
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [showMasterPlan, setShowMasterPlan] = useState(false);
  const [sidecarStatus, setSidecarStatus] = useState("Checking...");
  const [activity, setActivity] = useState<ActivityLog[]>([{ id: 0, time: new Date().toLocaleTimeString(), message: "System initialized", type: 'system' }]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [isTasksCollapsed, setIsTasksCollapsed] = useState(false);
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [graphHandoffs, setGraphHandoffs] = useState<GraphHandoff[]>([]);
  const [sentinelEnabled, setSentinelEnabled] = useState(() => localStorage.getItem("didi_sentinel") !== "false");
  const [sentinelIncidents, setSentinelIncidents] = useState<SentinelIncident[]>([]);
  const [snapshots, setSnapshots] = useState<GitSnapshotRecord[]>([]);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [brainstormSessions, setBrainstormSessions] = useState<BrainstormSession[]>([]);

  const pendingHandoffs = useRef<Map<string, string[]>>(new Map());
  const readyAgents = useRef<Set<string>>(new Set());
  const agentsRef = useRef(agents);
  const currentProjectRef = useRef(currentProject);
  const fallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const logIdCounter = useRef(1);
  const sentinelEnabledRef = useRef(sentinelEnabled);
  const sentinelStates = useRef<Map<string, SentinelAgentState>>(new Map());
  const brainstormSessionsRef = useRef<BrainstormSession[]>([]);
  const activeMasterPlanTasks = useRef<Array<{ line: number; text: string; dispatchedAt: number }>>([]);

  const addLog = (message: string, type: 'system' | 'handoff' = 'system') => {
    setActivity(prev => {
      const newLog = { id: logIdCounter.current++, time: new Date().toLocaleTimeString(), message, type };
      return [newLog, ...prev].slice(0, 50); // Keep last 50
    });
  };

  const refreshSnapshots = useCallback(async (project = currentProjectRef.current) => {
    if (!project) {
      setSnapshots([]);
      return;
    }

    try {
      const records = await invoke<GitSnapshotRecord[]>("list_git_snapshots", { cwd: project });
      setSnapshots(records);
    } catch (err) {
      console.warn("Failed to list git snapshots", err);
      setSnapshots([]);
    }
  }, []);

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
    sentinelEnabledRef.current = sentinelEnabled;
    localStorage.setItem("didi_sentinel", String(sentinelEnabled));
  }, [sentinelEnabled]);

  useEffect(() => {
    brainstormSessionsRef.current = brainstormSessions;
  }, [brainstormSessions]);

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
    refreshSnapshots(currentProject);
  }, [currentProject]);

  useEffect(() => {
    // Initial config load for theme
    invoke<any>("get_config").then(config => {
      document.documentElement.style.setProperty('--tw-colors-brand-accent', config.theme_cyan);
      document.documentElement.style.setProperty('--tw-colors-brand-warn', config.theme_amber);
    }).catch(console.error);

    const interval = setInterval(() => {
      invoke<string>("get_sidecar_status").then(setSidecarStatus).catch(() => setSidecarStatus("Error"));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getState = (agent: string): SentinelAgentState => {
      const key = getPtyKey(agent);
      const existing = sentinelStates.current.get(key);
      if (existing) return existing;

      const next: SentinelAgentState = {
        inputBuffer: "",
        lastCommand: "",
        lastFailureCommand: "",
        failureCount: 0,
        lastFailureAt: 0,
        lastSignature: "",
        signatureCount: 0,
        lastInterventionAt: 0,
      };
      sentinelStates.current.set(key, next);
      return next;
    };

    const intervene = (agent: string, reason: string, command?: string) => {
      const key = getPtyKey(agent);
      const state = getState(key);
      const now = Date.now();
      if (now - state.lastInterventionAt < 45000) return;

      state.lastInterventionAt = now;
      state.failureCount = 0;
      state.signatureCount = 0;

      const prompt = `You are stuck in a loop. Sentinel paused you because ${reason}. Try a different approach, inspect the actual error, or ask another agent for help. Do not retry the same command again unchanged.`;
      // Use Escape (\u001b) 4 times to reliably interrupt the agent's internal process
      invoke("write_pty", { agent: key, data: "\u001b\u001b\u001b\u001b" }).catch(console.error);
      setTimeout(() => {
        invoke("write_pty", { agent: key, data: prompt }).catch(console.error);
      }, 300);
      setTimeout(() => {
        invoke("write_pty", { agent: key, data: "\r" }).catch(console.error);
      }, 700);

      const incident: SentinelIncident = {
        id: `${now}-${key}`,
        agent,
        reason,
        command,
        at: new Date().toLocaleTimeString(),
      };
      setSentinelIncidents(prev => [incident, ...prev].slice(0, 20));
      addLog(`Sentinel paused ${agent}: ${reason}`, "system");
      emit("sentinel-intervention", incident).catch(console.error);
    };

    const unlistenInput = listen<TerminalInputPayload>("agent-input", (event) => {
      if (!sentinelEnabledRef.current) return;

      const key = getPtyKey(event.payload.agent);
      const state = getState(key);
      for (const char of event.payload.data) {
        if (char === "\r" || char === "\n") {
          const command = stripTerminalControls(state.inputBuffer).trim();
          if (command) state.lastCommand = command.slice(-240);
          state.inputBuffer = "";
          continue;
        }

        if (char === "\u007f" || char === "\b") {
          state.inputBuffer = state.inputBuffer.slice(0, -1);
          continue;
        }

        if (char >= " " && char !== "\u001b") {
          state.inputBuffer = `${state.inputBuffer}${char}`.slice(-400);
        }
      }
    });

    const unlistenOutput = listen<TerminalOutputPayload>("pty-output", (event) => {
      if (!sentinelEnabledRef.current) return;

      const key = getPtyKey(event.payload.agent);
      const state = getState(key);
      const text = stripTerminalControls(event.payload.data);
      const signature = normalizeLoopSignature(text);
      if (signature.length > 40 && signature === state.lastSignature) {
        state.signatureCount += 1;
      } else if (signature.length > 40) {
        state.lastSignature = signature;
        state.signatureCount = 1;
      }

      if (state.signatureCount >= 4) {
        intervene(key, "the same terminal output repeated several times", state.lastCommand);
        return;
      }

      if (!state.lastCommand || !isFailureOutput(text)) return;

      const now = Date.now();
      const sameCommand = state.lastFailureCommand === state.lastCommand && now - state.lastFailureAt < 180000;
      state.failureCount = sameCommand ? state.failureCount + 1 : 1;
      state.lastFailureCommand = state.lastCommand;
      state.lastFailureAt = now;

      if (state.failureCount >= 3) {
        intervene(key, "the same command appears to have failed 3 times", state.lastCommand);
      }
    });

    return () => {
      unlistenInput.then(f => f());
      unlistenOutput.then(f => f());
    };
  }, []);

  const sendBrainstormRound = async (session: BrainstormSession, round: number) => {
    const previousResponses = session.responses
      .filter(response => response.round < round)
      .map(response => `${response.agent}: ${response.text}`)
      .join(" ");

    await Promise.all(session.participants.map(participant => emit("agent-handoff", {
      target: participant,
      sender: "Brainstorm",
      kind: "task",
      taskId: `${session.id}-r${round}-${getAgentId(participant)}`,
      payload: [
        `[Brainstorm round ${round}/${session.turns}] ${session.prompt}`,
        previousResponses ? `Previous responses: ${previousResponses}` : "",
        `Respond with your position and one concrete recommendation, then run exactly: .didi\\delegate ${BRAINSTORM_CALLBACK_TARGET} "Brainstorm response ${session.id} round ${round}: <your concise response without quotation marks>"`,
      ].filter(Boolean).join(" "),
    })));
  };

  const finishBrainstorm = async (session: BrainstormSession) => {
    const transcript = session.responses
      .map(response => `- ${response.agent} (round ${response.round}): ${response.text}`)
      .join("\n");

    let consensus = transcript;
    try {
      consensus = await invoke<string>("ask_llm", {
        system: "You convert multi-agent debate notes into a concise implementation plan. Return bullets only.",
        prompt: `Problem: ${session.prompt}\n\nResponses:\n${transcript}`,
      });
    } catch (err) {
      console.warn("Consensus synthesis failed; using raw brainstorm transcript", err);
    }

    const body = [
      `Prompt: ${session.prompt}`,
      "",
      "### Consensus",
      consensus,
      "",
      "### Participants",
      session.participants.map(agent => `- ${agent}`).join("\n"),
    ].join("\n");

    if (currentProjectRef.current) {
      try {
        await invoke("append_master_plan_entry", {
          cwd: currentProjectRef.current,
          title: `Brainstorm Consensus ${new Date().toLocaleString()}`,
          body,
        });
        addLog("Brainstorm consensus appended to MASTER_PLAN.md", "system");
      } catch (err) {
        addLog(`Brainstorm consensus save failed: ${err}`, "system");
      }
    } else {
      addLog("Brainstorm consensus ready; select a workspace to write MASTER_PLAN.md", "system");
    }

    const completedSessions: BrainstormSession[] = brainstormSessionsRef.current.map(item => (
      item.id === session.id ? { ...item, status: "complete" as const } : item
    ));
    brainstormSessionsRef.current = completedSessions;
    setBrainstormSessions(completedSessions);
  };

  const recordBrainstormResponse = async (
    agent: string,
    response: { sessionId: string; round: number; text: string }
  ) => {
    const session = brainstormSessionsRef.current.find(item => item.id === response.sessionId);
    if (!session || session.status === "complete") return;

    const cleanAgent = agent.trim() || "Agent";
    const isParticipant = session.participants.some(participant => getAgentId(participant) === getAgentId(cleanAgent));
    if (!isParticipant) return;

    const alreadyRecorded = session.responses.some(item =>
      getAgentId(item.agent) === getAgentId(cleanAgent) && item.round === response.round
    );
    if (alreadyRecorded) return;

    const nextSession: BrainstormSession = {
      ...session,
      responses: [
        ...session.responses,
        {
          agent: cleanAgent,
          round: response.round,
          text: response.text,
          at: new Date().toLocaleTimeString(),
        },
      ],
    };

    const nextSessions = brainstormSessionsRef.current.map(item =>
      item.id === nextSession.id ? nextSession : item
    );
    brainstormSessionsRef.current = nextSessions;
    setBrainstormSessions(nextSessions);
    addLog(`Brainstorm response from ${cleanAgent}`, "handoff");

    const roundResponders = new Set(
      nextSession.responses
        .filter(item => item.round === nextSession.round)
        .map(item => getAgentId(item.agent))
    );
    const participantIds = nextSession.participants.map(getAgentId);
    const roundComplete = participantIds.every(id => roundResponders.has(id));
    if (!roundComplete) return;

    if (nextSession.round < nextSession.turns) {
      const advancedSession = { ...nextSession, round: nextSession.round + 1 };
      const advancedSessions = brainstormSessionsRef.current.map(item =>
        item.id === advancedSession.id ? advancedSession : item
      );
      brainstormSessionsRef.current = advancedSessions;
      setBrainstormSessions(advancedSessions);
      addLog(`Brainstorm advancing to round ${advancedSession.round}`, "system");
      await sendBrainstormRound(advancedSession, advancedSession.round);
      return;
    }

    await finishBrainstorm(nextSession);
  };

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
      const queue = pendingHandoffs.current.get(agentKey);
      if (!queue || queue.length === 0) return;

      const queued = queue.shift();
      if (queue.length === 0) {
        pendingHandoffs.current.delete(agentKey);
        clearFallbackTimer(agentKey);
      } else {
        pendingHandoffs.current.set(agentKey, queue);
      }
      if (!queued) return;

      clearFallbackTimer(agentKey);
      writeHandoff(agentKey, queued);
    };

    const queueHandoff = (agentKey: string, payload: string, fallbackMs: number) => {
      const queue = pendingHandoffs.current.get(agentKey) ?? [];
      queue.push(payload);
      pendingHandoffs.current.set(agentKey, queue);

      if (fallbackTimers.current.has(agentKey)) return;
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
        return id;
      }

      if (kind === "completion") {
        const completedAgentId = getAgentId(sender);
        setTasks(prev => prev.map(task => {
          if (task.status !== "in_progress" || getAgentId(task.target) !== completedAgentId) return task;
          return { ...task, status: "complete", updatedAt };
        }));

        const completionTargetId = getAgentId(targetName);
        if ((completionTargetId === "orchestrator" || completionTargetId === "masterplan") && currentProjectRef.current && activeMasterPlanTasks.current.length > 0) {
          const [completedPlanTask, ...remainingPlanTasks] = activeMasterPlanTasks.current;
          activeMasterPlanTasks.current = remainingPlanTasks;
          invoke("set_master_plan_task_status", {
            cwd: currentProjectRef.current,
            line: completedPlanTask.line,
            status: "done",
          }).then(() => {
            addLog(`Master Plan completed: ${completedPlanTask.text}`, "system");
          }).catch(err => {
            invoke("set_master_plan_task_status_by_text", {
              cwd: currentProjectRef.current,
              text: completedPlanTask.text,
              status: "done",
            }).then(() => {
              addLog(`Master Plan completed: ${completedPlanTask.text}`, "system");
            }).catch(() => {
              addLog(`Master Plan completion sync failed: ${err}`, "system");
            });
          });
        }
      }

      return id;
    };

    const createPlanSnapshot = async (taskId: string, targetName: string, summary: string) => {
      const project = currentProjectRef.current;
      if (!project) return;

      try {
        const snapshot = await invoke<GitSnapshotRecord>("create_git_snapshot", {
          cwd: project,
          taskId,
          label: summary || `Task for ${targetName}`,
          agent: targetName,
        });
        setSnapshots(prev => [snapshot, ...prev.filter(item => item.id !== snapshot.id)].slice(0, 40));
        addLog(`Snapshot ${snapshot.commit.slice(0, 8)} before ${targetName}`, "system");
      } catch (err) {
        addLog(`Snapshot skipped: ${err}`, "system");
      }
    };

    const enrichPayload = async (handoff: HandoffPayload, kind: HandoffKind) => {
      const safePayload = handoff.payload.replace(/\r?\n/g, " ").trim();
      const workspace = currentProjectRef.current;
      if (kind !== "task" || !workspace) return safePayload;

      try {
        const context = await invoke<string>("get_project_context", { cwd: workspace });
        return `${safePayload} WORKSPACE ROOT: ${workspace}. All file reads and writes must stay under this workspace root. Do not edit files in the DidiTerminal app directory unless it is the selected workspace. If another specialist owns the next step, delegate directly to that agent instead of routing through Orchestrator. Notify Orchestrator only when the whole delegated chain is complete or explicitly requested. WORKSPACE CONTEXT: ${context.replace(/\r?\n/g, " ").trim()}`;
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
      const brainstormResponse = getBrainstormResponse(handoff.payload);

      if (getAgentId(targetName) === "masterplan" && kind === "completion") {
        addLog("completion to Master Plan", "handoff");
        registerTask(handoff, targetName, kind);
        return;
      }

      if (brainstormResponse) {
        const senderAgent = getHandoffSender(handoff) || resolvedAgentName;
        await recordBrainstormResponse(senderAgent, brainstormResponse);
        // Treat brainstorm response as a task completion
        registerTask(handoff, targetName, "completion");
        return;
      }

      addLog(
        matchingAgent && matchingAgent !== targetName
          ? `${kind} to ${matchingAgent} (${targetName})`
          : `${kind} to ${targetName}`,
        "handoff"
      );
      const taskId = registerTask(handoff, resolvedAgentName, kind);

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

      if (kind === "task") {
        await createPlanSnapshot(taskId, resolvedAgentName, getTaskSummary(handoff.payload));
      }

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

  const handleManualSnapshot = async () => {
    if (!currentProject) return;

    setSnapshotBusy(true);
    try {
      const snapshot = await invoke<GitSnapshotRecord>("create_git_snapshot", {
        cwd: currentProject,
        taskId: `manual-${Date.now()}`,
        label: "Manual checkpoint",
        agent: "Manual",
      });
      setSnapshots(prev => [snapshot, ...prev.filter(item => item.id !== snapshot.id)].slice(0, 40));
      addLog(`Manual snapshot ${snapshot.commit.slice(0, 8)} created`, "system");
    } catch (err) {
      addLog(`Manual snapshot failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleRewindSnapshot = async (snapshot: GitSnapshotRecord) => {
    if (!currentProject) return;
    const confirmed = window.confirm(`Rewind workspace files to snapshot ${snapshot.commit.slice(0, 8)}? This will overwrite current working tree changes.`);
    if (!confirmed) return;

    setSnapshotBusy(true);
    try {
      await invoke("rewind_git_snapshot", { cwd: currentProject, commit: snapshot.commit });
      addLog(`Rewound workspace to ${snapshot.commit.slice(0, 8)}`, "system");
      await refreshSnapshots(currentProject);
    } catch (err) {
      addLog(`Rewind failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleStartBrainstorm = async (prompt: string, participants: string[], turns: number) => {
    const session: BrainstormSession = {
      id: `bs-${Date.now().toString(36)}`,
      prompt,
      participants,
      turns,
      round: 1,
      status: "collecting",
      responses: [],
    };
    const nextSessions = [session, ...brainstormSessionsRef.current].slice(0, 8);
    brainstormSessionsRef.current = nextSessions;
    setBrainstormSessions(nextSessions);
    addLog(`Brainstorm started with ${participants.length} agents`, "system");
    await sendBrainstormRound(session, 1);
  };

  const handleDispatchMasterPlanTask = async (task: MasterPlanTaskDispatch) => {
    if (!currentProjectRef.current) return;

    activeMasterPlanTasks.current = [
      ...activeMasterPlanTasks.current.filter(item => item.line !== task.line),
      { line: task.line, text: task.text, dispatchedAt: Date.now() },
    ];

    await emit("agent-handoff", {
      target: "Orchestrator",
      sender: "MasterPlan",
      kind: "task",
      taskId: `master-plan-${task.line}-${Date.now()}`,
      payload: [
        `Queue this MASTER_PLAN.md task and delegate it to the right specialist when you are ready: ${task.text}`,
        `Section: ${task.section}.`,
        `Workspace: ${currentProjectRef.current}.`,
        `When the specialist chain is fully complete, ensure MASTER_PLAN.md line ${task.line + 1} is complete and send one completion callback to MasterPlan.`,
      ].join(" "),
    });
    addLog(`Queued Master Plan task for Orchestrator: ${task.text}`, "handoff");
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
    <main className="h-screen w-screen bg-app-bg text-slate-300 overflow-hidden flex selection:bg-brand-accent/20 relative">
      
      {showNetworkGraph && (
        <Suspense fallback={<div className="absolute inset-0 z-50 bg-zinc-950/80" />}>
          <NetworkGraph agents={agents} handoffs={graphHandoffs} tasks={tasks} onClose={() => setShowNetworkGraph(false)} />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={null}>
          <SettingsModal onClose={() => setShowSettings(false)} />
        </Suspense>
      )}

      {showBrainstorm && (
        <BrainstormModal
          agents={agents}
          sessions={brainstormSessions}
          onStart={handleStartBrainstorm}
          onClose={() => setShowBrainstorm(false)}
        />
      )}

      {showMasterPlan && (
        <MasterPlanPanel
          currentProject={currentProject}
          onDispatchTask={handleDispatchMasterPlanTask}
          onClose={() => setShowMasterPlan(false)}
        />
      )}

      {/* Sidebar */}
      {isSidebarOpen && (
      <aside className="w-72 border-r border-app-border bg-app-panel flex flex-col shadow-md z-10 shrink-0">
        <div className="p-4 border-b border-app-border flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-brand-primary mb-1">
              <Terminal size={20} className="stroke-[2.5]" />
              <h1 className="text-lg font-bold tracking-widest uppercase">DidiTerminal</h1>
            </div>
            <p className="text-xs text-slate-500 font-medium tracking-tight font-semibold">Orchestrator Node v2.0</p>
          </div>
          <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-brand-primary transition-colors mt-1" title="Settings">
            <Settings size={16} />
          </button>
        </div>

        {/* Project Setup */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="shrink-0 p-4 border-b border-app-border space-y-4">
            <div className="flex justify-between items-center text-xs font-semibold text-zinc-400">
               <div className="flex items-center gap-2"><Server size={14} /> LLM API</div>
               <span className={`${sidecarStatus === 'Connected' ? 'text-emerald-400' : 'text-amber-400'}`}>{sidecarStatus}</span>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-400 flex items-center gap-2 mb-2">
                <FolderOpen size={14} /> Workspace
              </div>
              <button 
                onClick={handleOpenProject} 
                className="w-full bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 flex items-center justify-between transition-colors group rounded-sm"
              >
                <span className="truncate">{currentProject ? currentProject.split('\\').pop() : "Select Directory..."}</span>
                <FolderOpen size={14} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
              </button>
            </div>
            
            {currentProject && (
              <button 
                onClick={handleInitialize} 
                className="w-full bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-primary border border-brand-accent/30 hover:border-brand-accent/50 px-3 py-2 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 rounded-sm"
              >
                <ShieldAlert size={14} /> Initialize Didi Protocol
              </button>
            )}
          </div>

          <SentinelPanel
            enabled={sentinelEnabled}
            incidents={sentinelIncidents}
            onToggle={() => setSentinelEnabled(value => !value)}
          />

          {/* Agents List */}
          <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border">
            <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-zinc-950 flex items-center justify-between border-b border-app-border">
              <span className="flex items-center gap-2"><Cpu size={14} /> Active Agents</span>
              <span>{agents.length}</span>
            </div>
            <div className="p-3 space-y-2">
              {agents.map(agent => (
                <div key={agent} className="group flex items-center justify-between px-3 py-2 bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700 transition-colors rounded-sm">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse"></div>
                    <span className="text-xs font-medium text-zinc-300 truncate">{agent}</span>
                  </div>
                  <button 
                    onClick={() => removeAgent(agent)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all"
                    title="Terminate Agent"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <SnapshotPanel
            currentProject={currentProject}
            snapshots={snapshots}
            isBusy={snapshotBusy}
            onSnapshot={handleManualSnapshot}
            onRewind={handleRewindSnapshot}
          />

          <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border bg-zinc-900/10">
            <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-zinc-950 flex items-center justify-between border-b border-app-border">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsTasksCollapsed(!isTasksCollapsed)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  {isTasksCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span>Task State</span>
              </div>
              <span className="text-zinc-500 font-normal">{tasks.filter(task => task.status !== "complete").length} active</span>
            </div>
            {!isTasksCollapsed && (
              <div className="p-3 space-y-2">
                {tasks.length === 0 ? (
                  <div className="text-xs text-zinc-500">No tracked tasks</div>
                ) : (
                  tasks.slice(0, 8).map(task => (
                    <div key={task.id} className="border border-zinc-800/50 bg-zinc-950/50 px-3 py-2 rounded-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-brand-primary truncate">{task.target}</span>
                        <span className={`text-[10px] uppercase ${task.status === "complete" ? "text-emerald-400" : "text-amber-400"}`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-1">{task.summary || "Delegated task"}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="shrink-0 flex flex-col min-h-0 bg-zinc-900/10 pb-4">
            <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-zinc-950 flex items-center gap-2 border-b border-app-border">
              <button onClick={() => setIsActivityCollapsed(!isActivityCollapsed)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                {isActivityCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>
              <Activity size={14} /> System Feed
            </div>
            {!isActivityCollapsed && (
              <div className="p-3 space-y-2">
                {activity.map(log => (
                  <div key={log.id} className="text-xs leading-tight flex gap-2">
                    <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                    <span className={log.type === 'handoff' ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                className="bg-[#0a0a0c] border border-app-border focus:border-brand-accent text-slate-200 pl-7 pr-3 py-1.5 text-xs outline-none transition-colors w-64 placeholder:text-slate-600"
              />
            </div>
            <button type="submit" className="hidden" /> {/* Hidden submit so enter works */}
          </form>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBrainstorm(true)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Brainstorm Mode"
            >
              <Brain size={16} />
            </button>
            <button
              onClick={() => setShowMasterPlan(true)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Master Plan Board"
            >
              <ClipboardList size={16} />
            </button>
            <button
              onClick={() => setShowNetworkGraph(true)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
              title="Collaboration Graph"
            >
              <Network size={16} />
            </button>
            <div className="flex items-center gap-1 bg-[#0a0a0c] p-1 border border-app-border rounded-sm">
              <button 
                onClick={() => setLayoutOrientation('horizontal')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'horizontal' ? 'bg-brand-accent/20 text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vertical Splits"
              >
                <Columns size={14} />
              </button>
              <button 
                onClick={() => setLayoutOrientation('vertical')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'vertical' ? 'bg-brand-accent/20 text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}
                title="Horizontal Splits"
              >
                <Rows size={14} />
              </button>
              <button 
                onClick={() => setLayoutOrientation('grid')}
                className={`p-1.5 rounded-sm transition-colors ${layoutOrientation === 'grid' ? 'bg-brand-accent/20 text-brand-primary' : 'text-slate-500 hover:text-slate-300'}`}
                title="Grid Split"
              >
                <Grid2X2 size={14} />
              </button>
            </div>
            
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-sm transition-colors text-slate-500 hover:text-brand-primary bg-[#0a0a0c] border border-app-border"
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
                      {rowIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent h-1 my-0.5" />}
                      <Panel defaultSize={100 / rowsCount} minSize={10}>
                        <Group orientation="horizontal" className="h-full w-full">
                          {rowAgents.map((agent, colIndex) => (
                            <Fragment key={agent}>
                              {colIndex > 0 && <Separator className="bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent w-1 mx-0.5" />}
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
                    {index > 0 && <Separator className={`bg-app-border transition-colors hover:bg-brand-accent focus:bg-brand-accent ${layoutOrientation === 'horizontal' ? 'w-1 mx-0.5' : 'h-1 my-0.5'}`} />}
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
