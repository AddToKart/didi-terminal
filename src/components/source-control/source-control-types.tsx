import { AlertCircle } from "lucide-react";

// --- Shared Type Interfaces ---

export interface GitPanelFile {
  path: string;
  status: string;
  statusLabel: string;
}

export interface GitPanelStatus {
  branch: string;
  remote: string;
  staged: GitPanelFile[];
  unstaged: GitPanelFile[];
}

export interface GitCommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

export interface GitBranchInfo {
  name: string;
  isCurrent: boolean;
  lastCommit: string;
  date: string;
}

export interface GitCommitFile {
  path: string;
  status: string;
}

// --- Shared Helper Components ---

export function StatusIcon({ status }: { status: string }) {
  const s = status.trim();
  if (s === "M") return <span className="text-amber-500 text-[10px] font-black w-3 text-center" title="Modified">M</span>;
  if (s === "A") return <span className="text-emerald-500 text-[10px] font-black w-3 text-center" title="Added">A</span>;
  if (s === "D") return <span className="text-red-500 text-[10px] font-black w-3 text-center" title="Deleted">D</span>;
  if (s === "R") return <span className="text-blue-500 text-[10px] font-black w-3 text-center" title="Renamed">R</span>;
  if (s === "??") return <span className="text-zinc-500 text-[10px] font-black w-3 text-center" title="Untracked">U</span>;
  if (s === "U") return <AlertCircle size={10} className="text-orange-500" />;
  return <div className="w-3" />;
}

export function RefBadge({ refs }: { refs: string }) {
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
