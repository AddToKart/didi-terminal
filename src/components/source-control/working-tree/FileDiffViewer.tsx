import { GitCommit, Loader2 } from "lucide-react";
import { FileIcon } from "../FileIcon";

export interface FileDiffViewerProps {
  fileDiff: string | null;
  loadingDiff: boolean;
  selectedFile: string | null;
}

export function FileDiffViewer({ fileDiff, loadingDiff, selectedFile }: FileDiffViewerProps) {
  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#08080a] relative">
        <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 p-6 text-center">
          <div className="size-16 rounded-full border border-dashed border-zinc-700 flex items-center justify-center bg-zinc-900/50">
            <GitCommit size={28} className="text-zinc-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-400 mb-1">Select a file to view changes</p>
            <p className="text-xs">Click on a commit in the sidebar, then select a file to see its diff.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#08080a] relative">
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
    </div>
  );
}
