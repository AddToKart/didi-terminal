import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch, X, RefreshCw, Plus, Minus, RotateCcw, Upload, Download,
  Check, Loader2, GitMerge, AlertCircle, FileText,
  GitPullRequest, GitCommit, LayoutDashboard, Search, Clock, ShieldAlert,
  ChevronRight, Trash2
} from "lucide-react";
import { FileIcon } from "./FileIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ISSUES = [
  { id: 1, title: "Refactor PortManager for better performance", state: "open", author: "Cay", date: "2 hrs ago", labels: ["enhancement"] },
  { id: 2, title: "Fix TS compilation errors in FileIcon", state: "closed", author: "Antigravity", date: "yesterday", labels: ["bug"] },
  { id: 3, title: "Implement new dashboard widget system", state: "open", author: "Cay", date: "3 days ago", labels: ["feature", "ui"] },
];

const MOCK_PRS = [
  { id: 12, title: "feat: Add Source Control Fullscreen Mode", state: "open", author: "Antigravity", date: "1 hr ago", branches: "feat/source-control-full -> main" },
  { id: 10, title: "fix: Resolve layout shifting on startup", state: "merged", author: "Cay", date: "2 days ago", branches: "fix/layout-shift -> main" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Components ────────────────────────────────────────────────────────────────

export function SourceControlFullscreen({ currentProject, isOpen, onClose }: SourceControlFullscreenProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "branches" | "issues" | "prs">("overview");
  
  // Git State
  const [status, setStatus] = useState<GitPanelStatus | null>(null);
  const [log, setLog] = useState<GitCommitEntry[]>([]);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  
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
    try {
      const [s, l, b] = await Promise.all([
        invoke<GitPanelStatus>("git_panel_get_status", { cwd: currentProject }),
        invoke<GitCommitEntry[]>("git_panel_get_log", { cwd: currentProject, limit: 50 }),
        invoke<GitBranchInfo[]>("git_panel_get_branches", { cwd: currentProject }),
      ]);
      setStatus(s);
      setLog(l);
      setBranches(b);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (isOpen && currentProject) {
      refresh();
      const id = setInterval(refresh, 6000);
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
    { id: "overview", label: "Changes & History", icon: LayoutDashboard },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "issues", label: "Issues", icon: FileText },
    { id: "prs", label: "Pull Requests", icon: GitPullRequest },
  ] as const;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-8 pointer-events-none">
        <div className="bg-zinc-950/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_0_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden w-full max-w-6xl h-[85vh] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
          
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-accent/10 rounded-xl text-brand-accent border border-brand-accent/20">
                  <GitMerge size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Source Control Center</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {status && (
                      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                        <GitBranch size={12} className="text-brand-accent/70" />
                        {status.branch}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-px h-8 bg-white/10 mx-2" />

              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive 
                          ? "bg-white/10 text-white shadow-sm" 
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      <Icon size={16} className={isActive ? "text-brand-accent" : ""} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={refresh}
                disabled={loading}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              </button>
              <button 
                onClick={onClose}
                className="p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl text-zinc-400 hover:text-red-400 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Action Flash */}
          {actionMsg && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50">
              <div className={`px-4 py-2 rounded-xl text-sm font-medium border shadow-lg flex items-center gap-2 ${
                actionMsg.ok 
                  ? "bg-emerald-950/90 text-emerald-400 border-emerald-500/20" 
                  : "bg-red-950/90 text-red-400 border-red-500/20"
              }`}>
                {actionMsg.ok ? <Check size={16} /> : <ShieldAlert size={16} />}
                {actionMsg.text}
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden bg-black/20 flex relative">
            
            {/* ── Overview Tab ── */}
            {activeTab === "overview" && (
              <div className="flex w-full h-full">
                {/* Left Column: Staging & Committing */}
                <div className="w-[450px] border-r border-white/5 flex flex-col bg-white/[0.01]">
                  {/* Commit Box */}
                  <div className="p-5 border-b border-white/5">
                    <textarea
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      placeholder="Commit message (Ctrl+Enter)"
                      onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) commit(); }}
                      rows={4}
                      className="w-full resize-none bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-2 focus:ring-brand-accent/20 transition-all font-mono"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={commit}
                        disabled={!commitMsg.trim() || !!busy}
                        className="flex-1 flex items-center justify-center gap-2 bg-brand-accent/90 hover:bg-brand-accent disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-[0.98]"
                      >
                        {busy === "commit" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                        Commit Changes
                      </button>
                      <button
                        onClick={pull}
                        disabled={!!busy}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-xl transition-all disabled:opacity-40"
                        title="Pull"
                      >
                        {busy === "pull" ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      </button>
                      <button
                        onClick={push}
                        disabled={!!busy}
                        className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 rounded-xl transition-all disabled:opacity-40"
                        title="Push"
                      >
                        {busy === "push" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* File Lists */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                    {/* Staged */}
                    {status && status.staged.length > 0 && (
                      <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Staged Changes</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">{status.staged.length}</span>
                            <button onClick={() => status.staged.forEach(f => unstage(f.path))} className="text-zinc-500 hover:text-zinc-300"><Minus size={14} /></button>
                          </div>
                        </div>
                        <div className="p-1.5">
                          {status.staged.map(f => (
                            <div key={f.path} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg group">
                              <div className="flex items-center gap-3 truncate">
                                <StatusIcon status={f.status} />
                                <FileIcon filename={f.path.split("/").pop()!} size={16} />
                                <span className="text-sm text-zinc-300 truncate">{f.path}</span>
                              </div>
                              <button onClick={() => unstage(f.path)} className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-white hover:bg-white/10 rounded-md">
                                <Minus size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unstaged */}
                    {status && (
                      <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Changes</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full">{status.unstaged.length}</span>
                            {status.unstaged.length > 0 && (
                              <button onClick={stageAll} className="text-zinc-500 hover:text-brand-accent"><Plus size={14} /></button>
                            )}
                          </div>
                        </div>
                        <div className="p-1.5">
                          {status.unstaged.length === 0 ? (
                            <p className="text-xs text-zinc-500 p-4 text-center">Working tree clean</p>
                          ) : (
                            status.unstaged.map(f => (
                              <div key={f.path} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg group">
                                <div className="flex items-center gap-3 truncate">
                                  <StatusIcon status={f.status} />
                                  <FileIcon filename={f.path.split("/").pop()!} size={16} />
                                  <span className="text-sm text-zinc-300 truncate">{f.path}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                  <button onClick={() => discard(f.path)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md">
                                    <RotateCcw size={14} />
                                  </button>
                                  <button onClick={() => stage(f.path)} className="p-1.5 text-zinc-500 hover:text-brand-accent hover:bg-brand-accent/10 rounded-md">
                                    <Plus size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: History */}
                <div className="flex-1 flex flex-col bg-white/[0.01]">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Commit History</h3>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Search commits..." 
                        className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:border-brand-accent/50 outline-none w-64"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                      {log.map(entry => (
                        <div key={entry.hash} className="relative flex items-start justify-between md:justify-normal md:odd:flex-row-reverse group is-active mb-8">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-zinc-950 bg-white/10 group-hover:bg-brand-accent transition-colors text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:border-white/10 transition-all hover:shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-brand-accent/80 bg-brand-accent/10 px-2 py-0.5 rounded-md">{entry.shortHash}</span>
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <Clock size={12} />
                                {entry.date}
                              </div>
                            </div>
                            <p className="text-sm font-medium text-zinc-200 mb-3">{entry.message}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-brand-accent to-purple-500 flex items-center justify-center text-[8px] text-white font-bold">
                                  {entry.author.charAt(0).toUpperCase()}
                                </div>
                                {entry.author}
                              </span>
                              <RefBadge refs={entry.refs} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Mocked Tabs (Branches, Issues, PRs) ── */}
            {activeTab !== "overview" && (
              <div className="flex flex-col w-full h-full p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-white capitalize">{activeTab}</h3>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder={`Search ${activeTab}...`} 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-brand-accent/50 outline-none w-80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Branches Tab */}
                  {activeTab === "branches" && (
                    <>
                      {/* Create Branch Card */}
                      <div className="p-5 rounded-2xl bg-brand-accent/5 border border-brand-accent/20 flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-brand-accent font-semibold">
                          <Plus size={16} />
                          <span>Create New Branch</span>
                        </div>
                        <input
                          value={newBranchName}
                          onChange={e => setNewBranchName(e.target.value)}
                          placeholder="new-feature-name"
                          className="bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:border-brand-accent/50 outline-none w-full font-mono transition-all"
                          onKeyDown={e => { if (e.key === 'Enter') createBranch(); }}
                        />
                        <button
                          onClick={createBranch}
                          disabled={!newBranchName.trim() || !!busy}
                          className="w-full py-2.5 bg-brand-accent/90 hover:bg-brand-accent text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98]"
                        >
                          Create Branch
                        </button>
                      </div>

                      {/* Branch List */}
                      {branches.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                        <div key={b.name} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all flex flex-col gap-4 group">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GitBranch size={16} className={b.isCurrent ? "text-brand-accent" : "text-zinc-500"} />
                              <span className={`font-semibold ${b.isCurrent ? "text-white" : "text-zinc-300"}`}>{b.name}</span>
                            </div>
                            {b.isCurrent && <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Current</span>}
                          </div>
                          
                          <div className="text-xs text-zinc-500 flex items-center gap-2 line-clamp-1">
                            <GitCommit size={14} />
                            {b.lastCommit || "No commits yet"}
                          </div>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                            <div className="text-xs text-zinc-600">{b.date}</div>
                            
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!b.isCurrent && (
                                <>
                                  <button onClick={() => deleteBranch(b.name)} className="p-2 bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors" title="Delete Branch">
                                    <Trash2 size={14} />
                                  </button>
                                  <button onClick={() => mergeBranch(b.name)} className="p-2 bg-white/5 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 rounded-lg transition-colors" title="Merge into current">
                                    <GitMerge size={14} />
                                  </button>
                                  <button onClick={() => switchBranch(b.name)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors">
                                    Checkout
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Mock Issues */}
                  {activeTab === "issues" && (
                    <div className="col-span-full mb-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-4 text-blue-400">
                      <FileText size={24} />
                      <div>
                        <h4 className="font-semibold text-sm">GitHub Integration Required</h4>
                        <p className="text-xs opacity-80 mt-0.5">Connect your GitHub account to manage Issues directly from DidiTerminal. (Coming soon)</p>
                      </div>
                    </div>
                  )}
                  {activeTab === "issues" && MOCK_ISSUES.map(issue => (
                    <div key={issue.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-semibold text-zinc-200 text-sm">{issue.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${issue.state === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                          {issue.state}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {issue.labels.map(l => (
                          <span key={l} className="text-[10px] bg-white/5 text-zinc-400 px-2 py-0.5 rounded-md border border-white/5">
                            {l}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 mt-auto pt-4 border-t border-white/5">
                        <span>#{issue.id} opened by {issue.author}</span>
                        <span>{issue.date}</span>
                      </div>
                    </div>
                  ))}

                  {/* Mock PRs */}
                  {activeTab === "prs" && (
                    <div className="col-span-full mb-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-4 text-blue-400">
                      <GitPullRequest size={24} />
                      <div>
                        <h4 className="font-semibold text-sm">GitHub Integration Required</h4>
                        <p className="text-xs opacity-80 mt-0.5">Connect your GitHub account to create and manage Pull Requests. (Coming soon)</p>
                      </div>
                    </div>
                  )}
                  {activeTab === "prs" && MOCK_PRS.map(pr => (
                    <div key={pr.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <span className="font-semibold text-zinc-200 text-sm">{pr.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${pr.state === 'open' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {pr.state}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-zinc-400 bg-black/40 p-2 rounded-lg border border-white/5">
                        {pr.branches}
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 mt-auto pt-4 border-t border-white/5">
                        <span>#{pr.id} by {pr.author}</span>
                        <span>{pr.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer Bar */}
          <div className="p-4 px-6 bg-zinc-950 border-t border-white/5 flex justify-between items-center z-10 shrink-0">
             <div className="flex items-center gap-4 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                Didi Source Control Core
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
