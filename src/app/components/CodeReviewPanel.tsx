import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Check, FileDown, Plus, Minus, FileCode2, ChevronRight, ChevronDown, GitCommit } from "lucide-react";

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

  useEffect(() => {
    if (currentProject) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [currentProject]);

  if (!isOpen) return null;

  const toggleFile = (path: string) => {
    const next = new Set(expandedFiles);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedFiles(next);
  };

  return (
    <div className="w-[600px] border-l border-app-border bg-[#0e0e11] flex flex-col shadow-2xl z-50 shrink-0 h-full absolute right-0 top-0">
      <div className="flex items-center justify-between p-4 border-b border-app-border bg-[#0e0e11] shrink-0">
        <div className="flex items-center gap-3">
          <FileCode2 className="text-zinc-400" size={18} />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-wide">Code review</h2>
            {status && (
                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/40 px-2 py-0.5 rounded-full ml-1 border border-zinc-800 flex items-center gap-1.5">
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A1.5 1.5 0 0 1 11 7.5H4.5A1.5 1.5 0 0 0 3 9v2.122a2.25 2.25 0 1 1-1.5 0V5.378a2.25 2.25 0 1 1 1.5 0v3.622A3 3 0 0 1 4.5 6H11a3 3 0 0 0 3-3V5.378a2.25 2.25 0 1 1-1.5 0V3.25Z"></path></svg>
                    {status.branch}
                </span>
            )}
          </div>
          {status && (status.totalAdditions > 0 || status.totalDeletions > 0) && (
            <div className="flex items-center gap-3 font-mono text-[11px] font-bold tracking-tight bg-zinc-900/80 border border-zinc-800 rounded-full px-3 py-1 ml-3 shadow-inner">
              <span className={`flex items-center gap-0.5 ${status.totalAdditions > 0 ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]" : "text-emerald-400/50"}`}>
                <span>+</span>{status.totalAdditions}
              </span>
              <span className={`flex items-center gap-0.5 ${status.totalDeletions > 0 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]" : "text-red-400/50"}`}>
                <span>-</span>{status.totalDeletions}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors border border-zinc-800 hover:border-zinc-700 bg-zinc-900 px-3 py-1.5 rounded-md">
            <Check size={14} /> Commit
          </button>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white transition-colors hover:bg-zinc-800 rounded-md">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && !status ? (
          <div className="text-xs text-zinc-500 text-center py-10">Scanning workspace...</div>
        ) : status && status.files.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-10 flex flex-col items-center gap-2">
            <Check size={24} className="text-emerald-500/50" />
            No uncommitted changes
          </div>
        ) : (
          status?.files.map(file => (
            <div key={file.path} className="border border-zinc-800/80 rounded-lg bg-[#141418] overflow-hidden group">
              <div 
                className="flex items-center justify-between p-2.5 bg-[#18181b] hover:bg-[#1f1f24] cursor-pointer transition-colors border-b border-transparent group-hover:border-zinc-800/50"
                onClick={() => toggleFile(file.path)}
              >
                <div className="flex items-center gap-2 truncate">
                  {expandedFiles.has(file.path) ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                  <span className="text-xs font-medium text-zinc-300 truncate">{file.path}</span>
                  {(file.status === "??" || file.status.trim() === "A") && (
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ml-2">
                      New
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold ml-2">
                    <span className={file.additions > 0 ? "text-emerald-400" : "text-emerald-400/50"}>+{file.additions}</span>
                    <span className={file.deletions > 0 ? "text-red-400" : "text-red-400/50"}>-{file.deletions}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-zinc-500">
                   <button className="opacity-0 group-hover:opacity-100 p-1 hover:text-white transition-all"><GitCommit size={14} /></button>
                </div>
              </div>
              
              {expandedFiles.has(file.path) && (
                <div className="overflow-x-auto text-[11px] font-mono leading-relaxed bg-[#09090b] border-t border-zinc-800/50">
                  <table className="w-full border-collapse">
                    <tbody className="align-top">
                      {(() => {
                        let oldLine = 0;
                        let newLine = 0;

                        return file.patch.split('\n').map((line, i) => {
                          if (line.startsWith('---') || line.startsWith('+++')) return null;
                          if (line.startsWith('@@')) {
                            // Parse @@ -oldLine,oldCount +newLine,newCount @@
                            const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                            if (match) {
                                oldLine = parseInt(match[1], 10);
                                newLine = parseInt(match[2], 10);
                            }
                            return (
                              <tr key={i} className="bg-brand-accent/5">
                                <td colSpan={4} className="px-4 py-2 text-brand-accent/60 font-bold select-none">{line}</td>
                              </tr>
                            );
                          }
                          
                          const isAdded = line.startsWith('+');
                          const isRemoved = line.startsWith('-');
                          const content = line.substring(1);
                          const prefix = isAdded ? '+' : isRemoved ? '-' : ' ';

                          let rowClass = "text-zinc-400 hover:bg-white/[0.02]";
                          let prefixClass = "text-zinc-600 px-3 py-0.5 select-none w-8 text-center border-r border-transparent";
                          let contentClass = "px-4 py-0.5 whitespace-pre";

                          let currentOldLine: number | string = ' ';
                          let currentNewLine: number | string = ' ';

                          if (isAdded) {
                            rowClass = "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15";
                            prefixClass = "text-emerald-500/70 bg-emerald-500/5 px-3 py-0.5 select-none w-8 text-center border-r border-emerald-500/20";
                            currentNewLine = newLine++;
                          } else if (isRemoved) {
                            rowClass = "bg-red-500/10 text-red-300 hover:bg-red-500/15";
                            prefixClass = "text-red-500/70 bg-red-500/5 px-3 py-0.5 select-none w-8 text-center border-r border-red-500/20";
                            currentOldLine = oldLine++;
                          } else {
                            currentOldLine = oldLine++;
                            currentNewLine = newLine++;
                          }

                          return (
                            <tr key={i} className={rowClass}>
                              <td className="text-zinc-600/50 text-[10px] px-2 py-0.5 text-right w-10 select-none border-r border-zinc-800/50 bg-[#0a0a0c]">{currentOldLine}</td>
                              <td className="text-zinc-600/50 text-[10px] px-2 py-0.5 text-right w-10 select-none border-r border-zinc-800/50 bg-[#0a0a0c]">{currentNewLine}</td>
                              <td className={prefixClass}>{prefix}</td>
                              <td className={contentClass}>{content || ' '}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
