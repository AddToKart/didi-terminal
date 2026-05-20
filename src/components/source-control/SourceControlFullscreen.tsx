import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch, X, RefreshCw, Check,
  GitPullRequest, GitCommit, LayoutDashboard, FileText,
  ShieldAlert, Globe
} from "lucide-react";
import { eventBus } from "../../services/event-bus";
import {
  fetchGitHubIssues,
  fetchGitHubPullRequests,
  parseGitHubRemote,
  GitHubIssue,
  GitHubPullRequest,
  IssueDetail,
  PRDetail,
  fetchIssueDetail,
  fetchPRDetail,
  createGitHubIssueComment,
  mergePR,
  updateIssueState,
  updatePRState,
  createPRReview,
  addIssueLabel,
  removeIssueLabel,
  fetchRepoLabels,
  editIssueTitle,
  editIssueBody,
  editPRTitle,
  editPRBody,
} from "../../services/github-service";
import type { GitPanelStatus, GitCommitEntry, GitBranchInfo, GitCommitFile } from "./source-control-types";
import { OverviewView } from "./working-tree/OverviewView";
import { GraphView } from "./GraphView";
import { BranchesView } from "./BranchesView";
import { IssuesPRsList } from "./github/IssuesPRsList";
import { IssueDetailView } from "./github/IssueDetailView";
import { PRDetailView } from "./github/PRDetailView";

// --- Types ---

interface SourceControlFullscreenProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
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

  // Graph Viewer State
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitFiles, setCommitFiles] = useState<GitCommitFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // GitHub State
  const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([]);
  const [githubPRs, setGithubPRs] = useState<GitHubPullRequest[]>([]);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);

  // Detail View State
  const [selectedIssue, setSelectedIssue] = useState<IssueDetail | null>(null);
  const [selectedPR, setSelectedPR] = useState<PRDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [issueComment, setIssueComment] = useState("");
  const [prComment, setPrComment] = useState("");
  const [prReviewBody, setPrReviewBody] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [editingIssueTitle, setEditingIssueTitle] = useState(false);
  const [editingIssueBody, setEditingIssueBody] = useState(false);
  const [editingPRTitle, setEditingPRTitle] = useState(false);
  const [editingPRBody, setEditingPRBody] = useState(false);
  const [issueTitleDraft, setIssueTitleDraft] = useState("");
  const [issueBodyDraft, setIssueBodyDraft] = useState("");
  const [prTitleDraft, setPrTitleDraft] = useState("");
  const [prBodyDraft, setPrBodyDraft] = useState("");
  const [availableLabels, setAvailableLabels] = useState<{ name: string; color: string; description: string }[]>([]);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");

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
        const info = parseGitHubRemote(s.remote);
        if (info) {
          setRepoInfo(info);
          try {
            const [issues, prs] = await Promise.all([
              fetchGitHubIssues(info.owner, info.repo),
              fetchGitHubPullRequests(info.owner, info.repo)
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
    if (!isOpen || !currentProject) return;
    refresh();

    const unsubStatus = eventBus.subscribe("git-status-changed", () => refresh());
    const unsubBranch = eventBus.subscribe("git-branch-changed", () => refresh());
    const unsubLog = eventBus.subscribe("git-log-changed", () => refresh());

    return () => {
      unsubStatus();
      unsubBranch();
      unsubLog();
    };
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

  // GitHub Detail Handlers
  const openIssueDetail = async (issue: GitHubIssue) => {
    if (!repoInfo) return;
    setLoadingDetail(true);
    setSelectedPR(null);
    setShowReviewForm(false);
    try {
      const detail = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, issue.number);
      setSelectedIssue(detail);
      setIssueTitleDraft(detail.title);
      setIssueBodyDraft(detail.body);
      setEditingIssueTitle(false);
      setEditingIssueBody(false);
    } catch (e: any) {
      flash(e.message || "Failed to load issue details", false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openPRDetail = async (pr: GitHubPullRequest) => {
    if (!repoInfo) return;
    setLoadingDetail(true);
    setSelectedIssue(null);
    setShowReviewForm(false);
    try {
      const detail = await fetchPRDetail(repoInfo.owner, repoInfo.repo, pr.number);
      setSelectedPR(detail);
      setPrTitleDraft(detail.title);
      setPrBodyDraft(detail.body);
      setEditingPRTitle(false);
      setEditingPRBody(false);
    } catch (e: any) {
      flash(e.message || "Failed to load PR details", false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailView = () => {
    setSelectedIssue(null);
    setSelectedPR(null);
    setShowReviewForm(false);
    setIssueComment("");
    setPrComment("");
    setPrReviewBody("");
  };

  const submitIssueComment = async () => {
    if (!repoInfo || !selectedIssue || !issueComment.trim()) return;
    try {
      await createGitHubIssueComment(repoInfo.owner, repoInfo.repo, selectedIssue.number, issueComment.trim());
      setIssueComment("");
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      flash("Comment added");
    } catch (e: any) {
      flash(e.message || "Failed to add comment", false);
    }
  };

  const submitPRComment = async () => {
    if (!repoInfo || !selectedPR || !prComment.trim()) return;
    try {
      await createGitHubIssueComment(repoInfo.owner, repoInfo.repo, selectedPR.number, prComment.trim());
      setPrComment("");
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      flash("Comment added");
    } catch (e: any) {
      flash(e.message || "Failed to add comment", false);
    }
  };

  const submitPRReview = async (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") => {
    if (!repoInfo || !selectedPR) return;
    try {
      await createPRReview(repoInfo.owner, repoInfo.repo, selectedPR.number, event, prReviewBody.trim());
      setPrReviewBody("");
      setShowReviewForm(false);
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      flash(`Review submitted: ${event.toLowerCase().replace("_", " ")}`);
    } catch (e: any) {
      flash(e.message || "Failed to submit review", false);
    }
  };

  const handleMergePR = async (method: "merge" | "squash" | "rebase") => {
    if (!repoInfo || !selectedPR) return;
    setBusy("merge");
    try {
      await mergePR(repoInfo.owner, repoInfo.repo, selectedPR.number, undefined, method);
      flash("Pull request merged");
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      await refresh();
    } catch (e: any) {
      flash(e.message || "Failed to merge PR", false);
    } finally {
      setBusy(null);
    }
  };

  const handleToggleIssueState = async () => {
    if (!repoInfo || !selectedIssue) return;
    const newState = selectedIssue.state === "open" ? "closed" : "open";
    try {
      await updateIssueState(repoInfo.owner, repoInfo.repo, selectedIssue.number, newState);
      flash(`Issue ${newState}`);
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      await refresh();
    } catch (e: any) {
      flash(e.message || "Failed to update issue state", false);
    }
  };

  const handleTogglePRState = async () => {
    if (!repoInfo || !selectedPR) return;
    const newState = selectedPR.state === "open" ? "closed" : "open";
    try {
      await updatePRState(repoInfo.owner, repoInfo.repo, selectedPR.number, newState);
      flash(`PR ${newState}`);
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      await refresh();
    } catch (e: any) {
      flash(e.message || "Failed to update PR state", false);
    }
  };

  const handleAddLabel = async (label: string) => {
    if (!repoInfo || !selectedIssue) return;
    try {
      await addIssueLabel(repoInfo.owner, repoInfo.repo, selectedIssue.number, label);
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      setShowLabelPicker(false);
      flash(`Label "${label}" added`);
    } catch (e: any) {
      flash(e.message || "Failed to add label", false);
    }
  };

  const handleRemoveLabel = async (label: string) => {
    if (!repoInfo || !selectedIssue) return;
    try {
      await removeIssueLabel(repoInfo.owner, repoInfo.repo, selectedIssue.number, label);
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      flash(`Label "${label}" removed`);
    } catch (e: any) {
      flash(e.message || "Failed to remove label", false);
    }
  };

  const loadAvailableLabels = async () => {
    if (!repoInfo) return;
    try {
      const labels = await fetchRepoLabels(repoInfo.owner, repoInfo.repo);
      setAvailableLabels(labels);
      setShowLabelPicker(true);
    } catch (e: any) {
      flash(e.message || "Failed to load labels", false);
    }
  };

  const handleSaveIssueTitle = async () => {
    if (!repoInfo || !selectedIssue || !issueTitleDraft.trim()) return;
    try {
      await editIssueTitle(repoInfo.owner, repoInfo.repo, selectedIssue.number, issueTitleDraft.trim());
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      setEditingIssueTitle(false);
      flash("Title updated");
    } catch (e: any) {
      flash(e.message || "Failed to update title", false);
    }
  };

  const handleSaveIssueBody = async () => {
    if (!repoInfo || !selectedIssue) return;
    try {
      await editIssueBody(repoInfo.owner, repoInfo.repo, selectedIssue.number, issueBodyDraft);
      const updated = await fetchIssueDetail(repoInfo.owner, repoInfo.repo, selectedIssue.number);
      setSelectedIssue(updated);
      setEditingIssueBody(false);
      flash("Description updated");
    } catch (e: any) {
      flash(e.message || "Failed to update description", false);
    }
  };

  const handleSavePRTitle = async () => {
    if (!repoInfo || !selectedPR || !prTitleDraft.trim()) return;
    try {
      await editPRTitle(repoInfo.owner, repoInfo.repo, selectedPR.number, prTitleDraft.trim());
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      setEditingPRTitle(false);
      flash("Title updated");
    } catch (e: any) {
      flash(e.message || "Failed to update title", false);
    }
  };

  const handleSavePRBody = async () => {
    if (!repoInfo || !selectedPR) return;
    try {
      await editPRBody(repoInfo.owner, repoInfo.repo, selectedPR.number, prBodyDraft);
      const updated = await fetchPRDetail(repoInfo.owner, repoInfo.repo, selectedPR.number);
      setSelectedPR(updated);
      setEditingPRBody(false);
      flash("Description updated");
    } catch (e: any) {
      flash(e.message || "Failed to update description", false);
    }
  };

  const handleCommitClick = async (hash: string) => {
    if (selectedCommit === hash) {
      setSelectedCommit(null);
      setCommitFiles([]);
      setSelectedFile(null);
      setFileDiff(null);
      return;
    }
    setSelectedCommit(hash);
    setCommitFiles([]);
    setSelectedFile(null);
    setFileDiff(null);
    try {
      const files = await invoke<GitCommitFile[]>("git_panel_get_commit_details", { cwd: currentProject, commitHash: hash });
      setCommitFiles(files);
    } catch (e) {
      flash(String(e), false);
    }
  };

  const handleFileClick = async (hash: string, path: string) => {
    setSelectedFile(path);
    setLoadingDiff(true);
    setFileDiff(null);
    try {
      const diff = await invoke<string>("git_panel_get_commit_file_diff", { cwd: currentProject, commitHash: hash, filePath: path });
      setFileDiff(diff);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setLoadingDiff(false);
    }
  };

  const TABS = [
    { id: "overview", label: "Working Tree", icon: LayoutDashboard },
    { id: "graph", label: "Commit Graph", icon: GitCommit },
    { id: "branches", label: "Branches", icon: GitBranch },
    { id: "prs", label: "Pull Requests", icon: GitPullRequest },
    { id: "issues", label: "Issues", icon: FileText },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black/85 z-[100] animate-in fade-in duration-300" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#08080a] border border-zinc-800 rounded-2xl shadow-[0_0_80px_-15px_rgba(0,0,0,0.9)] overflow-hidden w-full max-w-[1400px] h-[90vh] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">

          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-[#0d0d10] shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-zinc-100">
                <Globe size={20} className="text-white" />
                <h2 className="text-sm font-bold tracking-wide">Git Center</h2>
                {status && (
                  <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800 ml-2">
                    {currentProject?.split(/[\\/]/).pop()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={refresh} disabled={loading} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-all text-xs flex items-center gap-2 disabled:opacity-50">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={onClose} className="p-1.5 bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-all">
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
            <div className="w-56 border-r border-zinc-800/80 bg-black/40 flex flex-col p-3 gap-1 shrink-0">
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
                    onClick={() => { setActiveTab(tab.id as any); setSearchTerm(""); closeDetailView(); }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive ? "bg-brand-accent/15 text-brand-accent border border-brand-accent/20" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={16} />
                      {tab.label}
                    </div>
                    {badgeCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isActive ? 'bg-brand-accent/20' : 'bg-zinc-800/80'}`}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Status Indicator */}
              <div className="mt-auto p-3 bg-zinc-900/20 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Current Branch</div>
                <div className="flex items-center gap-2 text-sm text-brand-accent font-mono">
                  <GitBranch size={14} />
                  <span className="truncate">{status?.branch || "..."}</span>
                </div>
                {status?.remote && (
                  <div className="text-[10px] text-zinc-500 font-mono truncate pt-2 border-t border-zinc-800/80 mt-2">
                    {parseGitHubRemote(status.remote)?.owner}/{parseGitHubRemote(status.remote)?.repo}
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0b0b0d]">

              {/* --- OVERVIEW TAB --- */}
              {activeTab === "overview" && (
                <OverviewView
                  status={status}
                  log={log}
                  commitMsg={commitMsg}
                  onCommitMsgChange={setCommitMsg}
                  onCommit={commit}
                  onPull={pull}
                  onPush={push}
                  onStage={stage}
                  onUnstage={unstage}
                  onDiscard={discard}
                  onStageAll={stageAll}
                  busy={busy}
                />
              )}

              {/* --- GRAPH TAB --- */}
              {activeTab === "graph" && (
                <GraphView
                  log={log}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  selectedCommit={selectedCommit}
                  onCommitClick={handleCommitClick}
                  commitFiles={commitFiles}
                  selectedFile={selectedFile}
                  onFileClick={handleFileClick}
                  fileDiff={fileDiff}
                  loadingDiff={loadingDiff}
                />
              )}

              {/* --- BRANCHES TAB --- */}
              {activeTab === "branches" && (
                <BranchesView
                  branches={branches}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  newBranchName={newBranchName}
                  onNewBranchNameChange={setNewBranchName}
                  onCreateBranch={createBranch}
                  onSwitch={switchBranch}
                  onDelete={deleteBranch}
                  onMerge={mergeBranch}
                  busy={busy}
                />
              )}

              {/* --- GITHUB TABS (Issues / PRs) --- */}
              {(activeTab === "issues" || activeTab === "prs") && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Detail View */}
                  {selectedIssue && (
                    <IssueDetailView
                      issue={selectedIssue}
                      repoInfo={repoInfo!}
                      onBack={closeDetailView}
                      onComment={issueComment}
                      onCommentChange={setIssueComment}
                      onSubmitComment={submitIssueComment}
                      onToggleState={handleToggleIssueState}
                      onAddLabel={handleAddLabel}
                      onRemoveLabel={handleRemoveLabel}
                      onLoadLabels={loadAvailableLabels}
                      availableLabels={availableLabels}
                      showLabelPicker={showLabelPicker}
                      setShowLabelPicker={setShowLabelPicker}
                      labelSearch={labelSearch}
                      setLabelSearch={setLabelSearch}
                      editingTitle={editingIssueTitle}
                      setEditingTitle={setEditingIssueTitle}
                      titleDraft={issueTitleDraft}
                      setTitleDraft={setIssueTitleDraft}
                      onSaveTitle={handleSaveIssueTitle}
                      editingBody={editingIssueBody}
                      setEditingBody={setEditingIssueBody}
                      bodyDraft={issueBodyDraft}
                      setBodyDraft={setIssueBodyDraft}
                      onSaveBody={handleSaveIssueBody}
                    />
                  )}

                  {selectedPR && (
                    <PRDetailView
                      pr={selectedPR}
                      repoInfo={repoInfo!}
                      onBack={closeDetailView}
                      onComment={prComment}
                      onCommentChange={setPrComment}
                      onSubmitComment={submitPRComment}
                      onMerge={handleMergePR}
                      onToggleState={handleTogglePRState}
                      onSubmitReview={submitPRReview}
                      showReviewForm={showReviewForm}
                      setShowReviewForm={setShowReviewForm}
                      reviewBody={prReviewBody}
                      setReviewBody={setPrReviewBody}
                      busy={busy}
                      editingTitle={editingPRTitle}
                      setEditingTitle={setEditingPRTitle}
                      titleDraft={prTitleDraft}
                      setTitleDraft={setPrTitleDraft}
                      onSaveTitle={handleSavePRTitle}
                      editingBody={editingPRBody}
                      setEditingBody={setEditingPRBody}
                      bodyDraft={prBodyDraft}
                      setBodyDraft={setPrBodyDraft}
                      onSaveBody={handleSavePRBody}
                    />
                  )}

                  {/* List View (only when no detail selected) */}
                  {!selectedIssue && !selectedPR && (
                    <IssuesPRsList
                      activeTab={activeTab}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      issues={githubIssues}
                      prs={githubPRs}
                      loading={loading}
                      loadingDetail={loadingDetail}
                      githubError={githubError}
                      onOpenIssue={openIssueDetail}
                      onOpenPR={openPRDetail}
                      onBack={() => setActiveTab("overview")}
                    />
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
