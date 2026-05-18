import { create } from 'zustand';
import type { GitSnapshotRecord } from '../../components/panels/SnapshotPanel';

interface GitState {
  codeReviewStats: { additions: number; deletions: number };
  setCodeReviewStats: (stats: { additions: number; deletions: number } | ((prev: { additions: number; deletions: number }) => { additions: number; deletions: number })) => void;
  
  snapshots: GitSnapshotRecord[];
  setSnapshots: (snapshots: GitSnapshotRecord[] | ((prev: GitSnapshotRecord[]) => GitSnapshotRecord[])) => void;
  
  snapshotBusy: boolean;
  setSnapshotBusy: (busy: boolean) => void;
}

export const useGitStore = create<GitState>((set) => ({
  codeReviewStats: { additions: 0, deletions: 0 },
  setCodeReviewStats: (val) => set((state) => ({ codeReviewStats: typeof val === 'function' ? val(state.codeReviewStats) : val })),
  
  snapshots: [],
  setSnapshots: (val) => set((state) => ({ snapshots: typeof val === 'function' ? val(state.snapshots) : val })),
  
  snapshotBusy: false,
  setSnapshotBusy: (snapshotBusy) => set({ snapshotBusy }),
}));
