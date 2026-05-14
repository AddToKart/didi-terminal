import { useState, useEffect } from "react";
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
  Loader2
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
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
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
      <div className="w-[850px] border-l border-white/10 bg-zinc-950/95 backdrop-blur-3xl flex flex-col shadow-2xl z-50 shrink-0 h-full absolute right-0 top-0">
        
        {/* Header */}
        <div className="flex flex-col border-b border-white/5 bg-zinc-900/40 shrink-0 relative overflow-hidden">
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
                    <Badge variant="secondary" className="bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800 gap-1 rounded-md px-2 py-0 h-5">
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
                        allReviewed ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30" : "border-white/10 text-zinc-300"
                      )}
                    >
                      {allReviewed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                      {allReviewed ? "All Reviewed" : "Approve All"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark all files as reviewed</TooltipContent>
                </Tooltip>
              )}
              <div className="w-px h-6 bg-white/10 mx-1" />
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
                <PopoverContent align="end" className="w-80 p-3 bg-zinc-950/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-xl z-[100]">
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
                      className="w-full resize-none bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all font-mono leading-relaxed"
                    />
                    <div className="flex justify-end gap-2 mt-1">
                      <Button variant="ghost" size="sm" onClick={() => setPopoverOpen(false)} className="h-7 text-xs text-zinc-400 hover:text-white hover:bg-white/10">Cancel</Button>
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
              <Button variant="ghost" size="icon" onClick={onClose} className="size-8 text-zinc-400 hover:text-white hover:bg-white/10">
                <X size={16} />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-950/50 custom-scrollbar">
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
                      isReviewed ? "border-white/5 opacity-60 hover:opacity-100" : "border-white/10 shadow-lg",
                      isExpanded && !isReviewed ? "ring-1 ring-brand-accent/30 border-brand-accent/30" : ""
                    )}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={cn(
                        "flex items-center justify-between p-3 cursor-pointer group transition-colors select-none",
                        isExpanded ? "bg-zinc-900/60 border-b border-white/5" : "hover:bg-zinc-900/40"
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
                                    <tr key={`h-${i}`} className="bg-zinc-900/40 border-y border-white/5">
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

                                let rowClass = "text-zinc-300 hover:bg-white/[0.02]";
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

                                return (
                                  <tr key={i} className={rowClass}>
                                    <td className="text-zinc-600/60 text-[10px] px-2 py-0.5 text-right w-12 select-none border-r border-white/5 bg-zinc-950">{currentOldLine}</td>
                                    <td className="text-zinc-600/60 text-[10px] px-2 py-0.5 text-right w-12 select-none border-r border-white/5 bg-zinc-950">{currentNewLine}</td>
                                    <td className={prefixClass}>{prefix}</td>
                                    <td className={contentClass}>{content || ' '}</td>
                                  </tr>
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
