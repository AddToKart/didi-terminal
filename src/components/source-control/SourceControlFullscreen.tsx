import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch, X, RefreshCw, Plus, Minus, RotateCcw, Upload, Download,
  Check, Loader2, GitMerge, AlertCircle, FileText,
  GitPullRequest, GitCommit, LayoutDashboard, Search, Clock, ShieldAlert,
  Trash2, ExternalLink, MessageCircle, GitFork, ArrowRight, Globe
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { 
  fetchGitHubIssues, 
  fetchGitHubPullRequests, 
  parseGitHubRemote, 
  GitHubIssue, 
  GitHubPullRequest 
} from "../../services/github-service";

// --- Types ---

interface GitPanelFile {
  path: string;
  status: string;
  statusLabel: string;
}

interface GitPanelStatus {
  branch: string;
  remote: string;
  staged: GitPanelFile[];
  unstaged: GitPanelFile[];
}

interface GitCommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
  date: string;
}

interface SourceControlFullscreenProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// --- Helpers ---

function StatusIcon({ status }: { status: string }) {
  const s = status.trim();
  if (s === "M") return <span className="text-amber-500 text-[10px] font-black w-3 text-center" title="Modified">M</span>;
  if (s === "A") return <span className="text-emerald-500 text-[10px] font-black w-3 text-center" title="Added">A</span>;
  if (s === "D") return <span className="text-red-500 text-[10px] font-black w-3 text-center" title="Deleted">D</span>;
  if (s === "R") return <span className="text-blue-500 text-[10px] font-black w-3 text-center" title="Renamed">R</span>;
  if (s === "??") return <span className="text-zinc-500 text-[10px] font-black w-3 text-center" title="Untracked">U</span>;
  if (s === "U") return <AlertCircle size={10} className="text-orange-500" />;
  return <div className="w-3" />;
}

function RefBadge({ refs }: { refs: string }) {
  if (!refs) return null;
  const rawParts = refs.split(",").map(r => r.trim()).filter(Boolean);
  const uniqueRefs = new Map<string, { original: string, clean: string }>();

  rawParts.forEach(r => {
    const clean = r.replace("HEAD -> ", "").replace("origin/", "").trim();
    if (!uniqueRefs.has(clean)) {
      uniqueRefs.set(clean, { original: r, clean });
    } else if (r.includes("HEAD")) {
      uniqueRefs.set(clean, { original: r, clean });
    }
  });

  const partsToRender = Array.from(uniqueRefs.values()).slice(0, 3);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {partsToRender.map((refData, i) => {
        const isHead = refData.original.includes("HEAD");
        const isOrigin = refData.original.includes("origin");
        const isMain = refData.original.includes("main") || refData.original.includes("master");      

        let bg = "bg-zinc-800/50 text-zinc-400";
        if (isHead) bg = "bg-brand-accent/20 text-brand-accent border-brand-accent/20";
        else if (isOrigin && isMain) bg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"; 
        else if (isOrigin) bg = "bg-blue-500/10 text-blue-400 border-blue-500/20";

        return (
          <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border border-transparent ${bg}`}>
            {refData.clean}
          </span>
        );
      })}
    </div>
  );
}

// --- Component ---

export function SourceControlFullscreen({ currentProject, isOpen, onClose }: SourceControlFullscreenProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "graph" | "branches" | "issues" | "prs">("overview"); 

  // Git State
  const [status, setStatus] = useState<GitPanelStatus | null>(null);
  const [log, setLog] = useState<GitCommitEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // GitHub State
  const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([]);
  const [githubPRs, setGithubPRs] = useState<GitHubPullRequest[]>([]);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Search state for non-overview tabs
  const [searchTerm, setSearchTerm] = useState("");
  const [newBranchName, setNewBranchName] = useState("");

  const flash = (text: string, ok = true) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3500);
  };

  const refresh = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    setGithubError(null);
    try {
      const [s, l, b] = await Promise.all([
        invoke<GitPanelStatus>("git_panel_get_status", { cwd: currentProject }),
        invoke<GitCommitEntry[]>("git_panel_get_log", { cwd: currentProject, limit: 100 }),
        invoke<GitBranchInfo[]>("git_panel_get_branches", { cwd: currentProject }),
      ]);
      setStatus(s);
      setLog(l);
      setBranches(b);

      // Attempt to load GitHub data if we have an origin remote
      if (s.remote) {
        const repoInfo = parseGitHubRemote(s.remote);
        if (repoInfo) {
          try {
            const [issues, prs] = await Promise.all([
              fetchGitHubIssues(repoInfo.owner, repoInfo.repo),
              fetchGitHubPullRequests(repoInfo.owner, repoInfo.repo)
            ]);
            setGithubIssues(issues);
            setGithubPRs(prs);
          } catch (ghErr: any) {
            setGithubError(ghErr.message || "Failed to load GitHub data.");
          }
        }
      }

    } catch (e) {
      flash(String(e), false);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (isOpen && currentProject) {
      refresh();
      // Polling for live updates
      const id = setInterval(refresh, 10000);
      return () => clearInterval(id);
    }
  }, [isOpen, currentProject, refresh]);

  if (!isOpen) return null;

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      const msg = await fn();
      flash(msg);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setBusy(null);
      await refresh();
    }
  };

  const stage = (path: string) => run("stage:" + path, () => invoke("git_panel_stage", { cwd: currentProject!, path }));
  const stageAll = () => run("stageAll", () => invoke("git_panel_stage_all", { cwd: currentProject! }));
  const unstage = (path: string) => run("unstage:" + path, () => invoke("git_panel_unstage", { cwd: currentProject!, path }));
  const discard = (path: string) => run("discard:" + path, () => invoke("git_panel_discard", { cwd: currentProject!, path }));
  const commit = () => run("commit", async () => {
    const r: string = await invoke("git_panel_commit", { cwd: currentProject!, message: commitMsg }); 
    setCommitMsg("");
    return r;
  });
  const pull = () => run("pull", () => invoke("git_panel_pull", { cwd: currentProject! }));
  const push = () => run("push", () => invoke("git_panel_push", { cwd: currentProject! }));

  const switchBranch = (branch: string) => run("switch:" + branch, () => invoke("git_panel_switch_branch", { cwd: currentProject!, branch }));
  const createBranch = () => run("createBranch", async () => {
    if (!newBranchName.trim()) throw new Error("Branch name required");
    const res: string = await invoke("git_panel_create_branch", { cwd: currentProject!, branch: newBranchName.trim() });
    setNewBranchName("");
    return res;
  });
  const deleteBranch = (branch: string) => run("delete:" + branch, () => invoke("git_panel_delete_branch", { cwd: currentProject!, branch }));
  const mergeBranch = (branch: string) => run("merge:" + branch, () => invoke("git_panel_merge_branch", { cwd: currentProject!, branch }));

  const TABS = [
    { id: "overview", label: "Working Tree", icon: LayoutDashboard },
    { id: "graph", label: "Commit Graph", icon: GitCommit },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "prs", label: "Pull Requests", icon: GitPullRequest },
    { id: "issues", label: "Issues", icon: FileText },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#0e0e11] border border-white/10 rounded-2xl shadow-[0_0_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden w-full max-w-[1400px] h-[90vh] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">

          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-zinc-100">
                <Globe size={20} className="text-white" />
                <h2 className="text-sm font-bold tracking-wide">Git Center</h2>
                {status && (
                  <span className="text-xs font-mono text-zinc-400 bg-white/5 px-2 py-1 rounded-md border border-white/5 ml-2">    
                    {currentProject?.split(/[\\/]/).pop()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={loading} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-zinc-300 hover:text-white transition-all text-xs flex items-center gap-2 disabled:opacity-50">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={onClose} className="p-1.5 bg-white/5 hover:bg-red-500/20 border border-white/5 rounded-lg text-zinc-400 hover:text-red-400 transition-all">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Action Flash */}
          {actionMsg && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50">
              <div className={`px-4 py-2 rounded-xl text-xs font-bold border shadow-lg flex items-center gap-2 ${
                actionMsg.ok ? "bg-emerald-950/90 text-emerald-400 border-emerald-500/20" : "bg-red-950/90 text-red-400 border-red-500/20"
              }`}>
                {actionMsg.ok ? <Check size={14} /> : <ShieldAlert size={14} />}
                {actionMsg.text}
              </div>
            </div>
          )}

          {/* Main Layout: Sidebar + Content */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Sidebar Navigation */}
            <div className="w-56 border-r border-white/5 bg-black/40 flex flex-col p-3 gap-1 shrink-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2 px-2 pt-2">Views</div>
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                // Calculate counts for badges
                let badgeCount = 0;
                if (tab.id === 'overview' && status) badgeCount = status.staged.length + status.unstaged.length;
                if (tab.id === 'prs') badgeCount = githubPRs.filter(pr => pr.state === 'open').length;
                if (tab.id === 'issues') badgeCount = githubIssues.filter(i => i.state === 'open').length;

                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setSearchTerm(""); }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/20" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} />
                      {tab.label}
                    </div>
                    {badgeCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-brand-accent/20' : 'bg-white/10'}`}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Status Indicator */}
              <div className="mt-auto p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Current Branch</div>
                <div className="flex items-center gap-2 text-sm text-brand-accent font-mono">
                  <GitBranch size={14} />
                  <span className="truncate">{status?.branch || "..."}</span>
                </div>
                {status?.remote && (
                  <div className="text-[10px] text-zinc-500 font-mono truncate pt-2 border-t border-white/5 mt-2">
                    {parseGitHubRemote(status.remote)?.owner}/{parseGitHubRemote(status.remote)?.repo}
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0b0b0d]">
              
              {/* --- OVERVIEW TAB --- */}
              {activeTab === "overview" && (
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Working Tree */}
                  <div className="flex-[3] border-r border-white/5 flex flex-col min-w-0">
                    <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-zinc-200">Working Tree</h3>
                      {status && status.unstaged.length > 0 && (
                        <button onClick={stageAll} className="px-3 py-1 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/20 rounded-md text-xs font-bold transition-all flex items-center gap-1">
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
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                            {status.staged.map(f => (
                              <div key={f.path} className="flex items-center justify-between p-2.5 border-b border-white/5 hover:bg-white/5 group">
                                <div className="flex items-center gap-3 min-w-0">
                                  <StatusIcon status={f.status} />
                                  <FileIcon filename={f.path.split("/").pop()!} size={16} />
                                  <span className="text-xs text-zinc-300 truncate font-mono">{f.path}</span>      
                                </div>
                                <button onClick={() => unstage(f.path)} className="opacity-0 group-hover:opacity-100 p-1 bg-white/10 hover:bg-white/20 text-zinc-400 rounded transition-all" title="Unstage">
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
                          <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                            {status.unstaged.map(f => (
                              <div key={f.path} className="flex items-center justify-between p-2.5 border-b border-white/5 hover:bg-white/5 group">
                                <div className="flex items-center gap-3 min-w-0">
                                  <StatusIcon status={f.status} />
                                  <FileIcon filename={f.path.split("/").pop()!} size={16} />
                                  <span className="text-xs text-zinc-400 truncate font-mono">{f.path}</span>    
                                </div>
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => discard(f.path)} className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-all" title="Discard">
                                    <RotateCcw size={14} />
                                  </button>
                                  <button onClick={() => stage(f.path)} className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded transition-all" title="Stage">
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {status && status.staged.length === 0 && status.unstaged.length === 0 && (
                        <div className="h-32 flex flex-col items-center justify-center text-zinc-600 gap-2 border border-dashed border-white/10 rounded-xl">
                          <Check size={24} />
                          <span className="text-xs font-mono">Working tree clean</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Commit & Actions */}
                  <div className="flex-[2] flex flex-col min-w-0 bg-black/20">
                    <div className="p-5 border-b border-white/5 space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Create Commit</div>
                      <textarea
                        value={commitMsg}
                        onChange={e => setCommitMsg(e.target.value)}
                        placeholder="Commit message... (Ctrl+Enter)"
                        onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) commit(); }}
                        rows={3}
                        className="w-full resize-none bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all font-mono"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={commit}
                          disabled={!commitMsg.trim() || !!busy || status?.staged.length === 0}
                          className="flex-[2] flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent/80 text-black text-xs font-bold py-2 rounded-lg transition-all disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
                        >
                          {busy === "commit" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Commit
                        </button>
                        <button onClick={pull} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
                          {busy === "pull" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Pull
                        </button>
                        <button onClick={push} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
                          {busy === "push" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Push
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <div className="px-5 py-3 bg-white/[0.02] border-b border-white/5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Recent Commits</h3>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                        {log.slice(0, 5).map(entry => (
                          <div key={entry.hash} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
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
              )}

              {/* --- GRAPH TAB --- */}
              {activeTab === "graph" && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-zinc-200">Commit Timeline</h3>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search commits..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8">
                    <div className="relative max-w-4xl mx-auto">
                      {/* Vertical line connecting commits */}
                      <div className="absolute left-[27px] top-4 bottom-4 w-px bg-white/10" />
                      
                      {log.filter(l => l.message.toLowerCase().includes(searchTerm.toLowerCase())).map((entry, idx) => (
                        <div key={entry.hash} className="relative flex items-start gap-6 mb-6 group">
                          {/* Node */}
                          <div className="relative z-10 w-14 flex justify-center shrink-0 mt-1">
                            <div className={`w-3 h-3 rounded-full border-2 border-zinc-950 ${idx === 0 ? 'bg-brand-accent ring-4 ring-brand-accent/20' : 'bg-zinc-500 group-hover:bg-zinc-300'} transition-all`} />
                          </div>
                          {/* Card */}
                          <div className="flex-1 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-bold text-zinc-100">{entry.message}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <RefBadge refs={entry.refs} />
                                <span className="text-xs font-mono text-zinc-500 bg-black/40 px-2 py-0.5 rounded border border-white/5">{entry.shortHash}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1.5 text-zinc-400">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[8px] text-white font-bold">
                                  {entry.author.charAt(0).toUpperCase()}
                                </div>
                                {entry.author}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {entry.date}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- BRANCHES TAB --- */}
              {activeTab === "branches" && (
                <div className="flex-1 flex flex-col overflow-hidden p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Branch Management</h3>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder="Search branches..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
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
                        onChange={e => setNewBranchName(e.target.value)}
                        placeholder="feature/new-idea"
                        className="bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-brand-accent/50 outline-none w-full font-mono transition-all"
                        onKeyDown={e => { if (e.key === 'Enter') createBranch(); }}
                      />
                      <button
                        onClick={createBranch}
                        disabled={!newBranchName.trim() || !!busy}
                        className="w-full py-2.5 bg-brand-accent text-black rounded-xl text-xs font-bold disabled:opacity-50 transition-all active:scale-[0.98]"
                      >
                        Checkout New Branch
                      </button>
                    </div>

                    {/* Branch List */}
                    {branches.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                      <div key={b.name} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all flex flex-col group">
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

                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                          <div className="text-[10px] text-zinc-600 font-mono">{b.date}</div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!b.isCurrent && (
                              <>
                                <button onClick={() => mergeBranch(b.name)} className="p-2 bg-white/5 hover:bg-indigo-500/20 text-zinc-400 hover:text-indigo-400 rounded-lg transition-colors" title="Merge into current">
                                  <GitMerge size={14} />
                                </button>
                                <button onClick={() => deleteBranch(b.name)} className="p-2 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors mr-1" title="Delete Branch">
                                  <Trash2 size={14} />
                                </button>
                                <button onClick={() => switchBranch(b.name)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1">
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
              )}

              {/* --- GITHUB TABS (Issues / PRs) --- */}
              {(activeTab === "issues" || activeTab === "prs") && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-3">
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
                        onChange={e => setSearchTerm(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-5xl mx-auto space-y-3">
                      {/* Empty States */}
                      {!githubError && activeTab === "issues" && githubIssues.length === 0 && !loading && (
                        <div className="text-center text-zinc-500 py-12">No issues found for this repository.</div>
                      )}
                      {!githubError && activeTab === "prs" && githubPRs.length === 0 && !loading && (
                        <div className="text-center text-zinc-500 py-12">No pull requests found for this repository.</div>
                      )}

                      {/* Issue List */}
                      {activeTab === "issues" && githubIssues.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase())).map(issue => (
                        <a href={issue.url} target="_blank" rel="noreferrer" key={issue.number} className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group">
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
                                <span key={l.name} className="text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 font-medium" style={{ color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                                  {l.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span className="font-mono">#{issue.number} opened on {new Date(issue.createdAt).toLocaleDateString()} by @{issue.author}</span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1"><MessageCircle size={12} /> {issue.commentsCount}</span>
                              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </a>
                      ))}

                      {/* PR List */}
                      {activeTab === "prs" && githubPRs.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).map(pr => (
                        <a href={pr.url} target="_blank" rel="noreferrer" key={pr.number} className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all group">
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
                              <span key={l.name} className="text-[9px] px-1.5 py-0.5 rounded-md border border-white/10 font-medium" style={{ color: `#${l.color}`, backgroundColor: `#${l.color}15` }}>
                                {l.name}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span className="font-mono">#{pr.number} opened on {new Date(pr.createdAt).toLocaleDateString()} by @{pr.author}</span>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1"><MessageCircle size={12} /> {pr.commentsCount}</span>
                              <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </a>
                      ))}

                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}