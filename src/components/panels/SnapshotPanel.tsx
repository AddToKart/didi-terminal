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
  <div className="shrink-0 flex flex-col min-h-0 border-b border-app-border bg-zinc-900/10">
    <div className="px-4 py-2.5 text-xs font-semibold text-zinc-400 bg-zinc-950/40 flex items-center justify-between border-b border-app-border">
      <span className="flex items-center gap-2">
        <GitCommitHorizontal size={14} />
        Time Travel
      </span>
      <button
        type="button"
        disabled={!currentProject || isBusy}
        onClick={onSnapshot}
        className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:hover:text-zinc-500"
        title="Create Snapshot"
      >
        <Camera size={14} />
      </button>
    </div>
    <div className="p-3 space-y-2">
      {!currentProject ? (
        <div className="text-xs text-zinc-500">Select a workspace to enable snapshots</div>
      ) : snapshots.length === 0 ? (
        <div className="text-xs text-zinc-500">No snapshots yet</div>
      ) : (
        snapshots.slice(0, 6).map(snapshot => (
          <div key={snapshot.id} className="border border-zinc-800/50 bg-zinc-950/50 px-3 py-2 rounded-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300 truncate">{snapshot.agent || "Manual"}</span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onRewind(snapshot)}
                className="text-zinc-500 hover:text-amber-400 disabled:opacity-40 transition-colors"
                title="Rewind Workspace"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="text-xs text-zinc-500 truncate mt-1">{snapshot.label || "Workspace snapshot"}</div>
            <div className="text-[10px] text-zinc-600 mt-1.5 font-mono">
              {snapshot.commit.slice(0, 8)} {formatSnapshotTime(snapshot.createdAt)}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
