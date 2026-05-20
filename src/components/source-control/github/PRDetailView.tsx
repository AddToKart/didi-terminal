import { ArrowRight, GitPullRequest, GitMerge, RotateCw, Plus, Minus, FileText, GitCommit } from "lucide-react";
import type { PRDetail } from "../../../services/github-service";

export interface PRDetailViewProps {
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

export function PRDetailView({
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
