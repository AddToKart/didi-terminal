import {
  Plus, Minus, RotateCcw, Check, Loader2, Download, Upload
} from "lucide-react";
import { FileIcon } from "../FileIcon";
import { StatusIcon, GitPanelStatus, GitCommitEntry } from "../source-control-types";

export interface OverviewViewProps {
  status: GitPanelStatus | null;
  log: GitCommitEntry[];
  commitMsg: string;
  onCommitMsgChange: (v: string) => void;
  onCommit: () => void;
  onPull: () => void;
  onPush: () => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onDiscard: (path: string) => void;
  onStageAll: () => void;
  busy: string | null;
}

export function OverviewView({
  status, log, commitMsg, onCommitMsgChange,
  onCommit, onPull, onPush, onStage, onUnstage, onDiscard, onStageAll, busy,
}: OverviewViewProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Working Tree */}
      <div className="flex-[3] border-r border-zinc-800/80 flex flex-col min-w-0">
        <div className="px-5 py-3 bg-zinc-900/20 border-b border-zinc-800/80 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-200">Working Tree</h3>
          {status && status.unstaged.length > 0 && (
            <button onClick={onStageAll} className="px-3 py-1 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/20 rounded-md text-xs font-bold transition-all flex items-center gap-1">
              <Plus size={12} /> Stage All
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          {/* Staged */}
          {status && status.staged.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2 px-2 flex items-center justify-between">
                Staged Changes
                <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded">{status.staged.length}</span>
              </div>
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                {status.staged.map(f => (
                  <div key={f.path} className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 hover:bg-zinc-900/60 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon status={f.status} />
                      <FileIcon filename={f.path.split("/").pop()!} size={16} />
                      <span className="text-xs text-zinc-300 truncate font-mono">{f.path}</span>
                    </div>
                    <button onClick={() => onUnstage(f.path)} className="opacity-0 group-hover:opacity-100 p-1 bg-zinc-800/80 hover:bg-white/20 text-zinc-400 rounded transition-all" title="Unstage">
                      <Minus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unstaged */}
          {status && status.unstaged.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 px-2 flex items-center justify-between">
                Unstaged Changes
                <span className="bg-amber-500/10 px-1.5 py-0.5 rounded">{status.unstaged.length}</span>
              </div>
              <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                {status.unstaged.map(f => (
                  <div key={f.path} className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 hover:bg-zinc-900/60 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon status={f.status} />
                      <FileIcon filename={f.path.split("/").pop()!} size={16} />
                      <span className="text-xs text-zinc-400 truncate font-mono">{f.path}</span>
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => onDiscard(f.path)} className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-all" title="Discard">
                        <RotateCcw size={14} />
                      </button>
                      <button onClick={() => onStage(f.path)} className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all" title="Stage">
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {status && status.staged.length === 0 && status.unstaged.length === 0 && (
            <div className="h-32 flex flex-col items-center justify-center text-zinc-600 gap-2 border border-dashed border-zinc-800 rounded-xl">
              <Check size={24} />
              <span className="text-xs font-mono">Working tree clean</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Commit & Actions */}
      <div className="flex-[2] flex flex-col min-w-0 bg-black/20">
        <div className="p-5 border-b border-zinc-800/80 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Create Commit</div>
          <textarea
            value={commitMsg}
            onChange={e => onCommitMsgChange(e.target.value)}
            placeholder="Commit message... (Ctrl+Enter)"
            onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) onCommit(); }}
            rows={3}
            className="w-full resize-none bg-black/60 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all font-mono"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onCommit}
              disabled={!commitMsg.trim() || !!busy || (status?.staged.length === 0)}
              className="flex-[2] flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent/80 text-black text-xs font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {busy === "commit" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Commit
            </button>
            <button onClick={onPull} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
              {busy === "pull" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Pull
            </button>
            <button onClick={onPush} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
              {busy === "push" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Push
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-5 py-3 bg-zinc-900/20 border-b border-zinc-800/80">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recent Commits</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {log.slice(0, 5).map(entry => (
              <div key={entry.hash} className="p-3 bg-zinc-900/20 border border-zinc-800/80 rounded-xl">
                <p className="text-sm font-medium text-zinc-200 mb-2 truncate">{entry.message}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{entry.author}</span>
                  <span className="text-brand-accent/80 font-mono">{entry.shortHash}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
