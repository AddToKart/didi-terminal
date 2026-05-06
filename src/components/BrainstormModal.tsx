import { FormEvent, useMemo, useState } from "react";
import { Brain, RadioTower, X } from "lucide-react";

export interface BrainstormSession {
  id: string;
  prompt: string;
  participants: string[];
  round: number;
  turns: number;
  status: "collecting" | "complete";
  responses: Array<{
    agent: string;
    round: number;
    text: string;
    at: string;
  }>;
}

interface Props {
  agents: string[];
  sessions: BrainstormSession[];
  onStart: (prompt: string, participants: string[], turns: number) => void;
  onClose: () => void;
}

export const BrainstormModal = ({ agents, sessions, onStart, onClose }: Props) => {
  const defaultAgents = useMemo(() => agents.slice(0, 3), [agents]);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState(2);
  const [participants, setParticipants] = useState<string[]>(defaultAgents);

  const toggleAgent = (agent: string) => {
    setParticipants(prev => (
      prev.includes(agent)
        ? prev.filter(item => item !== agent)
        : [...prev, agent]
    ));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || participants.length < 2) return;

    onStart(cleanPrompt, participants, turns);
    setPrompt("");
  };

  const activeSession = sessions[0];

  return (
    <div className="absolute inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-8">
      <div className="w-full max-w-4xl max-h-full border border-brand-accent/30 bg-app-panel shadow-md flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div>
            <h2 className="text-lg text-brand-primary font-bold font-medium tracking-tight flex items-center gap-2">
              <Brain size={20} />
              Brainstorm Mode
            </h2>
            <p className="text-xs text-slate-500 mt-1">Broadcast a problem, collect debate rounds, then append consensus to MASTER_PLAN.md.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-brand-warn p-2 border border-app-border hover:border-brand-warn bg-app-bg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0">
          <form onSubmit={handleSubmit} className="p-4 space-y-4 border-r border-app-border">
            <div>
              <label className="text-[10px] font-bold text-slate-500 font-medium tracking-tight">Problem</label>
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                className="mt-2 w-full h-36 bg-zinc-950 border border-app-border focus:border-brand-accent text-slate-200 p-3 text-sm outline-none resize-none"
                placeholder="What should the agents debate?"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 font-medium tracking-tight">Agents</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {agents.map(agent => (
                  <label key={agent} className="flex items-center gap-2 border border-app-border bg-zinc-950 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={participants.includes(agent)}
                      onChange={() => toggleAgent(agent)}
                      className="accent-cyan-400"
                    />
                    <span className="truncate">{agent}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 text-[10px] font-bold text-slate-500 font-medium tracking-tight">
                Turns
                <input
                  type="number"
                  min={2}
                  max={3}
                  value={turns}
                  onChange={event => setTurns(Math.min(3, Math.max(2, Number(event.target.value) || 2)))}
                  className="w-16 bg-zinc-950 border border-app-border text-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-accent"
                />
              </label>
              <button
                type="submit"
                disabled={prompt.trim().length === 0 || participants.length < 2}
                className="bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-primary border border-brand-accent/30 hover:border-brand-accent/50 disabled:opacity-40 px-4 py-2 text-xs font-bold font-medium tracking-tight transition-colors flex items-center gap-2"
              >
                <RadioTower size={14} />
                Broadcast
              </button>
            </div>
          </form>

          <div className="p-4 min-h-0 flex flex-col">
            <div className="text-[10px] font-bold text-slate-500 font-medium tracking-tight mb-2">Latest Session</div>
            {!activeSession ? (
              <div className="text-xs text-slate-600 border border-app-border bg-zinc-950 p-3">No brainstorm sessions yet</div>
            ) : (
              <div className="min-h-0 flex-1 flex flex-col border border-app-border bg-zinc-950">
                <div className="p-3 border-b border-app-border">
                  <div className="text-xs text-slate-300 line-clamp-3">{activeSession.prompt}</div>
                  <div className="text-[10px] text-slate-600 mt-2 font-medium tracking-tight">
                    Round {activeSession.round}/{activeSession.turns} - {activeSession.status}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {activeSession.responses.length === 0 ? (
                    <div className="text-xs text-slate-600">Waiting for agent responses</div>
                  ) : (
                    activeSession.responses.map((response, index) => (
                      <div key={`${response.agent}-${response.round}-${index}`} className="border border-app-border bg-[#050506] p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-medium tracking-tight text-brand-primary truncate">{response.agent}</span>
                          <span className="text-[9px] text-slate-600">R{response.round} {response.at}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug line-clamp-3">{response.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
