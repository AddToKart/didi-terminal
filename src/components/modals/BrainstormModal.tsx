import { FormEvent, useMemo, useState } from "react";
import { Brain, RadioTower, X, ChevronLeft, ChevronRight, MessageSquareText } from "lucide-react";
import type { AgentInstance } from "../../types/workspace";

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
  agents: AgentInstance[];
  sessions: BrainstormSession[];
  onStart: (prompt: string, participants: string[], turns: number) => void;
  onClose: () => void;
}

export const BrainstormModal = ({ agents, sessions, onStart, onClose }: Props) => {
  const defaultAgents = useMemo(() => agents.slice(0, 3).map(a => a.name), [agents]);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState(2);
  const [participants, setParticipants] = useState<string[]>(defaultAgents);

  // Carousel Modal State
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [carouselRoundIndex, setCarouselRoundIndex] = useState(0);

  const toggleAgent = (agentName: string) => {
    setParticipants(prev => (
      prev.includes(agentName)
        ? prev.filter(item => item !== agentName)
        : [...prev, agentName]
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

  // Group responses by agent
  const agentResponses = useMemo(() => {
    if (!activeSession) return {};
    const grouped: Record<string, typeof activeSession.responses> = {};
    activeSession.responses.forEach(r => {
      if (!grouped[r.agent]) grouped[r.agent] = [];
      grouped[r.agent].push(r);
    });
    // Sort by round to ensure correct carousel order
    Object.values(grouped).forEach(arr => arr.sort((a, b) => a.round - b.round));
    return grouped;
  }, [activeSession]);

  const openCarousel = (agent: string) => {
    setSelectedAgentId(agent);
    setCarouselRoundIndex(0);
  };

  const selectedAgentResponses = selectedAgentId ? agentResponses[selectedAgentId] || [] : [];
  const currentCarouselResponse = selectedAgentResponses[carouselRoundIndex];

  return (
    <div className="absolute inset-0 z-50 bg-app-panel/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="w-full max-w-4xl max-h-full border border-zinc-800/50 bg-app-panel shadow-xl flex flex-col rounded-lg overflow-hidden relative">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/50">
          <div>
            <h2 className="text-lg text-zinc-100 font-semibold tracking-tight flex items-center gap-2">
              <Brain className="text-brand-accent" size={20} />
              Brainstorm Mode
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-medium">Broadcast a problem, collect debate rounds, then append consensus to MASTER_PLAN.md.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-2 border border-zinc-800/50 hover:border-zinc-600 bg-app-panel rounded-sm shadow-sm transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0 bg-app-bg">
          <form onSubmit={handleSubmit} className="p-6 space-y-6 border-r border-zinc-800/50">
            <div>
              <label className="text-xs font-semibold text-zinc-400 tracking-tight">Problem Statement</label>
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                className="mt-2 w-full h-32 bg-app-panel border border-zinc-800/50 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 rounded-md text-zinc-200 p-3 text-sm outline-none resize-none transition-all shadow-inner"
                placeholder="What should the agents debate?"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 tracking-tight">Select Participants</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {agents.map(agent => (
                  <label key={agent.id} className="flex items-center gap-3 border border-zinc-800/50 bg-app-panel/50 hover:bg-zinc-900/40 px-3 py-2.5 rounded-md text-sm text-zinc-300 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={participants.includes(agent.name)}
                      onChange={() => toggleAgent(agent.name)}
                      className="accent-brand-accent w-4 h-4 rounded-sm border-zinc-700/50 bg-app-panel"
                    />
                    <span className="truncate font-medium">{agent.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <label className="flex items-center gap-3 text-xs font-semibold text-zinc-400 tracking-tight">
                Debate Rounds
                <input
                  type="number"
                  min={2}
                  max={4}
                  value={turns}
                  onChange={event => setTurns(Math.min(4, Math.max(2, Number(event.target.value) || 2)))}
                  className="w-16 bg-app-panel border border-zinc-800/50 rounded-md text-zinc-200 px-3 py-1.5 text-sm outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20"
                />
              </label>
              <button
                type="submit"
                disabled={prompt.trim().length === 0 || participants.length < 2}
                className="bg-brand-accent hover:bg-blue-600 text-white disabled:bg-zinc-800/40 disabled:text-zinc-500 disabled:cursor-not-allowed px-5 py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
              >
                <RadioTower size={16} />
                Broadcast Debate
              </button>
            </div>
          </form>

          <div className="p-6 min-h-0 flex flex-col bg-zinc-900/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 tracking-tight">Active Session</span>
              {activeSession && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${activeSession.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-brand-warn/10 text-amber-400 border border-brand-warn/20'}`}>
                  {activeSession.status}
                </span>
              )}
            </div>
            
            {!activeSession ? (
              <div className="flex-1 border border-dashed border-zinc-800/50 rounded-lg flex items-center justify-center text-sm text-zinc-600 font-medium">
                No active debate
              </div>
            ) : (
              <div className="min-h-0 flex-1 flex flex-col">
                <div className="bg-app-panel border border-zinc-800/50 rounded-t-lg p-3">
                  <div className="text-xs text-zinc-300 line-clamp-2 font-medium">{activeSession.prompt}</div>
                  <div className="text-[10px] text-zinc-500 mt-2 font-medium">
                    Target: {activeSession.turns} rounds
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-app-panel/50 border-x border-b border-zinc-800/50 rounded-b-lg shadow-inner">
                  {Object.keys(agentResponses).length === 0 ? (
                    <div className="text-xs text-zinc-600 text-center mt-4">Waiting for responses...</div>
                  ) : (
                    Object.entries(agentResponses).map(([agentName, responses]) => {
                      const latestResponse = responses[responses.length - 1];
                      return (
                        <div 
                          key={agentName} 
                          onClick={() => openCarousel(agentName)}
                          className="border border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-800/80 hover:border-zinc-600 p-3 rounded-md cursor-pointer transition-all shadow-sm group"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-semibold text-brand-primary truncate">{agentName}</span>
                            <span className="text-[10px] bg-zinc-800/40 text-zinc-400 px-1.5 py-0.5 rounded-sm font-medium">
                              {responses.length} / {activeSession.turns}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 leading-snug line-clamp-2 group-hover:text-zinc-300 transition-colors">
                            <span className="font-semibold text-zinc-500 mr-1">R{latestResponse.round}:</span>
                            {latestResponse.text}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carousel Overlay */}
        {selectedAgentId && currentCarouselResponse && (
          <div className="absolute inset-0 z-50 bg-app-panel/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-xl bg-zinc-900/40 border border-zinc-800/50 rounded-lg shadow-2xl flex flex-col max-h-full">
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/50">
                <div className="flex items-center gap-2">
                  <MessageSquareText size={16} className="text-brand-accent" />
                  <span className="text-sm font-semibold text-zinc-200">{selectedAgentId}'s Responses</span>
                </div>
                <button onClick={() => setSelectedAgentId(null)} className="text-zinc-500 hover:text-zinc-200 p-1.5 transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 text-sm text-zinc-300 leading-relaxed">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 bg-zinc-800/40 px-2 py-1 rounded-sm">Round {currentCarouselResponse.round}</span>
                  <span className="text-xs text-zinc-500">{currentCarouselResponse.at}</span>
                </div>
                <div className="whitespace-pre-wrap">{currentCarouselResponse.text}</div>
              </div>

              {selectedAgentResponses.length > 1 && (
                <div className="px-5 py-3 border-t border-zinc-800/50 flex items-center justify-between bg-app-panel/50 rounded-b-lg">
                  <button 
                    onClick={() => setCarouselRoundIndex(i => Math.max(0, i - 1))}
                    disabled={carouselRoundIndex === 0}
                    className="p-1.5 rounded bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-30 disabled:hover:bg-zinc-800/40 transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    <ChevronLeft size={16} /> Prev Round
                  </button>
                  <span className="text-xs font-semibold text-zinc-500">
                    {carouselRoundIndex + 1} of {selectedAgentResponses.length}
                  </span>
                  <button 
                    onClick={() => setCarouselRoundIndex(i => Math.min(selectedAgentResponses.length - 1, i + 1))}
                    disabled={carouselRoundIndex === selectedAgentResponses.length - 1}
                    className="p-1.5 rounded bg-zinc-800/40 text-zinc-300 hover:bg-zinc-700/60 disabled:opacity-30 disabled:hover:bg-zinc-800/40 transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    Next Round <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
