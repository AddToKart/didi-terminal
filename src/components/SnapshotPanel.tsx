import { RotateCcw, GitCommitHorizontal, Camera } from "lucide-react";

export interface GitSnapshotRecord {
  id: string;
  commit: string;
  cwd: string;
  taskId: string;
  label: string;
  agent: string;
  createdAt: number;
}

interface Props {
  currentProject: string | null;
  snapshots: GitSnapshotRecord[];
  isBusy: boolean;
  onSnapshot: () => void;
  onRewind: (snapshot: GitSnapshotRecord) => void;
}

const formatSnapshotTime = (createdAt: number) => {
  if (!createdAt) return "";
  return new Date(createdAt * 1000).toLocaleTimeString();
};

export const SnapshotPanel = ({ currentProject, snapshots, isBusy, onSnapshot, onRewind }: Props) => (
  <div className="h-44 flex flex-col min-h-0 border-b border-app-border bg-[#050506]">
    <div className="p-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between border-b border-app-border">
      <span className="flex items-center gap-2">
        <GitCommitHorizontal size={12} />
        Time Travel
      </span>
      <button
        type="button"
        disabled={!currentProject || isBusy}
        onClick={onSnapshot}
        className="p-1 border border-app-border bg-black text-slate-500 hover:text-brand-cyan hover:border-brand-cyan/40 disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:border-app-border transition-colors"
        title="Create Snapshot"
      >
        <Camera size={12} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {!currentProject ? (
        <div className="text-[11px] text-slate-600 px-2 py-2">Select a workspace to enable snapshots</div>
      ) : snapshots.length === 0 ? (
        <div className="text-[11px] text-slate-600 px-2 py-2">No snapshots yet</div>
      ) : (
        snapshots.slice(0, 6).map(snapshot => (
          <div key={snapshot.id} className="border border-app-border bg-black px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-brand-cyan truncate">{snapshot.agent || "Manual"}</span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onRewind(snapshot)}
                className="text-slate-500 hover:text-brand-amber disabled:opacity-40 transition-colors"
                title="Rewind Workspace"
              >
                <RotateCcw size={12} />
              </button>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-1">{snapshot.label || "Workspace snapshot"}</div>
            <div className="text-[9px] text-slate-600 mt-1 font-mono">
              {snapshot.commit.slice(0, 8)} {formatSnapshotTime(snapshot.createdAt)}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
