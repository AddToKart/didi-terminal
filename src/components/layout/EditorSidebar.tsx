import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileCode2,
  FileJson,
  FileText,
  RefreshCw,
} from "lucide-react";
import type { EditorFileEntry } from "@/types/editor.types";
import { useEditorStore } from "@/services/stores/editor-store";
import { cn } from "@/lib/cn";

interface EditorSidebarProps {
  root: string;
}

// Skip heavy build/vendor dirs at root level
const IGNORED_ROOT_DIRS = new Set([
  "node_modules",
  "target",
  "dist",
  "build",
  ".git",
  ".vite",
  "out",
  "__pycache__",
]);

function getFileIcon(ext: string | null | undefined) {
  if (!ext) return <File size={13} className="text-zinc-500 shrink-0" />;
  switch (ext.toLowerCase()) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "rs":
    case "py":
    case "css":
    case "scss":
    case "html":
      return <FileCode2 size={13} className="text-sky-400/80 shrink-0" />;
    case "json":
    case "toml":
    case "yaml":
    case "yml":
      return <FileJson size={13} className="text-emerald-400/80 shrink-0" />;
    case "md":
    case "mdx":
    case "txt":
      return <FileText size={13} className="text-zinc-400 shrink-0" />;
    default:
      return <File size={13} className="text-zinc-500 shrink-0" />;
  }
}

function getLanguage(ext: string | null | undefined): string {
  if (!ext) return "text";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    rs: "rust", py: "python", css: "css", scss: "scss",
    html: "html", json: "json", jsonc: "json", toml: "text",
    yaml: "text", yml: "text", md: "markdown", mdx: "mdx",
    txt: "text", sh: "text", ps1: "text",
  };
  return map[ext.toLowerCase()] ?? "text";
}

interface FileNodeProps {
  entry: EditorFileEntry;
  root: string;
  depth: number;
}

function FileNode({ entry, root, depth }: FileNodeProps) {
  const [children, setChildren] = useState<EditorFileEntry[]>([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const { toggleDir, expandedDirs, openTab } = useEditorStore();

  const loadChildren = useCallback(async () => {
    if (!entry.is_dir || childrenLoaded) return;
    try {
      const result = await invoke<EditorFileEntry[]>("list_directory", {
        path: entry.path,
        root,
      });
      setChildren(result.filter((e) => {
        if (e.is_dir && depth === 0 && IGNORED_ROOT_DIRS.has(e.name)) return false;
        if (e.name.startsWith(".") && e.is_dir) return false;
        return true;
      }));
      setChildrenLoaded(true);
    } catch (err) {
      console.error("Failed to list directory:", err);
    }
  }, [entry, root, depth, childrenLoaded]);

  const handleToggle = useCallback(async () => {
    toggleDir(entry.path);
    if (!childrenLoaded) await loadChildren();
  }, [toggleDir, entry.path, childrenLoaded, loadChildren]);

  const handleOpenFile = useCallback(async () => {
    try {
      const content = await invoke<string>("read_file_content", {
        path: entry.path,
        root,
      });
      openTab({
        id: `tab-${entry.path}`,
        filePath: entry.path,
        fileName: entry.name,
        language: getLanguage(entry.extension),
        content,
        isDirty: false,
      });
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [entry, root, openTab]);

  const indent = depth * 12;

  if (entry.is_dir) {
    const expanded = expandedDirs.has(entry.path);
    return (
      <>
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-1.5 py-[3px] px-2 hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 transition-colors group"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {expanded
            ? <ChevronDown size={12} className="shrink-0 text-zinc-600" />
            : <ChevronRight size={12} className="shrink-0 text-zinc-600" />
          }
          {expanded
            ? <FolderOpen size={13} className="text-sky-400/80 shrink-0" />
            : <Folder size={13} className="text-zinc-500/80 shrink-0" />
          }
          <span className="text-[12px] font-medium truncate">{entry.name}</span>
        </button>
        {expanded && childrenLoaded && children.map((child) => (
          <FileNode
            key={child.path}
            entry={child}
            root={root}
            depth={depth + 1}
          />
        ))}
      </>
    );
  }

  return (
    <button
      onClick={handleOpenFile}
      className="w-full flex items-center gap-1.5 py-[3px] px-2 hover:bg-zinc-800/50 text-zinc-500 hover:text-zinc-200 transition-colors"
      style={{ paddingLeft: `${20 + indent}px` }}
    >
      {getFileIcon(entry.extension)}
      <span className="text-[12px] truncate">{entry.name}</span>
    </button>
  );
}

export function EditorSidebar({ root }: EditorSidebarProps) {
  const [rootEntries, setRootEntries] = useState<EditorFileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<EditorFileEntry[]>("list_directory", { path: root, root });
      setRootEntries(
        result.filter((e) => {
          if (e.is_dir && IGNORED_ROOT_DIRS.has(e.name)) return false;
          if (e.name.startsWith(".") && e.is_dir) return false;
          return true;
        })
      );
    } catch (err) {
      console.error("Failed to load root directory:", err);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    if (root) loadRoot();
  }, [root, loadRoot]);

  const projectName = root.split(/[\\/]/).pop() ?? root;

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800 select-none">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Explorer</span>
          <span className="text-[10px] font-mono text-zinc-500 truncate">{projectName}</span>
        </div>
        <button
          onClick={loadRoot}
          disabled={loading}
          className="p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-zinc-300 transition-all disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={11} className={cn(loading && "animate-spin")} />
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {loading && rootEntries.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={14} className="animate-spin text-zinc-600" />
          </div>
        ) : rootEntries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] text-zinc-600">No files found</p>
          </div>
        ) : (
          rootEntries.map((entry) => (
            <FileNode
              key={entry.path}
              entry={entry}
              root={root}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
}
