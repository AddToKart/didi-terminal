import { ArrowRight, FileText } from "lucide-react";
import type { IssueDetail } from "../../../services/github-service";

export interface IssueDetailViewProps {
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

export function IssueDetailView({
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
