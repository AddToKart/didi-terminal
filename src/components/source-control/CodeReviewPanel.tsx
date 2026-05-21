import { useState, useEffect, Fragment } from "react";
import { invoke } from "@tauri-apps/api/core";
import { 
  X, 
  Check, 
  FileCode2, 
  ChevronRight, 
  GitCommit, 
  CheckCircle2, 
  Circle,
  Eye,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Edit2
} from "lucide-react";
import { FileIcon } from "./FileIcon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { eventBus } from "../../services/event-bus";

// ── CODE HIGHLIGHTING UTILITIES ──

function highlightJSONLine(line: string): React.ReactNode {
  if (!line.trim()) return line;
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`txt-${key++}`} className="text-zinc-400 font-mono">{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        parts.push(
          <span key={`key-${key++}`} className="text-cyan-400 font-semibold font-mono">
            {token.slice(0, -1)}
          </span>
        );
        parts.push(<span key={`colon-${key++}`} className="text-zinc-650 font-mono">:</span>);
      } else {
        parts.push(
          <span key={`str-${key++}`} className="text-emerald-400 font-mono">
            {token}
          </span>
        );
      }
    } else if (/^(true|false)$/.test(token)) {
      parts.push(<span key={`bool-${key++}`} className="text-amber-400 font-bold font-mono">{token}</span>);
    } else if (token === "null") {
      parts.push(<span key={`null-${key++}`} className="text-red-400 italic font-mono">{token}</span>);
    } else if (/^-?\d+(?:\.\d*)?/.test(token)) {
      parts.push(<span key={`num-${key++}`} className="text-violet-400 font-bold font-mono">{token}</span>);
    } else {
      parts.push(<span key={`punc-${key++}`} className="text-zinc-500 font-mono">{token}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="text-zinc-400 font-mono">{line.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function highlightHtmlLine(line: string): React.ReactNode {
  if (!line.trim()) return line;
  if (line.trim().startsWith('<!--')) {
    return <span className="text-zinc-500/80 italic font-mono">{line}</span>;
  }

  const tokenRegex = /(<!--.*?-->|<\/?[a-zA-Z0-9:-]+>?|"[^"]*"|'[^']*')/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`txt-${key++}`} className="text-zinc-300 font-mono">{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    if (token.startsWith('<!--')) {
      parts.push(<span key={`comment-${key++}`} className="text-zinc-500/80 italic font-mono">{token}</span>);
    } else if (token.startsWith('<')) {
      const tagNameMatch = token.match(/^<\/?[a-zA-Z0-9:-]+/);
      if (tagNameMatch) {
        const tagName = tagNameMatch[0];
        const rest = token.substring(tagName.length);
        parts.push(
          <span key={`bracket-open-${key++}`} className="text-zinc-500 font-mono">
            {tagName.startsWith('</') ? '</' : '<'}
          </span>
        );
        parts.push(
          <span key={`tag-${key++}`} className="text-cyan-400 font-semibold font-mono">
            {tagName.replace(/^<\/?[a-zA-Z0-9:-]+/, (m) => m.startsWith('</') ? m.substring(2) : m.substring(1))}
          </span>
        );
        if (rest) {
          parts.push(<span key={`bracket-close-${key++}`} className="text-zinc-500 font-mono">{rest}</span>);
        }
      } else {
        parts.push(<span key={`tag-other-${key++}`} className="text-zinc-500 font-mono">{token}</span>);
      }
    } else if (token.startsWith('"') || token.startsWith("'")) {
      parts.push(<span key={`val-${key++}`} className="text-emerald-400 font-mono">{token}</span>);
    } else {
      parts.push(<span key={`other-${key++}`} className="text-zinc-300 font-mono">{token}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="text-zinc-300 font-mono">{line.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function highlightCssLine(line: string): React.ReactNode {
  if (!line.trim()) return line;
  if (line.trim().startsWith('/*')) {
    return <span className="text-zinc-500/80 italic font-mono">{line}</span>;
  }

  const tokenRegex = /(\/\*.*?\*\/|[a-zA-Z-]+(?=\s*:)|"[^"]*"|'[^']*'|#[a-fA-F0-9]{3,6}|\b\d+(?:px|rem|em|%)?\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`txt-${key++}`} className="text-zinc-400 font-mono">{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    if (token.startsWith('/*')) {
      parts.push(<span key={`comment-${key++}`} className="text-zinc-500/80 italic font-mono">{token}</span>);
    } else if (line.substring(tokenRegex.lastIndex).trim().startsWith(':')) {
      parts.push(<span key={`prop-${key++}`} className="text-cyan-400 font-mono">{token}</span>);
    } else if (token.startsWith('#')) {
      parts.push(<span key={`color-${key++}`} className="text-violet-400 font-semibold font-mono">{token}</span>);
    } else if (/^\b\d+/.test(token)) {
      parts.push(<span key={`num-${key++}`} className="text-amber-300 font-mono">{token}</span>);
    } else {
      parts.push(<span key={`other-${key++}`} className="text-zinc-300 font-mono">{token}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="text-zinc-400 font-mono">{line.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function highlightGeneralLine(line: string): React.ReactNode {
  if (!line.trim()) return line;

  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return <span className="text-zinc-500/80 italic font-mono">{line}</span>;
  }

  const tokenRegex = /(\/\/.*|"(?:\\.|[^\\"])*"|'(?:\\.|[^\\'])*'|`(?:\\.|[^\\`])*`|\b\d+(?:\.\d*)?\b|\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|export|from|class|extends|new|this|typeof|instanceof|in|of|as|type|interface|enum|public|private|protected|readonly|static|async|await|fn|pub|use|impl|trait|struct|mut|match|ref|where|mod|crate|extern|unsafe|move|dyn)\b|\b[A-Z][a-zA-Z0-9_]*\b|\b[a-z_][a-zA-Z0-9_]*(?=\s*\()|[{}()[\].,:;+\-*/%&|^!=<>?~])/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`txt-${key++}`} className="text-zinc-300 font-mono">{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];

    if (token.startsWith('//')) {
      parts.push(
        <span key={`comment-${key++}`} className="text-zinc-500/80 italic font-mono">
          {token}
        </span>
      );
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      parts.push(
        <span key={`str-${key++}`} className="text-emerald-400 font-mono">
          {token}
        </span>
      );
    } else if (/^\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|default|import|export|from|class|extends|new|this|typeof|instanceof|in|of|as|type|interface|enum|public|private|protected|readonly|static|async|await|fn|pub|use|impl|trait|struct|mut|match|ref|where|mod|crate|extern|unsafe|move|dyn)\b$/.test(token)) {
      const isControl = /^(return|if|else|for|while|do|switch|case|break|continue|default|match|async|await)$/.test(token);
      parts.push(
        <span 
          key={`kw-${key++}`} 
          className={
            isControl ? "text-[#ff4081] font-semibold font-mono" : "text-cyan-400 font-semibold font-mono"
          }
        >
          {token}
        </span>
      );
    } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(token)) {
      parts.push(
        <span key={`type-${key++}`} className="text-amber-300 font-mono">
          {token}
        </span>
      );
    } else if (line.substring(tokenRegex.lastIndex).trim().startsWith('(')) {
      parts.push(
        <span key={`fn-${key++}`} className="text-sky-300 font-mono">
          {token}
        </span>
      );
    } else if (/^\b\d+(?:\.\d*)?\b$/.test(token)) {
      parts.push(
        <span key={`num-${key++}`} className="text-violet-400 font-bold font-mono">
          {token}
        </span>
      );
    } else if (/[{}()[\]]/.test(token)) {
      parts.push(
        <span key={`bracket-${key++}`} className="text-zinc-500 font-medium font-mono">
          {token}
        </span>
      );
    } else {
      parts.push(
        <span key={`op-${key++}`} className="text-zinc-400 font-mono">
          {token}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="text-zinc-300 font-mono">{line.substring(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function highlightLine(line: string, filePath: string): React.ReactNode {
  if (!line.trim()) return line;
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (ext === 'json') {
    return highlightJSONLine(line);
  } else if (ext === 'html') {
    return highlightHtmlLine(line);
  } else if (ext === 'css') {
    return highlightCssLine(line);
  } else {
    return highlightGeneralLine(line);
  }
}

export interface GitFileDiff {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface GitStatusResponse {
  branch: string;
  totalAdditions: number;
  totalDeletions: number;
  files: GitFileDiff[];
}

export interface CodeReviewComment {
  id: string;
  projectPath: string;
  filePath: string;
  oldLine: number | null;
  newLine: number | null;
  commentText: string;
  author: string;
  createdAt: number;
}

interface CodeReviewPanelProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatsUpdate?: (stats: { additions: number, deletions: number }) => void;
}

export function CodeReviewPanel({ currentProject, isOpen, onClose, onStatsUpdate }: CodeReviewPanelProps) {
  const [status, setStatus] = useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [reviewedFiles, setReviewedFiles] = useState<Set<string>>(new Set());
  const [commitMsg, setCommitMsg] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [comments, setComments] = useState<CodeReviewComment[]>([]);
  const [commentingLine, setCommentingLine] = useState<{
    filePath: string;
    oldLine: number | null;
    newLine: number | null;
  } | null>(null);
  const [activeCommentText, setActiveCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  const fetchComments = async () => {
    if (!currentProject) return;
    try {
      const res: CodeReviewComment[] = await invoke("load_all_project_comments", { projectPath: currentProject });
      setComments(res);
    } catch (e) {
      console.error("Failed to fetch comments:", e);
    }
  };

  const saveComment = async (oldLine: number | null, newLine: number | null, filePath: string) => {
    if (!currentProject || !activeCommentText.trim()) return;

    const isEdit = !!editingCommentId;
    const commentPayload: CodeReviewComment = {
      id: editingCommentId || crypto.randomUUID(),
      projectPath: currentProject,
      filePath,
      oldLine,
      newLine,
      commentText: activeCommentText.trim(),
      author: "You",
      createdAt: isEdit ? (comments.find(c => c.id === editingCommentId)?.createdAt || Date.now()) : Date.now(),
    };

    try {
      await invoke("save_code_review_comment", { comment: commentPayload });
      setActiveCommentText("");
      setCommentingLine(null);
      setEditingCommentId(null);
      await fetchComments();
    } catch (e) {
      console.error("Failed to save comment:", e);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await invoke("delete_code_review_comment", { id });
      await fetchComments();
    } catch (e) {
      console.error("Failed to delete comment:", e);
    }
  };

  const startEditComment = (comment: CodeReviewComment) => {
    setEditingCommentId(comment.id);
    setActiveCommentText(comment.commentText);
    setCommentingLine({
      filePath: comment.filePath,
      oldLine: comment.oldLine,
      newLine: comment.newLine,
    });
  };

  const fetchStatus = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res: GitStatusResponse = await invoke("get_git_status_structured", { cwd: currentProject });
      setStatus(res);
      if (onStatsUpdate) {
        onStatsUpdate({ additions: res.totalAdditions, deletions: res.totalDeletions });
      }
    } catch (e) {
      console.error("Failed to fetch git status:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentProject || !commitMsg.trim() || reviewedFiles.size === 0) return;
    setIsCommitting(true);
    try {
      await Promise.all(
        Array.from(reviewedFiles).map(path => 
          invoke("git_panel_stage", { cwd: currentProject, path })
        )
      );
      
      await invoke("git_panel_commit", { cwd: currentProject, message: commitMsg });
      setCommitMsg("");
      setPopoverOpen(false);
      setReviewedFiles(new Set());
      setExpandedFiles(new Set());
      await fetchStatus();
    } catch (e) {
      console.error("Commit failed:", e);
    } finally {
      setIsCommitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentProject) return;

    fetchStatus();
    fetchComments();
    const unsub = eventBus.subscribe("git-status-changed", () => {
      fetchStatus();
      fetchComments();
    });
    return () => unsub();
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const toggleFile = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedFiles(next);
  };

  const toggleReviewed = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const next = new Set(reviewedFiles);
    if (next.has(path)) next.delete(path);
    else {
      next.add(path);
      // Auto-collapse when marking as reviewed to save space
      const nextExpanded = new Set(expandedFiles);
      nextExpanded.delete(path);
      setExpandedFiles(nextExpanded);
    }
    setReviewedFiles(next);
  };

  const markAllAsReviewed = () => {
    if (!status) return;
    const allPaths = status.files.map(f => f.path);
    setReviewedFiles(new Set(allPaths));
    setExpandedFiles(new Set());
  };

  const allReviewed = status && status.files.length > 0 && reviewedFiles.size === status.files.length;
  const reviewProgress = status && status.files.length > 0 ? (reviewedFiles.size / status.files.length) * 100 : 0;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-[850px] border-l border-zinc-800 bg-[#070709] flex flex-col shadow-2xl z-50 shrink-0 h-full absolute right-0 top-0">
        
        {/* Header */}
        <div className="flex flex-col border-b border-zinc-800 bg-[#0d0d10] shrink-0 relative overflow-hidden">
          {/* Progress bar background */}
          <div 
            className="absolute bottom-0 left-0 h-[2px] bg-brand-accent transition-all duration-500 ease-out"
            style={{ width: `${reviewProgress}%` }}
          />

          <div className="flex items-center justify-between p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-lg bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
                <FileCode2 className="text-brand-accent" size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white tracking-tight">Code Review</h2>
                  {status && (
                    <Badge variant="secondary" className="bg-[#121215] text-zinc-300 hover:bg-zinc-800 gap-1 rounded-md px-2 py-0 h-5 border border-zinc-800">
                      <GitPullRequest size={10} />
                      {status.branch}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                  <span className="text-zinc-500">{status?.files.length || 0} changed files</span>
                  {status && (status.totalAdditions > 0 || status.totalDeletions > 0) && (
                    <div className="flex gap-2">
                      <span className="text-emerald-400">+{status.totalAdditions}</span>
                      <span className="text-red-400">-{status.totalDeletions}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {status && status.files.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={allReviewed ? "secondary" : "outline"} 
                      size="sm" 
                      onClick={markAllAsReviewed}
                      className={cn(
                        "h-8 gap-1.5 transition-all",
                        allReviewed ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30" : "border-zinc-800 text-zinc-300"
                      )}
                    >
                      {allReviewed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                      {allReviewed ? "All Reviewed" : "Approve All"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark all files as reviewed</TooltipContent>
                </Tooltip>
              )}
              <div className="w-px h-6 bg-zinc-800 mx-1" />
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-8 gap-1.5 bg-brand-accent hover:bg-brand-accent/90 text-white shadow-[0_0_15px_rgba(var(--brand-accent-rgb),0.3)]"
                    disabled={reviewedFiles.size === 0}
                  >
                    <GitCommit size={14} /> Commit {reviewedFiles.size > 0 && `(${reviewedFiles.size})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-3 bg-[#0a0a0c] border border-zinc-800 shadow-2xl rounded-xl z-[100]">
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-bold text-zinc-300 px-1 uppercase tracking-widest">Commit Changes</p>
                    <textarea
                      value={commitMsg}
                      onChange={e => setCommitMsg(e.target.value)}
                      placeholder="Message (press Ctrl+Enter to commit)"
                      onKeyDown={e => {
                        if (e.key === "Enter" && e.ctrlKey) {
                          e.preventDefault();
                          handleCommit();
                        }
                      }}
                      autoFocus
                      rows={3}
                      className="w-full resize-none bg-[#08080a] border border-zinc-800 rounded-lg px-3 py-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all font-mono leading-relaxed"
                    />
                    <div className="flex justify-end gap-2 mt-1">
                      <Button variant="ghost" size="sm" onClick={() => setPopoverOpen(false)} className="h-7 text-xs text-zinc-400 hover:text-white hover:bg-[#121215]">Cancel</Button>
                      <Button 
                        size="sm" 
                        onClick={handleCommit} 
                        disabled={!commitMsg.trim() || isCommitting}
                        className="h-7 text-xs bg-brand-accent hover:bg-brand-accent/90 text-white shadow-lg shadow-brand-accent/20"
                      >
                        {isCommitting ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Check size={12} className="mr-1.5" />}
                        Commit
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" size="icon" onClick={onClose} className="size-8 text-zinc-400 hover:text-white hover:bg-[#121215]">
                <X size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#070709] custom-scrollbar">
          <div className="p-4 space-y-4 pb-12">
            {loading && !status ? (
              <div className="text-xs font-medium text-zinc-500 text-center py-20 animate-pulse">Analyzing diffs...</div>
            ) : status && status.files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Check size={24} className="text-emerald-500" strokeWidth={3} />
                </div>
                <div className="text-sm font-semibold text-zinc-300">Working tree clean</div>
                <p className="text-[11px] text-zinc-500">No uncommitted changes to review.</p>
              </div>
            ) : (
              status?.files.map(file => {
                const isReviewed = reviewedFiles.has(file.path);
                const isExpanded = expandedFiles.has(file.path);
                
                return (
                  <Collapsible
                    key={file.path}
                    open={isExpanded}
                    onOpenChange={() => toggleFile(file.path)}
                    className={cn(
                      "border rounded-xl bg-zinc-950 overflow-hidden transition-all duration-200",
                      isReviewed ? "border-zinc-800/50 opacity-60 hover:opacity-100" : "border-zinc-800 shadow-lg",
                      isExpanded && !isReviewed ? "ring-1 ring-brand-accent/30 border-brand-accent/30" : ""
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={cn(
                        "flex items-center justify-between p-3 cursor-pointer group transition-colors select-none",
                        isExpanded ? "bg-[#0d0d10] border-b border-zinc-800/60" : "hover:bg-[#0c0c0f]"
                      )}>
                        <div className="flex items-center gap-3 truncate">
                          <button
                            onClick={(e) => toggleReviewed(e, file.path)}
                            className="shrink-0 transition-colors"
                          >
                            {isReviewed ? (
                              <CheckCircle2 size={16} className="text-emerald-500" />
                            ) : (
                              <Circle size={16} className="text-zinc-600 hover:text-brand-accent" />
                            )}
                          </button>
                          
                          <div className={cn(
                            "flex items-center justify-center size-5 rounded transition-transform duration-200",
                            isExpanded ? "rotate-90" : "rotate-0"
                          )}>
                            <ChevronRight size={14} className="text-zinc-500" />
                          </div>

                          <FileIcon filename={file.path} size={14} />
                          
                          <span className={cn(
                            "text-xs font-semibold truncate",
                            isReviewed ? "text-zinc-500 line-through decoration-zinc-700" : "text-zinc-200"
                          )}>
                            {file.path}
                          </span>

                          {(file.status === "??" || file.status.trim() === "A") && (
                            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                              New
                            </Badge>
                          )}

                          {(() => {
                            const count = comments.filter(c => c.filePath === file.path).length;
                            return count > 0 ? (
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 h-4 gap-1 border-brand-accent/30 text-brand-accent bg-brand-accent/5 rounded-md font-mono select-none">
                                <MessageSquare size={10} className="stroke-[2.5]" />
                                {count}
                              </Badge>
                            ) : null;
                          })()}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] font-mono font-bold shrink-0 pl-4">
                          <span className={cn(file.additions > 0 ? "text-emerald-400" : "text-emerald-400/30")}>+{file.additions}</span>
                          <span className={cn(file.deletions > 0 ? "text-red-400" : "text-red-400/30")}>-{file.deletions}</span>
                          
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-6 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Implement external view logic if needed
                            }}
                          >
                            <Eye size={12} className="text-zinc-400" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#0d0d0f]">
                        <table className="w-full border-collapse">
                          <tbody className="align-top">
                            {(() => {
                              let oldLine = 0;
                              let newLine = 0;

                              return file.patch.split('\n').map((line, i) => {
                                if (line.startsWith('---') || line.startsWith('+++')) return null;
                                
                                if (line.startsWith('@@')) {
                                  const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                                  if (match) {
                                    oldLine = parseInt(match[1], 10);
                                    newLine = parseInt(match[2], 10);
                                  }
                                  return (
                                    <tr key={`h-${i}`} className="bg-[#0a0a0d] border-y border-zinc-800/40">
                                      <td colSpan={4} className="px-4 py-1.5 text-zinc-500 text-[10px] select-none text-center">
                                        <span className="opacity-70">••• {line.replace(/@@/g, '').trim()} •••</span>
                                      </td>
                                    </tr>
                                  );
                                }

                                const isAdded = line.startsWith('+');
                                const isRemoved = line.startsWith('-');
                                const content = line.substring(1);
                                const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

                                let rowClass = "text-zinc-300 hover:bg-zinc-800/30";
                                let prefixClass = "text-zinc-600 px-2 py-0.5 select-none w-6 text-center border-r border-transparent";
                                let contentClass = "px-4 py-0.5 whitespace-pre break-all";

                                let currentOldLine: number | string = ' ';
                                let currentNewLine: number | string = ' ';

                                if (isAdded) {
                                  rowClass = "bg-emerald-500/[0.15] text-emerald-200 hover:bg-emerald-500/[0.18]";
                                  prefixClass = "text-emerald-500/70 px-2 py-0.5 select-none w-6 text-center border-r border-emerald-500/20";
                                  currentNewLine = newLine++;
                                } else if (isRemoved) {
                                  rowClass = "bg-red-500/[0.15] text-red-200 hover:bg-red-500/[0.18] line-through decoration-red-500/30";
                                  prefixClass = "text-red-500/70 px-2 py-0.5 select-none w-6 text-center border-r border-red-500/20";
                                  currentOldLine = oldLine++;
                                } else {
                                  currentOldLine = oldLine++;
                                  currentNewLine = newLine++;
                                }

                                const oldLineVal = typeof currentOldLine === 'number' ? currentOldLine : null;
                                const newLineVal = typeof currentNewLine === 'number' ? currentNewLine : null;

                                const lineComments = comments.filter(c => 
                                  c.filePath === file.path &&
                                  c.oldLine === oldLineVal &&
                                  c.newLine === newLineVal
                                );

                                const isCommentingThisLine = commentingLine && 
                                  commentingLine.filePath === file.path &&
                                  commentingLine.oldLine === oldLineVal &&
                                  commentingLine.newLine === newLineVal;

                                return (
                                  <Fragment key={i}>
                                    <tr className={cn("group relative", rowClass)}>
                                      <td className="text-zinc-600/60 text-[10px] px-2 py-0.5 text-right w-12 select-none border-r border-zinc-800/50 bg-[#070709]">{currentOldLine}</td>
                                      <td className="text-zinc-600/60 text-[10px] px-2 py-0.5 text-right w-12 select-none border-r border-zinc-800/50 bg-[#070709]">{currentNewLine}</td>
                                      <td className={cn(prefixClass, "relative group/prefix")}>
                                        <span className="group-hover/prefix:opacity-0">{prefix}</span>
                                        {(oldLineVal !== null || newLineVal !== null) && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCommentingLine({
                                                filePath: file.path,
                                                oldLine: oldLineVal,
                                                newLine: newLineVal
                                              });
                                              setActiveCommentText("");
                                              setEditingCommentId(null);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-black rounded size-4 flex items-center justify-center absolute left-1 top-0.5 z-10"
                                            title="Add comment"
                                          >
                                            <Plus size={10} className="stroke-[3]" />
                                          </button>
                                        )}
                                      </td>
                                      <td className={contentClass}>{highlightLine(content, file.path) || ' '}</td>
                                    </tr>

                                    {lineComments.length > 0 && (
                                      <tr className="bg-[#09090b]/80 border-y border-zinc-900/50">
                                        <td colSpan={4} className="py-2 px-12">
                                          <div className="max-w-3xl space-y-2 py-1 font-sans">
                                            {lineComments.map(comment => (
                                              <div 
                                                key={comment.id} 
                                                className="group/comment bg-[#050507] border border-zinc-800/80 rounded-xl p-3 shadow-inner hover:border-zinc-700/60 transition-all"
                                              >
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                      "text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-widest leading-none font-mono",
                                                      comment.author === "You" 
                                                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                                                        : "bg-pink-500/10 text-pink-400 border border-pink-500/20"
                                                    )}>
                                                      {comment.author}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 font-mono">
                                                      {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                  </div>
                                                  
                                                  <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                                    <button
                                                      onClick={() => startEditComment(comment)}
                                                      className="size-5 rounded hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                                      title="Edit Comment"
                                                    >
                                                      <Edit2 size={10} />
                                                    </button>
                                                    <button
                                                      onClick={() => deleteComment(comment.id)}
                                                      className="size-5 rounded hover:bg-red-500/10 flex items-center justify-center text-zinc-400 hover:text-red-400 transition-colors"
                                                      title="Delete Comment"
                                                    >
                                                      <Trash2 size={10} />
                                                    </button>
                                                  </div>
                                                </div>

                                                <p className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans">
                                                  {comment.commentText}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}

                                    {isCommentingThisLine && (
                                      <tr className="bg-[#0b0b0e] border-y border-zinc-900/60">
                                        <td colSpan={4} className="py-3 px-12">
                                          <div className="max-w-3xl flex flex-col gap-2 font-sans">
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-bold">
                                              <MessageSquare size={10} className="text-brand-accent" />
                                              {editingCommentId ? "Edit Comment" : "Add Comment"}
                                            </div>
                                            <textarea
                                              value={activeCommentText}
                                              onChange={(e) => setActiveCommentText(e.target.value)}
                                              placeholder="Write your review comment here... (press Ctrl+Enter to save)"
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" && e.ctrlKey) {
                                                  e.preventDefault();
                                                  saveComment(oldLineVal, newLineVal, file.path);
                                                }
                                              }}
                                              className="w-full min-h-[75px] bg-[#070709] border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all font-mono leading-relaxed"
                                              autoFocus
                                            />
                                            <div className="flex justify-end gap-2">
                                              <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => {
                                                  setCommentingLine(null);
                                                  setActiveCommentText("");
                                                  setEditingCommentId(null);
                                                }}
                                                className="h-7 text-xs text-zinc-400 hover:text-white"
                                              >
                                                Cancel
                                              </Button>
                                              <Button 
                                                size="sm" 
                                                onClick={() => saveComment(oldLineVal, newLineVal, file.path)}
                                                disabled={!activeCommentText.trim()}
                                                className="h-7 text-xs bg-brand-accent hover:bg-brand-accent/90 text-white font-bold"
                                              >
                                                {editingCommentId ? "Save Change" : "Submit"}
                                              </Button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
