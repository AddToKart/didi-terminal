import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch, X, RefreshCw, Plus, Minus, RotateCcw, Upload, Download,
  GitCommit, ChevronDown, ChevronRight, Check, Loader2, GitMerge,
  FileText, FilePlus, FileMinus, FileX, AlertCircle
} from "lucide-react";
import { FileIcon } from "./FileIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GitPanelFile {
  path: string;
  status: string;
  statusLabel: string;
}

interface GitPanelStatus {
  branch: string;
  remote: string;
  staged: GitPanelFile[];
  unstaged: GitPanelFile[];
}

interface GitCommitEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  refs: string;
}

interface GitPanelProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  const s = status.trim();
  if (s === "M") return <span className="text-amber-500 text-[10px] font-black w-3 text-center" title="Modified">M</span>;
  if (s === "A") return <span className="text-emerald-500 text-[10px] font-black w-3 text-center" title="Added">A</span>;
  if (s === "D") return <span className="text-red-500 text-[10px] font-black w-3 text-center" title="Deleted">D</span>;
  if (s === "R") return <span className="text-blue-500 text-[10px] font-black w-3 text-center" title="Renamed">R</span>;
  if (s === "??") return <span className="text-zinc-500 text-[10px] font-black w-3 text-center" title="Untracked">U</span>;
  if (s === "U") return <AlertCircle size={10} className="text-orange-500" />;
  return <div className="w-3" />;
}

function RefBadge({ refs }: { refs: string }) {
  if (!refs) return null;
  
  // Clean and deduplicate ref names
  const rawParts = refs.split(",").map(r => r.trim()).filter(Boolean);
  const uniqueRefs = new Map<string, { original: string, clean: string }>();
  
  rawParts.forEach(r => {
    const clean = r.replace("HEAD -> ", "").replace("origin/", "").trim();
    if (!uniqueRefs.has(clean)) {
      uniqueRefs.set(clean, { original: r, clean });
    } else {
      // If we already have this name, but the new one has HEAD, prefer the HEAD version for styling
      if (r.includes("HEAD")) {
        uniqueRefs.set(clean, { original: r, clean });
      }
    }
  });

  const partsToRender = Array.from(uniqueRefs.values()).slice(0, 3);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {partsToRender.map((refData, i) => {
        const isHead = refData.original.includes("HEAD");
        const isOrigin = refData.original.includes("origin");
        const isMain = refData.original.includes("main") || refData.original.includes("master");
        
        let bg = "bg-zinc-800 text-zinc-400";
        if (isHead) bg = "bg-brand-accent/20 text-brand-accent";
        else if (isOrigin && isMain) bg = "bg-emerald-500/10 text-emerald-400";
        else if (isOrigin) bg = "bg-blue-500/10 text-blue-400";
        
        return (
          <span key={i} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border border-white/5 ${bg}`}>
            {refData.clean}
          </span>
        );
      })}
    </div>
  );
}

// ── FileRow ───────────────────────────────────────────────────────────────────

function FileRow({
  file, actionIcon, actionTitle, onAction, secondaryIcon, secondaryTitle, onSecondaryAction
}: {
  file: GitPanelFile;
  actionIcon: React.ReactNode;
  actionTitle: string;
  onAction: () => void;
  secondaryIcon?: React.ReactNode;
  secondaryTitle?: string;
  onSecondaryAction?: () => void;
}) {
  const basename = file.path.split("/").pop()?.split("\\").pop() ?? file.path;
  const dir = file.path.substring(0, file.path.length - basename.length);
  return (
    <div className="group flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800/40 rounded-md transition-colors gap-2">
      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <StatusIcon status={file.status} />
          <FileIcon filename={basename} size={14} />
        </div>
        <div className="truncate">
          <span className="text-[11px] text-zinc-200 font-medium">{basename}</span>
          {dir && <span className="text-[9px] text-zinc-500 ml-1">{dir}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {secondaryIcon && (
          <button
            onClick={onSecondaryAction}
            title={secondaryTitle}
            className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            {secondaryIcon}
          </button>
        )}
        <button
          onClick={onAction}
          title={actionTitle}
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors"
        >
          {actionIcon}
        </button>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, count, children, expanded, onToggle, actions
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-800/50 last:border-0">
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-zinc-800/20 transition-colors select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={13} className="text-zinc-500" /> : <ChevronRight size={13} className="text-zinc-500" />}
          <span className="text-[11px] font-bold text-zinc-300">{title}</span>
          <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full">{count}</span>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      </div>
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

// ── GitPanel ──────────────────────────────────────────────────────────────────

export function GitPanel({ currentProject, isOpen, onClose }: GitPanelProps) {
  const [status, setStatus] = useState<GitPanelStatus | null>(null);
  const [log, setLog] = useState<GitCommitEntry[]>([]);
  const [commitMsg, setCommitMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is running
  const [expandStaged, setExpandStaged] = useState(true);
  const [expandUnstaged, setExpandUnstaged] = useState(true);
  const [expandHistory, setExpandHistory] = useState(true);

  const flash = (text: string, ok = true) => {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 3500);
  };

  const refresh = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        invoke<GitPanelStatus>("git_panel_get_status", { cwd: currentProject }),
        invoke<GitCommitEntry[]>("git_panel_get_log", { cwd: currentProject, limit: 50 }),
      ]);
      setStatus(s);
      setLog(l);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (isOpen && currentProject) {
      refresh();
      const id = setInterval(refresh, 6000);
      return () => clearInterval(id);
    }
  }, [isOpen, currentProject, refresh]);

  if (!isOpen) return null;

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key);
    try {
      const msg = await fn();
      flash(msg);
    } catch (e) {
      flash(String(e), false);
    } finally {
      setBusy(null);
      // Always refresh so the UI reflects the real git state
      await refresh();
    }
  };

  const stage = (path: string) =>
    run("stage:" + path, () => invoke("git_panel_stage", { cwd: currentProject!, path }));
  const stageAll = () =>
    run("stageAll", () => invoke("git_panel_stage_all", { cwd: currentProject! }));
  const unstage = (path: string) =>
    run("unstage:" + path, () => invoke("git_panel_unstage", { cwd: currentProject!, path }));
  const discard = (path: string) =>
    run("discard:" + path, () => invoke("git_panel_discard", { cwd: currentProject!, path }));
  const commit = () =>
    run("commit", async () => {
      const r: string = await invoke("git_panel_commit", { cwd: currentProject!, message: commitMsg });
      setCommitMsg("");
      return r;
    });
  const pull = () =>
    run("pull", () => invoke("git_panel_pull", { cwd: currentProject! }));
  const push = () =>
    run("push", () => invoke("git_panel_push", { cwd: currentProject! }));

  const Spinner = ({ k }: { k: string }) =>
    busy === k ? <Loader2 size={11} className="animate-spin" /> : null;

  return (
    <div className="w-[400px] shrink-0 border-l border-app-border bg-[#0d0d10] flex flex-col shadow-2xl z-50 h-full absolute right-0 top-0 select-none">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app-border bg-[#0e0e12] shrink-0">
        <div className="flex items-center gap-2">
          <GitMerge size={15} className="text-brand-accent" />
          <span className="text-sm font-bold text-white">Source Control</span>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-zinc-800/60 border border-zinc-700/50 px-2.5 py-1 rounded-full">
              <GitBranch size={10} className="text-brand-accent" />
              <span className="text-zinc-300">{status.branch}</span>
            </div>
          )}
          <button
            onClick={refresh}
            className={`p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors ${loading ? "animate-spin" : ""}`}
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Commit area */}
      <div className="px-3 pt-3 pb-2 border-b border-zinc-800/50 shrink-0">
        <textarea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="Message (press Ctrl+Enter to commit)"
          onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) commit(); }}
          rows={3}
          className="w-full resize-none bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all font-mono leading-relaxed"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={commit}
            disabled={!commitMsg.trim() || !!busy}
            className="flex-1 flex items-center justify-center gap-1.5 bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold py-1.5 rounded-lg transition-colors"
          >
            {busy === "commit" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Commit
          </button>
          <button
            onClick={pull}
            disabled={!!busy}
            className="flex items-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 disabled:opacity-40 border border-zinc-700/50 text-zinc-300 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
            title="Pull (rebase)"
          >
            {busy === "pull" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Pull
          </button>
          <button
            onClick={push}
            disabled={!!busy}
            className="flex items-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700/60 disabled:opacity-40 border border-zinc-700/50 text-zinc-300 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
            title="Push to origin"
          >
            {busy === "push" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Push
          </button>
        </div>
      </div>

      {/* Action flash message */}
      {actionMsg && (
        <div className={`mx-3 mt-2 px-3 py-2 rounded-lg text-[10px] font-medium border ${actionMsg.ok ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-red-500/10 text-red-300 border-red-500/20"}`}>
          {actionMsg.text}
        </div>
      )}

      {/* File lists */}
      <div className="flex-1 overflow-y-auto">
        {!status && !loading && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-600">
            <GitMerge size={22} />
            <p className="text-xs">No git repo detected</p>
          </div>
        )}

        {/* Staged Changes */}
        {status && (
          <Section
            title="Staged Changes"
            count={status.staged.length}
            expanded={expandStaged}
            onToggle={() => setExpandStaged(v => !v)}
            actions={
              <>
                {status.staged.length > 0 && (
                  <button
                    onClick={() => status.staged.forEach(f => unstage(f.path))}
                    title="Unstage All"
                    className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                )}
              </>
            }
          >
            {status.staged.length === 0 ? (
              <p className="text-[10px] text-zinc-600 px-3 py-2 italic">Nothing staged</p>
            ) : (
              status.staged.map(f => (
                <FileRow
                  key={f.path}
                  file={f}
                  actionIcon={<Minus size={12} />}
                  actionTitle="Unstage"
                  onAction={() => unstage(f.path)}
                />
              ))
            )}
          </Section>
        )}

        {/* Unstaged Changes */}
        {status && (
          <Section
            title="Changes"
            count={status.unstaged.length}
            expanded={expandUnstaged}
            onToggle={() => setExpandUnstaged(v => !v)}
            actions={
              <>
                {status.unstaged.length > 0 && (
                  <>
                    <button
                      onClick={stageAll}
                      title="Stage All"
                      className="p-1 rounded text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </>
                )}
              </>
            }
          >
            {status.unstaged.length === 0 ? (
              <p className="text-[10px] text-zinc-600 px-3 py-2 italic">No changes</p>
            ) : (
              status.unstaged.map(f => (
                <FileRow
                  key={f.path}
                  file={f}
                  actionIcon={<Plus size={12} />}
                  actionTitle="Stage"
                  onAction={() => stage(f.path)}
                  secondaryIcon={<RotateCcw size={11} />}
                  secondaryTitle="Discard changes"
                  onSecondaryAction={() => discard(f.path)}
                />
              ))
            )}
          </Section>
        )}

        {/* History */}
        <Section
          title="History"
          count={log.length}
          expanded={expandHistory}
          onToggle={() => setExpandHistory(v => !v)}
          actions={
            <button onClick={refresh} className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition-colors" title="Refresh history">
              <RefreshCw size={11} />
            </button>
          }
        >
          {log.length === 0 ? (
            <p className="text-[10px] text-zinc-600 px-3 py-2 italic">No commits yet</p>
          ) : (
            log.map(entry => (
              <div key={entry.hash} className="flex items-start gap-2.5 px-3 py-2 hover:bg-zinc-800/30 rounded-md transition-colors group">
                <div className="mt-0.5 w-2 h-2 rounded-full border-2 border-zinc-600 bg-zinc-900 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2 flex-wrap">
                    <p className="text-[11px] text-zinc-200 font-medium leading-snug break-all">{entry.message}</p>
                    {entry.refs && <RefBadge refs={entry.refs} />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-mono text-brand-accent/70 bg-brand-accent/10 px-1.5 py-0.5 rounded">{entry.shortHash}</span>
                    <span className="text-[9px] text-zinc-500">{entry.author}</span>
                    <span className="text-[9px] text-zinc-600">{entry.date}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </Section>
      </div>
    </div>
  );
}
