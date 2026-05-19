import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch, X, RefreshCw, Plus, Minus, RotateCcw, Upload, Download,
  Check, Loader2, GitMerge, AlertCircle, FileText,
  GitPullRequest, GitCommit, LayoutDashboard, Search, ShieldAlert,
  Trash2, MessageCircle, GitFork, ArrowRight, Globe, RotateCw
} from "lucide-react";
import { FileIcon } from "./FileIcon";
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

interface GitCommitFile {
  path: string;
  status: string;
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

// --- Issue Detail View ---

interface IssueDetailViewProps {
  issue: IssueDetail;
  repoInfo: { owner: string; repo: string };
  onBack: () => void;
  onComment: string;
  onCommentChange: (v: string) => void;
  onSubmitComment: () => void;
  onToggleState: () => void;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  onLoadLabels: () => void;
  availableLabels: { name: string; color: string; description: string }[];
  showLabelPicker: boolean;
  setShowLabelPicker: (v: boolean) => void;
  labelSearch: string;
  setLabelSearch: (v: string) => void;
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  titleDraft: string;
  setTitleDraft: (v: string) => void;
  onSaveTitle: () => void;
  editingBody: boolean;
  setEditingBody: (v: boolean) => void;
  bodyDraft: string;
  setBodyDraft: (v: string) => void;
  onSaveBody: () => void;
}

function IssueDetailView({
  issue, onBack, onComment, onCommentChange, onSubmitComment,
  onToggleState, onAddLabel, onRemoveLabel, onLoadLabels, availableLabels,
  showLabelPicker, setShowLabelPicker, labelSearch, setLabelSearch,
  editingTitle, setEditingTitle, titleDraft, setTitleDraft, onSaveTitle,
  editingBody, setEditingBody, bodyDraft, setBodyDraft, onSaveBody,
}: IssueDetailViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-zinc-800/80 rounded-lg transition-colors border border-zinc-800/80">
            <ArrowRight size={14} className="rotate-180 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-zinc-400" />
            <span className="text-xs font-mono text-zinc-500">#{issue.number}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleState} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            issue.state === "open" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
          }`}>
            {issue.state === "open" ? "Close Issue" : "Reopen Issue"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="flex items-start gap-2">
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  className="flex-1 bg-black/40 border border-brand-accent/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") onSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                />
                <button onClick={onSaveTitle} className="px-3 py-2 bg-brand-accent text-black rounded-lg text-xs font-bold">Save</button>
                <button onClick={() => setEditingTitle(false)} className="px-3 py-2 bg-zinc-900/60 text-zinc-400 rounded-lg text-xs">Cancel</button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <h2 className="text-lg font-bold text-zinc-100 flex-1">{issue.title}</h2>
                <button onClick={() => { setEditingTitle(true); setTitleDraft(issue.title); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800/80 rounded transition-all">
                  <FileText size={12} className="text-zinc-500" />
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              issue.state === 'open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            }`}>{issue.state}</span>
            <span>opened by <span className="text-zinc-300">@{issue.author}</span> on {new Date(issue.createdAt).toLocaleDateString()}</span>
            {issue.assignees.length > 0 && <span>· assigned to <span className="text-zinc-300">{issue.assignees.map(a => `@${a}`).join(", ")}</span></span>}
          </div>

          {/* Labels */}
          <div className="flex items-center gap-2 flex-wrap">
            {issue.labels.map(l => (
              <span key={l.name} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border cursor-default group" style={{ color: `#${l.color}`, backgroundColor: `#${l.color}15`, borderColor: `#${l.color}30` }}>
                {l.name}
                <button onClick={() => onRemoveLabel(l.name)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">×</button>
              </span>
            ))}
            <button onClick={onLoadLabels} className="text-[10px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 transition-all">
              + Label
            </button>
          </div>

          {/* Label Picker */}
          {showLabelPicker && (
            <div className="bg-black/40 border border-zinc-800 rounded-xl p-3 space-y-2">
              <input
                placeholder="Search labels..."
                value={labelSearch}
                onChange={e => setLabelSearch(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none"
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableLabels.filter(l => l.name.toLowerCase().includes(labelSearch.toLowerCase()) && !issue.labels.find(il => il.name === l.name)).map(l => (
                  <button key={l.name} onClick={() => onAddLabel(l.name)} className="w-full text-left px-2 py-1.5 rounded hover:bg-zinc-900/60 transition-colors flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: `#${l.color}` }} />
                    <span className="text-xs text-zinc-300">{l.name}</span>
                    {l.description && <span className="text-[10px] text-zinc-600 truncate">{l.description}</span>}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowLabelPicker(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">Close</button>
            </div>
          )}

          {/* Body */}
          <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</span>
              {!editingBody && (
                <button onClick={() => { setEditingBody(true); setBodyDraft(issue.body); }} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              )}
            </div>
            {editingBody ? (
              <div className="space-y-2">
                <textarea
                  value={bodyDraft}
                  onChange={e => setBodyDraft(e.target.value)}
                  rows={8}
                  className="w-full bg-black/40 border border-brand-accent/50 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={onSaveBody} className="px-3 py-1.5 bg-brand-accent text-black rounded-lg text-xs font-bold">Save</button>
                  <button onClick={() => setEditingBody(false)} className="px-3 py-1.5 bg-zinc-900/60 text-zinc-400 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{issue.body || <span className="text-zinc-600 italic">No description provided.</span>}</div>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Comments ({issue.comments.length})</div>
            {issue.comments.map(c => (
              <div key={c.id} className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-300">@{c.author}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{c.body}</div>
              </div>
            ))}
          </div>

          {/* Comment Input */}
          <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
            <textarea
              value={onComment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder="Write a comment..."
              rows={4}
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-brand-accent/50 focus:outline-none resize-none placeholder:text-zinc-600"
            />
            <div className="flex justify-end mt-2">
              <button onClick={onSubmitComment} disabled={!onComment.trim()} className="px-4 py-2 bg-brand-accent text-black rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PR Detail View ---

interface PRDetailViewProps {
  pr: PRDetail;
  repoInfo: { owner: string; repo: string };
  onBack: () => void;
  onComment: string;
  onCommentChange: (v: string) => void;
  onSubmitComment: () => void;
  onMerge: (method: "merge" | "squash" | "rebase") => void;
  onToggleState: () => void;
  onSubmitReview: (event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT") => void;
  showReviewForm: boolean;
  setShowReviewForm: (v: boolean) => void;
  reviewBody: string;
  setReviewBody: (v: string) => void;
  busy: string | null;
  editingTitle: boolean;
  setEditingTitle: (v: boolean) => void;
  titleDraft: string;
  setTitleDraft: (v: string) => void;
  onSaveTitle: () => void;
  editingBody: boolean;
  setEditingBody: (v: boolean) => void;
  bodyDraft: string;
  setBodyDraft: (v: string) => void;
  onSaveBody: () => void;
}

function PRDetailView({
  pr, onBack, onComment, onCommentChange, onSubmitComment,
  onMerge, onToggleState, onSubmitReview, showReviewForm, setShowReviewForm,
  reviewBody, setReviewBody, busy,
  editingTitle, setEditingTitle, titleDraft, setTitleDraft, onSaveTitle,
  editingBody, setEditingBody, bodyDraft, setBodyDraft, onSaveBody,
}: PRDetailViewProps) {
  const isMerged = pr.state === "closed" && pr.mergeableState === "merged";
  const canMerge = pr.state === "open" && pr.mergeable && !pr.isDraft;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-zinc-800/80 rounded-lg transition-colors border border-zinc-800/80">
            <ArrowRight size={14} className="rotate-180 text-zinc-400" />
          </button>
          <div className="flex items-center gap-2">
            <GitPullRequest size={16} className="text-zinc-400" />
            <span className="text-xs font-mono text-zinc-500">#{pr.number}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pr.state === "open" && (
            <>
              <button onClick={() => setShowReviewForm(!showReviewForm)} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all">
                Review
              </button>
              {canMerge && (
                <div className="flex items-center gap-1">
                  <button onClick={() => onMerge("merge")} disabled={!!busy} className="px-3 py-1.5 bg-brand-accent text-black rounded-lg text-xs font-bold hover:bg-brand-accent/80 transition-all disabled:opacity-50">
                    Merge
                  </button>
                  <button onClick={() => onMerge("squash")} disabled={!!busy} className="px-2 py-1.5 bg-brand-accent/20 text-brand-accent rounded-lg text-xs font-bold hover:bg-brand-accent/30 transition-all disabled:opacity-50" title="Squash and merge">
                    <GitMerge size={12} />
                  </button>
                  <button onClick={() => onMerge("rebase")} disabled={!!busy} className="px-2 py-1.5 bg-brand-accent/20 text-brand-accent rounded-lg text-xs font-bold hover:bg-brand-accent/30 transition-all disabled:opacity-50" title="Rebase and merge">
                    <RotateCw size={12} />
                  </button>
                </div>
              )}
            </>
          )}
          <button onClick={onToggleState} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            pr.state === "open" ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 hover:bg-zinc-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
          }`}>
            {pr.state === "open" ? "Close PR" : "Reopen PR"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <div>
            {editingTitle ? (
              <div className="flex items-start gap-2">
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  className="flex-1 bg-black/40 border border-brand-accent/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") onSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                />
                <button onClick={onSaveTitle} className="px-3 py-2 bg-brand-accent text-black rounded-lg text-xs font-bold">Save</button>
                <button onClick={() => setEditingTitle(false)} className="px-3 py-2 bg-zinc-900/60 text-zinc-400 rounded-lg text-xs">Cancel</button>
              </div>
            ) : (
              <div className="flex items-start gap-2 group">
                <h2 className="text-lg font-bold text-zinc-100 flex-1">{pr.title}</h2>
                <button onClick={() => { setEditingTitle(true); setTitleDraft(pr.title); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800/80 rounded transition-all">
                  <FileText size={12} className="text-zinc-500" />
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
              isMerged ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
              pr.state === 'open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            }`}>{isMerged ? "MERGED" : pr.isDraft ? "DRAFT" : pr.state}</span>
            <span><span className="text-zinc-300">@{pr.author}</span> wants to merge <span className="font-mono text-blue-400">{pr.branchRef}</span></span>
            {pr.assignees.length > 0 && <span>· assigned to <span className="text-zinc-300">{pr.assignees.map(a => `@${a}`).join(", ")}</span></span>}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><Plus size={12} className="text-emerald-400" /> <span className="text-emerald-400">{pr.additions}</span></span>
            <span className="flex items-center gap-1"><Minus size={12} className="text-red-400" /> <span className="text-red-400">{pr.deletions}</span></span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{pr.changedFiles} files changed</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">{pr.commits.length} commits</span>
          </div>

          {/* Merge Status */}
          <div className={`p-3 rounded-xl border text-xs ${
            isMerged ? "bg-purple-500/5 border-purple-500/20 text-purple-400" :
            canMerge ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" :
            pr.state === "closed" ? "bg-zinc-500/5 border-zinc-500/20 text-zinc-400" :
            "bg-amber-500/5 border-amber-500/20 text-amber-400"
          }`}>
            {isMerged ? "This pull request has been merged." :
             canMerge ? "This branch is ready to be merged." :
             pr.state === "closed" ? "This pull request is closed." :
             `Merge status: ${pr.mergeableState}`}
          </div>

          {/* Reviews */}
          {pr.reviews.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Reviews</div>
              {pr.reviews.filter(r => r.state !== "PENDING").map(r => (
                <div key={r.id} className={`p-3 rounded-xl border ${
                  r.state === "APPROVED" ? "bg-emerald-500/5 border-emerald-500/20" :
                  r.state === "CHANGES_REQUESTED" ? "bg-red-500/5 border-red-500/20" :
                  "bg-zinc-900/20 border-zinc-800/80"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-zinc-300">@{r.author}</span>
                    <span className={`text-[10px] font-bold ${
                      r.state === "APPROVED" ? "text-emerald-400" :
                      r.state === "CHANGES_REQUESTED" ? "text-red-400" : "text-zinc-500"
                    }`}>{r.state.replace("_", " ")}</span>
                  </div>
                  {r.body && <div className="text-xs text-zinc-400 font-mono">{r.body}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4 space-y-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Submit Review</div>
              <textarea
                value={reviewBody}
                onChange={e => setReviewBody(e.target.value)}
                placeholder="Review comments (optional)..."
                rows={3}
                className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none resize-none placeholder:text-zinc-600"
              />
              <div className="flex gap-2">
                <button onClick={() => onSubmitReview("APPROVE")} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold hover:bg-emerald-500/20">Approve</button>
                <button onClick={() => onSubmitReview("REQUEST_CHANGES")} className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold hover:bg-red-500/20">Request Changes</button>
                <button onClick={() => onSubmitReview("COMMENT")} className="px-3 py-1.5 bg-zinc-900/60 text-zinc-400 border border-zinc-800 rounded-lg text-xs font-bold hover:bg-zinc-800/80">Comment</button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Description</span>
              {!editingBody && (
                <button onClick={() => { setEditingBody(true); setBodyDraft(pr.body); }} className="text-[10px] text-zinc-500 hover:text-zinc-300">Edit</button>
              )}
            </div>
            {editingBody ? (
              <div className="space-y-2">
                <textarea
                  value={bodyDraft}
                  onChange={e => setBodyDraft(e.target.value)}
                  rows={8}
                  className="w-full bg-black/40 border border-brand-accent/50 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={onSaveBody} className="px-3 py-1.5 bg-brand-accent text-black rounded-lg text-xs font-bold">Save</button>
                  <button onClick={() => setEditingBody(false)} className="px-3 py-1.5 bg-zinc-900/60 text-zinc-400 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{pr.body || <span className="text-zinc-600 italic">No description provided.</span>}</div>
            )}
          </div>

          {/* Commits */}
          {pr.commits.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Commits ({pr.commits.length})</div>
              {pr.commits.map(c => (
                <div key={c.sha} className="flex items-center gap-3 p-2.5 bg-zinc-900/20 border border-zinc-800/80 rounded-lg">
                  <GitCommit size={14} className="text-zinc-500 shrink-0" />
                  <span className="text-xs text-zinc-300 truncate flex-1">{c.message}</span>
                  <span className="text-[10px] text-zinc-600 font-mono shrink-0">{c.sha.slice(0, 7)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Comments */}
          <div className="space-y-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Comments ({pr.comments.length})</div>
            {pr.comments.map(c => (
              <div key={c.id} className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-zinc-300">@{c.author}</span>
                  <span className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{c.body}</div>
              </div>
            ))}
          </div>

          {/* Comment Input */}
          <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl p-4">
            <textarea
              value={onComment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder="Write a comment..."
              rows={4}
              className="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-brand-accent/50 focus:outline-none resize-none placeholder:text-zinc-600"
            />
            <div className="flex justify-end mt-2">
              <button onClick={onSubmitComment} disabled={!onComment.trim()} className="px-4 py-2 bg-brand-accent text-black rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
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
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Working Tree */}
                  <div className="flex-[3] border-r border-zinc-800/80 flex flex-col min-w-0">
                    <div className="px-5 py-3 bg-zinc-900/20 border-b border-zinc-800/80 flex items-center justify-between">
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
                          <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-xl overflow-hidden">
                            {status.staged.map(f => (
                              <div key={f.path} className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 hover:bg-zinc-900/60 group">
                                <div className="flex items-center gap-3 min-w-0">
                                  <StatusIcon status={f.status} />
                                  <FileIcon filename={f.path.split("/").pop()!} size={16} />
                                  <span className="text-xs text-zinc-300 truncate font-mono">{f.path}</span>      
                                </div>
                                <button onClick={() => unstage(f.path)} className="opacity-0 group-hover:opacity-100 p-1 bg-zinc-800/80 hover:bg-white/20 text-zinc-400 rounded transition-all" title="Unstage">
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
                        onChange={e => setCommitMsg(e.target.value)}
                        placeholder="Commit message... (Ctrl+Enter)"
                        onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) commit(); }}
                        rows={3}
                        className="w-full resize-none bg-black/60 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/50 transition-all font-mono"
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
                        <button onClick={pull} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
                          {busy === "pull" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Pull
                        </button>
                        <button onClick={push} disabled={!!busy} className="flex-1 flex items-center justify-center gap-2 py-2 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800/80 text-zinc-300 rounded-lg transition-all disabled:opacity-50 text-xs font-bold">
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
              )}

              {/* --- GRAPH TAB (VS CODE STYLE) --- */}
              {activeTab === "graph" && (
                <div className="flex-1 flex overflow-hidden">
                  
                  {/* Sidebar: Commits & Files */}
                  <div className="w-[350px] border-r border-zinc-800/80 flex flex-col min-w-0 bg-[#0d0d0f] shrink-0">
                    <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/20 shrink-0 flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Source Control: Graph</h3>
                    </div>
                    
                    <div className="p-2 border-b border-zinc-800/80 shrink-0 bg-black/20">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Search commits..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="bg-zinc-900/50 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:border-brand-accent/50 outline-none w-full transition-colors"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {log.filter(l => l.message.toLowerCase().includes(searchTerm.toLowerCase())).map((entry) => {
                        const isExpanded = selectedCommit === entry.hash;
                        
                        return (
                          <div key={entry.hash} className="flex flex-col">
                            {/* Commit Row */}
                            <div 
                              className={`flex flex-col px-3 py-2 cursor-pointer transition-colors ${isExpanded ? 'bg-brand-accent/10 border-l-2 border-brand-accent' : 'border-l-2 border-transparent hover:bg-zinc-900/60'}`}
                              onClick={() => handleCommitClick(entry.hash)}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <GitCommit size={14} className={isExpanded ? 'text-brand-accent' : 'text-zinc-500'} />
                                  <span className={`text-xs truncate ${isExpanded ? 'text-brand-accent font-bold' : 'text-zinc-300'}`}>
                                    {entry.message}
                                  </span>
                                </div>
                                <span className="text-[9px] font-mono text-zinc-500 shrink-0">{entry.shortHash}</span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-zinc-500 pl-5">
                                <span className="truncate max-w-[120px]">{entry.author}</span>
                                <span>{entry.date}</span>
                              </div>
                              {entry.refs && (
                                <div className="pl-5 mt-1">
                                  <RefBadge refs={entry.refs} />
                                </div>
                              )}
                            </div>

                            {/* Expanded Files List */}
                            {isExpanded && (
                              <div className="bg-black/40 border-y border-zinc-800/80 py-1">
                                {commitFiles.length === 0 ? (
                                  <div className="py-3 flex justify-center">
                                    <Loader2 size={14} className="animate-spin text-zinc-500" />
                                  </div>
                                ) : (
                                  commitFiles.map(file => {
                                    const isSelectedFile = selectedFile === file.path;
                                    return (
                                      <div
                                        key={file.path}
                                        onClick={() => handleFileClick(entry.hash, file.path)}
                                        className={`flex items-center justify-between px-3 py-1.5 pl-8 cursor-pointer transition-colors ${isSelectedFile ? 'bg-brand-accent/20 text-brand-accent' : 'hover:bg-zinc-900/60 text-zinc-400'}`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <FileIcon filename={file.path.split("/").pop()!} size={14} />
                                          <span className={`text-[11px] truncate ${isSelectedFile ? 'font-medium' : ''}`}>
                                            {file.path.split("/").pop()}
                                          </span>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-2">
                                          <span className="text-[9px] text-zinc-600 truncate max-w-[100px] hidden xl:block">{file.path}</span>
                                          <StatusIcon status={file.status} />
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Main: Diff Viewer */}
                  <div className="flex-1 flex flex-col min-w-0 bg-[#08080a] relative">
                    {!selectedFile ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 p-6 text-center">
                        <div className="size-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center bg-zinc-900/50">
                          <GitCommit size={28} className="text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-400 mb-1">Select a file to view changes</p>
                          <p className="text-xs">Click on a commit in the sidebar, then select a file to see its diff.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="px-5 py-3 border-b border-zinc-800/80 bg-[#0e0e11] shrink-0 flex items-center gap-3">
                          <FileIcon filename={selectedFile.split("/").pop()!} size={16} />
                          <h3 className="text-xs font-bold text-zinc-200">
                            {selectedFile.split("/").pop()}
                          </h3>
                          <span className="text-[10px] font-mono text-zinc-500 ml-2">{selectedFile}</span>
                        </div>
                        
                        <div className="flex-1 overflow-auto custom-scrollbar p-4">
                          {loadingDiff ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                              <Loader2 size={24} className="animate-spin text-brand-accent" />
                              <span className="text-xs font-medium tracking-wide">Loading diff...</span>
                            </div>
                          ) : fileDiff ? (
                            <div className="text-[11px] font-mono leading-relaxed bg-[#0d0d0f] border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
                              <table className="w-full border-collapse">
                                <tbody className="align-top">
                                  {(() => {
                                    let oldLine = 0;
                                    let newLine = 0;

                                    return fileDiff.split('\n').map((line, i) => {
                                      if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('new file ') || line.startsWith('deleted file ')) {
                                        return (
                                          <tr key={`header-${i}`} className="bg-black/80 border-b border-zinc-800/80">
                                            <td colSpan={4} className="px-4 py-2 text-zinc-500 text-[10px] select-none font-bold">
                                              {line}
                                            </td>
                                          </tr>
                                        );
                                      }
                                      
                                      if (line.startsWith('---') || line.startsWith('+++')) return null;
                                      
                                      if (line.startsWith('@@')) {
                                        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                                        if (match) {
                                          oldLine = parseInt(match[1], 10);
                                          newLine = parseInt(match[2], 10);
                                        }
                                        return (
                                          <tr key={`h-${i}`} className="bg-blue-900/10 border-y border-blue-500/20">
                                            <td colSpan={4} className="px-4 py-1.5 text-blue-400/70 text-[10px] select-none text-center bg-blue-500/5">
                                              ••• {line.replace(/@@/g, '').trim()} •••
                                            </td>
                                          </tr>
                                        );
                                      }

                                      const isAdded = line.startsWith('+');
                                      const isRemoved = line.startsWith('-');
                                      const content = line.substring(1);
                                      const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

                                      let rowClass = "text-zinc-300 hover:bg-zinc-900/20";
                                      let prefixClass = "text-zinc-600 px-2 py-0.5 select-none w-6 text-center border-r border-transparent";
                                      let contentClass = "px-4 py-0.5 whitespace-pre break-all";

                                      let currentOldLine: number | string = ' ';
                                      let currentNewLine: number | string = ' ';

                                      if (isAdded) {
                                        rowClass = "bg-emerald-500/[0.12] text-emerald-200 hover:bg-emerald-500/[0.15]";
                                        prefixClass = "text-emerald-500/60 px-2 py-0.5 select-none w-6 text-center border-r border-emerald-500/20";
                                        currentNewLine = newLine++;
                                      } else if (isRemoved) {
                                        rowClass = "bg-red-500/[0.12] text-red-200 hover:bg-red-500/[0.15] line-through decoration-red-500/30";
                                        prefixClass = "text-red-500/60 px-2 py-0.5 select-none w-6 text-center border-r border-red-500/20";
                                        currentOldLine = oldLine++;
                                      } else {
                                        currentOldLine = oldLine++;
                                        currentNewLine = newLine++;
                                      }

                                      return (
                                        <tr key={i} className={rowClass}>
                                          <td className="text-zinc-600/50 text-[10px] px-2 py-0.5 text-right w-10 select-none border-r border-zinc-800/80 bg-[#0a0a0c]">{currentOldLine}</td>
                                          <td className="text-zinc-600/50 text-[10px] px-2 py-0.5 text-right w-10 select-none border-r border-zinc-800/80 bg-[#0a0a0c]">{currentNewLine}</td>
                                          <td className={prefixClass}>{prefix}</td>
                                          <td className={contentClass}>{content || ' '}</td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                             <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 p-6 text-center">
                              <span className="text-xs">No diff available (binary file or empty diff)</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
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
                        onChange={e => setNewBranchName(e.target.value)}
                        placeholder="feature/new-idea"
                        className="bg-black/40 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-brand-accent/50 outline-none w-full font-mono transition-all"
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
                                <button onClick={() => mergeBranch(b.name)} className="p-2 bg-zinc-900/60 hover:bg-indigo-500/20 text-zinc-400 hover:text-indigo-400 rounded-lg transition-colors" title="Merge into current">
                                  <GitMerge size={14} />
                                </button>
                                <button onClick={() => deleteBranch(b.name)} className="p-2 bg-zinc-900/60 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg transition-colors mr-1" title="Delete Branch">
                                  <Trash2 size={14} />
                                </button>
                                <button onClick={() => switchBranch(b.name)} className="px-3 py-1.5 bg-zinc-800/80 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1">
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
                    <>
                      <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setActiveTab("overview")} className="p-1 hover:bg-zinc-800/80 rounded transition-colors">
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
                            onChange={e => setSearchTerm(e.target.value)}
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
                          {!githubError && activeTab === "issues" && githubIssues.length === 0 && !loading && (
                            <div className="text-center text-zinc-500 py-12">No issues found for this repository.</div>
                          )}
                          {!githubError && activeTab === "prs" && githubPRs.length === 0 && !loading && (
                            <div className="text-center text-zinc-500 py-12">No pull requests found for this repository.</div>
                          )}

                          {activeTab === "issues" && githubIssues.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase())).map(issue => (
                            <div key={issue.number} className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/80 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all group cursor-pointer" onClick={() => openIssueDetail(issue)}>
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

                          {activeTab === "prs" && githubPRs.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).map(pr => (
                            <div key={pr.number} className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/80 hover:border-zinc-800 hover:bg-zinc-900/40 transition-all group cursor-pointer" onClick={() => openPRDetail(pr)}>
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
