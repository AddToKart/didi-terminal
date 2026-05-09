import { useState } from "react";
import { ShieldAlert, Check, X, FileDiff, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  agentName: string;
  currentProject: string | null;
  onApprove: () => void;
  onReject: (feedback: string) => void;
}

export function ApprovalModal({ agentName, currentProject, onApprove, onReject }: Props) {
  const [feedback, setFeedback] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  const fetchDiff = async () => {
    if (!currentProject) return;
    setLoadingDiff(true);
    try {
      const gitDiff = await invoke<string>("get_git_diff", { cwd: currentProject });
      setDiff(gitDiff);
    } catch (e) {
      setDiff("Failed to fetch git diff: " + e);
    } finally {
      setLoadingDiff(false);
      setShowDiff(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-app-panel/90 backdrop-blur-md flex items-center justify-center p-6">
      <div className={`w-full ${showDiff ? 'max-w-5xl' : 'max-w-lg'} bg-app-panel border border-zinc-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col rounded-xl transition-all duration-300 max-h-[90vh]`}>
        <div className="px-6 py-5 border-b border-zinc-800/50 bg-zinc-900/50 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-amber-500 mb-1.5 flex items-center gap-2">
              <ShieldAlert size={14} /> HITL Approval Required
            </div>
            <h3 className="text-lg text-zinc-100 font-semibold leading-snug">
              Review <span className="text-brand-primary">{agentName}'s</span> work
            </h3>
            <p className="text-xs text-zinc-400 mt-1">This task was flagged with <code className="text-amber-500/70 bg-amber-500/10 px-1 py-0.5">&lt;!-- didi:requires_approval --&gt;</code>.</p>
          </div>
          {!showDiff && (
            <button 
              onClick={fetchDiff}
              disabled={loadingDiff || !currentProject}
              className="px-3 py-1.5 text-xs font-semibold bg-zinc-900/40 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/40 hover:text-white transition-colors flex items-center gap-2"
            >
              {loadingDiff ? <Loader2 size={14} className="animate-spin" /> : <FileDiff size={14} />}
              Review Changes
            </button>
          )}
        </div>
        
        <div className={`flex flex-1 min-h-0 ${showDiff ? 'flex-row' : 'flex-col'}`}>
          {showDiff && (
            <div className="flex-1 border-r border-zinc-800/50 flex flex-col min-w-0 bg-zinc-950/40">
              <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/30 text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                Git Diff (HEAD)
                <button onClick={() => setShowDiff(false)} className="hover:text-zinc-300"><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {diff || "No diff available."}
                </pre>
              </div>
            </div>
          )}

          <div className={`${showDiff ? 'w-80' : 'w-full'} p-6 space-y-4 shrink-0 flex flex-col bg-app-panel`}>
            <div className="flex-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Reject Feedback (Optional)</label>
              <textarea 
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={`Tell ${agentName} what to fix...`}
                className="mt-2 w-full h-32 bg-zinc-900/40 border border-zinc-800/50 focus:border-brand-accent text-zinc-200 px-3 py-2 text-sm outline-none resize-none rounded-xl shadow-inner"
              />
            </div>
            
            <div className={`flex flex-col gap-3 pt-2`}>
              <button 
                onClick={() => onReject(feedback)}
                className="w-full px-5 py-2.5 text-xs font-bold bg-zinc-900/40 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/40 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <X size={16} /> Reject & Return
              </button>
              <button 
                onClick={onApprove}
                className="w-full px-5 py-2.5 text-xs font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Check size={16} /> Approve & Forward
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
