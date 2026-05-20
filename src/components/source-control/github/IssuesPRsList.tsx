import { Search, ArrowRight, AlertCircle, Loader2, MessageCircle, GitMerge } from "lucide-react";
import type { GitHubIssue, GitHubPullRequest } from "../../../services/github-service";

export interface IssuesPRsListProps {
  activeTab: "issues" | "prs";
  searchTerm: string;
  onSearchChange: (v: string) => void;
  issues: GitHubIssue[];
  prs: GitHubPullRequest[];
  loading: boolean;
  loadingDetail: boolean;
  githubError: string | null;
  onOpenIssue: (issue: GitHubIssue) => void;
  onOpenPR: (pr: GitHubPullRequest) => void;
  onBack: () => void;
}

export function IssuesPRsList({
  activeTab, searchTerm, onSearchChange, issues, prs,
  loading, loadingDetail, githubError,
  onOpenIssue, onOpenPR, onBack,
}: IssuesPRsListProps) {
  return (
    <>
      <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-zinc-800/80 rounded transition-colors">
            <ArrowRight size={14} className="rotate-180 text-zinc-400" />
          </button>
          <h3 className="text-sm font-bold text-zinc-200 capitalize">GitHub {activeTab.replace("prs", "Pull Requests")}</h3>
          {githubError && (
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20 flex items-center gap-1">
              <AlertCircle size={12} /> {githubError}
            </span>
          )}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="bg-black/40 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-5xl mx-auto space-y-3">
          {loadingDetail && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-brand-accent" />
            </div>
          )}
          {!githubError && activeTab === "issues" && issues.length === 0 && !loading && (
            <div className="text-center text-zinc-500 py-12">No issues found for this repository.</div>
          )}
          {!githubError && activeTab === "prs" && prs.length === 0 && !loading && (
            <div className="text-center text-zinc-500 py-12">No pull requests found for this repository.</div>
          )}

          {activeTab === "issues" && issues.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase())).map(issue => (
            <div key={issue.number} className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/80 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all group cursor-pointer" onClick={() => onOpenIssue(issue)}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="text-sm font-bold text-zinc-200 group-hover:text-brand-accent transition-colors leading-tight">
                  {issue.title}
                </h4>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  issue.state === 'open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                  {issue.state}
                </span>
              </div>
              {issue.labels.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {issue.labels.map(l => (
                    <span key={l.name} className="text-[9px] px-1.5 py-0.5 rounded-md border border-zinc-800 font-medium" style={{ color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono">#{issue.number} opened on {new Date(issue.createdAt).toLocaleDateString()} by @{issue.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {issue.commentsCount}</span>
                </div>
              </div>
            </div>
          ))}

          {activeTab === "prs" && prs.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).map(pr => (
            <div key={pr.number} className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/80 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all group cursor-pointer" onClick={() => onOpenPR(pr)}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h4 className="text-sm font-bold text-zinc-200 group-hover:text-brand-accent transition-colors leading-tight">
                  {pr.title}
                </h4>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  pr.state === 'open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                }`}>
                  {pr.isDraft ? 'DRAFT' : pr.state}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <GitMerge size={10} /> {pr.branchRef}
                </span>
                {pr.labels.map(l => (
                  <span key={l.name} className="text-[9px] px-1.5 py-0.5 rounded-md border border-zinc-800 font-medium" style={{ color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                    {l.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono">#{pr.number} opened on {new Date(pr.createdAt).toLocaleDateString()} by @{pr.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {pr.commentsCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
