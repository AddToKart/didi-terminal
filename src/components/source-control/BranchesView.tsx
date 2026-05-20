import { Search, GitBranch, GitFork, GitMerge, Trash2, ArrowRight } from "lucide-react";
import { GitBranchInfo } from "./source-control-types";

export interface BranchesViewProps {
  branches: GitBranchInfo[];
  searchTerm: string;
  onSearchChange: (v: string) => void;
  newBranchName: string;
  onNewBranchNameChange: (v: string) => void;
  onCreateBranch: () => void;
  onSwitch: (branch: string) => void;
  onDelete: (branch: string) => void;
  onMerge: (branch: string) => void;
  busy: string | null;
}

export function BranchesView({
  branches, searchTerm, onSearchChange,
  newBranchName, onNewBranchNameChange, onCreateBranch,
  onSwitch, onDelete, onMerge, busy,
}: BranchesViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Branch Management</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search branches..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="bg-black/40 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-6">
        {/* Create Branch Card */}
        <div className="p-5 rounded-2xl bg-brand-accent/5 border border-brand-accent/20 flex flex-col gap-4 shadow-lg shadow-brand-accent/5">
          <div className="flex items-center gap-2 text-brand-accent font-bold">
            <GitFork size={16} />
            <span>Create New Branch</span>
          </div>
          <input
            value={newBranchName}
            onChange={e => onNewBranchNameChange(e.target.value)}
            placeholder="feature/new-idea"
            className="bg-black/40 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-brand-accent/50 outline-none w-full font-mono transition-all"
            onKeyDown={e => { if (e.key === 'Enter') onCreateBranch(); }}
          />
          <button
            onClick={onCreateBranch}
            disabled={!newBranchName.trim() || !!busy}
            className="w-full py-2.5 bg-brand-accent text-black rounded-xl text-xs font-bold disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            Checkout New Branch
          </button>
        </div>

        {/* Branch List */}
        {branches.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
          <div key={b.name} className="p-5 rounded-2xl bg-zinc-900/20 border border-zinc-800/80 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all flex flex-col group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch size={16} className={b.isCurrent ? "text-brand-accent" : "text-zinc-500 shrink-0"} />
                <span className={`font-mono text-sm truncate ${b.isCurrent ? "text-white font-bold" : "text-zinc-300"}`}>{b.name}</span>
              </div>
              {b.isCurrent && <span className="shrink-0 text-[9px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-brand-accent/20">Active</span>}
            </div>

            <div className="text-xs text-zinc-500 mb-4 line-clamp-2">
              {b.lastCommit || "No commit history"}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800/80">
              <div className="text-[10px] text-zinc-600 font-mono">{b.date}</div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!b.isCurrent && (
                  <>
                    <button onClick={() => onMerge(b.name)} className="p-2 bg-zinc-900/60 hover:bg-indigo-500/20 text-zinc-400 hover:text-indigo-400 rounded-lg transition-colors" title="Merge into current">
                      <GitMerge size={14} />
                    </button>
                    <button onClick={() => onDelete(b.name)} className="p-2 bg-zinc-900/60 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors mr-1" title="Delete Branch">
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => onSwitch(b.name)} className="px-3 py-1.5 bg-zinc-800/80 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1">
                      Switch <ArrowRight size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
