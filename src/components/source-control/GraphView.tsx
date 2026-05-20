import { Search, GitCommit, Loader2 } from "lucide-react";
import { FileIcon } from "./FileIcon";
import { StatusIcon, RefBadge, GitCommitEntry, GitCommitFile } from "./source-control-types";
import { FileDiffViewer } from "./working-tree/FileDiffViewer";

export interface GraphViewProps {
  log: GitCommitEntry[];
  searchTerm: string;
  onSearchChange: (v: string) => void;
  selectedCommit: string | null;
  onCommitClick: (hash: string) => void;
  commitFiles: GitCommitFile[];
  selectedFile: string | null;
  onFileClick: (hash: string, path: string) => void;
  fileDiff: string | null;
  loadingDiff: boolean;
}

export function GraphView({
  log, searchTerm, onSearchChange, selectedCommit, onCommitClick,
  commitFiles, selectedFile, onFileClick, fileDiff, loadingDiff,
}: GraphViewProps) {
  return (
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
              onChange={e => onSearchChange(e.target.value)}
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
                  onClick={() => onCommitClick(entry.hash)}
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
                            onClick={() => onFileClick(entry.hash, file.path)}
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
      <FileDiffViewer
        fileDiff={fileDiff}
        loadingDiff={loadingDiff}
        selectedFile={selectedFile}
      />
    </div>
  );
}
