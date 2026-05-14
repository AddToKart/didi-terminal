import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  FileText,
  Search,
  RefreshCw,
  Save,
  Edit3,
  Eye,
  FileCode,
  Folder,
  ChevronRight,
  File,
  Sidebar,
  ListTree,
  Copy,
  Check,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension: string | null;
}

interface MdViewerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TocEntry {
  level: number;
  text: string;
  anchor: string;
}

const MARKDOWN_EXTENSIONS = new Set(["md", "mdx"]);

function isMarkdownFile(entry: FileEntry): boolean {
  return entry.extension !== null && MARKDOWN_EXTENSIONS.has(entry.extension.toLowerCase());
}

const FILE_ICONS: Record<string, string> = {
  md: "text-blue-400",
  mdx: "text-purple-400",
};

function getFileIcon(entry: FileEntry) {
  const ext = entry.extension?.toLowerCase() || "";
  return FILE_ICONS[ext] || "text-zinc-400";
}

function getFileLabel(entry: FileEntry) {
  const ext = entry.extension?.toLowerCase() || "";
  if (ext === "md") return "Markdown";
  if (ext === "mdx") return "MDX";
  return "File";
}

function getFileIconComponent(entry: FileEntry) {
  if (entry.is_dir) return Folder;
  const ext = entry.extension?.toLowerCase() || "";
  if (ext === "md" || ext === "mdx") return FileText;
  return File;
}

function renderMarkdownPreview(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, (_, t) => `<h3 id="${encodeURIComponent(t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}">${t}</h3>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2 id="${encodeURIComponent(t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}">${t}</h2>`)
    .replace(/^# (.+)$/gm, (_, t) => `<h1 id="${encodeURIComponent(t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}">${t}</h1>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`{3}(\w*)\n([\s\S]*?)`{3}/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline hover:text-blue-300">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  html = "<p>" + html + "</p>";
  return html;
}

function extractToc(text: string): TocEntry[] {
  const toc: TocEntry[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(text)) !== null) {
    toc.push({
      level: match[1].length,
      text: match[2],
      anchor: encodeURIComponent(match[2].toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")),
    });
  }
  return toc;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function countLines(text: string): number {
  return text ? text.split("\n").length : 0;
}

export function MdViewer({ currentProject, isOpen, onClose }: MdViewerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState<string>("");
  const [dirHistory, setDirHistory] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [content, setContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [findText, setFindText] = useState("");
  const [showFind, setShowFind] = useState(false);
  const [copied, setCopied] = useState(false);

  const toc = useMemo(() => extractToc(content), [content]);
  const wordCount = useMemo(() => countWords(content), [content]);
  const lineCount = useMemo(() => countLines(content), [content]);
  const charCount = content.length;

  const sidebarVisible = sidebarOpen && (!isPreview || !selectedFile || isEditing);

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path: dirPath });
      const sorted = [...result].sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setCurrentDir(dirPath);
    } catch (err) {
      setError(`Failed to load directory: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFileContent = useCallback(async (filePath: string) => {
    setContentLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("read_file_content", { path: filePath });
      setContent(result);
      setEditContent(result);
      setIsEditing(false);
    } catch (err) {
      setError(`Failed to read file: ${err}`);
      setContent("");
      setEditContent("");
    } finally {
      setContentLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      await invoke("write_file_content", { path: selectedFile.path, content: editContent });
      setContent(editContent);
      setIsEditing(false);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEntry = (entry: FileEntry) => {
    if (entry.is_dir) {
      setDirHistory(prev => [...prev, currentDir]);
      loadDirectory(entry.path);
      setSelectedFile(null);
      setContent("");
      setEditContent("");
      setIsEditing(false);
      return;
    }
    setSelectedFile(entry);
    loadFileContent(entry.path);
  };

  const handleGoBack = () => {
    if (dirHistory.length === 0) return;
    const prev = dirHistory[dirHistory.length - 1];
    setDirHistory(prev => prev.slice(0, -1));
    loadDirectory(prev);
    setSelectedFile(null);
    setContent("");
    setEditContent("");
    setIsEditing(false);
  };

  const handleRefresh = () => {
    if (currentDir) loadDirectory(currentDir);
    if (selectedFile) loadFileContent(selectedFile.path);
  };

  const handleCancelEdit = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback ignored
    }
  };

  const handleEnterEdit = () => {
    setIsEditing(true);
    setIsPreview(true);
    setSidebarOpen(true);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      setShowFind(prev => !prev);
      setFindText("");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && isEditing) {
      e.preventDefault();
      handleSave();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !currentProject) return;
    setSelectedFile(null);
    setContent("");
    setEditContent("");
    setIsEditing(false);
    setIsPreview(true);
    setDirHistory([]);
    setSearchTerm("");
    setError(null);
    setSidebarOpen(true);
    setIsFullscreen(false);
    setShowFind(false);
    setFindText("");
    loadDirectory(currentProject);
  }, [isOpen, currentProject, loadDirectory]);

  const markdownFiles = entries.filter(e => !e.is_dir && isMarkdownFile(e));
  const otherFiles = entries.filter(e => !e.is_dir && !isMarkdownFile(e));
  const directories = entries.filter(e => e.is_dir);

  const filteredMarkdown = markdownFiles.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredOther = otherFiles.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredDirs = directories.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const findMatches = useMemo(() => {
    if (!findText || !content) return [];
    const lower = findText.toLowerCase();
    const lines = content.split("\n");
    return lines.reduce<number[]>((acc, line, i) => {
      if (line.toLowerCase().includes(lower)) acc.push(i + 1);
      return acc;
    }, []);
  }, [findText, content]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-2 pointer-events-none">
        <div className={`bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ${isFullscreen ? "w-full h-full" : "w-full max-w-7xl h-[85vh]"}`}>

          {/* Header */}
          <div className="px-5 py-4 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Markdown Viewer</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                    {currentDir ? currentDir.replace(/^.*[\\/]/, "") : "No project"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Sidebar toggle */}
              {selectedFile && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${sidebarOpen ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}
                  title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                >
                  <Sidebar size={14} />
                </button>
              )}

              {/* Search bar */}
              <div className="relative flex-1 max-w-sm group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-blue-500 transition-colors">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Filter files..."
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex min-h-0">
            {/* Sidebar - file tree */}
            {sidebarVisible && (
              <div className="w-64 border-r border-white/5 bg-black/20 flex flex-col shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {dirHistory.length > 0 && (
                      <button
                        onClick={handleGoBack}
                        className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
                        title="Go back"
                      >
                        <ChevronRight size={14} className="rotate-180" />
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      {dirHistory.length === 0 ? "Workspace Root" : currentDir.replace(/^.*[\\/]/, "")}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <RefreshCw size={16} className="animate-spin text-zinc-500" />
                    </div>
                  ) : error && entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                      <FileCode size={32} className="text-zinc-600 mb-2" />
                      <p className="text-[11px] text-zinc-500">{error}</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {filteredDirs.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                            Directories
                          </div>
                          {filteredDirs.map((entry) => {
                            const Icon = getFileIconComponent(entry);
                            return (
                              <button
                                key={entry.path}
                                onClick={() => handleSelectEntry(entry)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                              >
                                <Icon size={14} className="text-zinc-600 shrink-0" />
                                <span className="truncate">{entry.name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}

                      {filteredMarkdown.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">
                            Markdown ({filteredMarkdown.length})
                          </div>
                          {filteredMarkdown.map((entry) => {
                            const Icon = getFileIconComponent(entry);
                            const isActive = selectedFile?.path === entry.path;
                            return (
                              <button
                                key={entry.path}
                                onClick={() => handleSelectEntry(entry)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left ${isActive ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'}`}
                              >
                                <Icon size={14} className={`${getFileIcon(entry)} shrink-0`} />
                                <span className="truncate flex-1">{entry.name}</span>
                                <span className="text-[9px] text-zinc-600 font-mono">{getFileLabel(entry)}</span>
                              </button>
                            );
                          })}
                        </>
                      )}

                      {filteredOther.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">
                            Other Files
                          </div>
                          {filteredOther.map((entry) => {
                            const Icon = getFileIconComponent(entry);
                            const isActive = selectedFile?.path === entry.path;
                            return (
                              <button
                                key={entry.path}
                                onClick={() => handleSelectEntry(entry)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left ${isActive ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'}`}
                              >
                                <Icon size={14} className="text-zinc-600 shrink-0" />
                                <span className="truncate">{entry.name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}

                      {filteredDirs.length === 0 && filteredMarkdown.length === 0 && filteredOther.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-40">
                          <FileText size={32} className="text-zinc-600 mb-2" />
                          <p className="text-xs text-zinc-500">No files found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-black/10">
              {selectedFile ? (
                <>
                  {/* Content Toolbar */}
                  <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 bg-zinc-900/30 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-zinc-300 truncate">{selectedFile.name}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {new Intl.NumberFormat().format(selectedFile.size)} B
                      </span>
                      <span className="text-[9px] text-zinc-600 font-mono">
                        {lineCount} lines
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => setIsPreview(!isPreview)}
                            className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${isPreview ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                            title={isPreview ? "Show raw" : "Show preview"}
                          >
                            {isPreview ? <Eye size={14} /> : <FileCode size={14} />}
                            {isPreview ? "Preview" : "Raw"}
                          </button>
                          <button
                            onClick={handleCopyContent}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all"
                            title="Copy content"
                          >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={handleEnterEdit}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          {isPreview && !isEditing && toc.length > 0 && (
                            <button
                              onClick={() => setSidebarOpen(!sidebarOpen)}
                              className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${sidebarOpen ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                              title="Table of contents"
                            >
                              <ListTree size={14} />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setShowFind(!showFind)}
                            className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${showFind ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                            title="Find in file (Ctrl+F)"
                          >
                            <Search size={14} />
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-white/10 disabled:text-zinc-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95"
                          >
                            <Save size={14} />
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Find bar */}
                  {showFind && isEditing && (
                    <div className="flex items-center gap-3 px-6 py-2 border-b border-white/5 bg-zinc-900/20 shrink-0">
                      <Search size={12} className="text-zinc-500 shrink-0" />
                      <input
                        type="text"
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        placeholder="Find in file..."
                        className="flex-1 bg-black/40 border border-white/5 rounded px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/30 transition-all"
                        autoFocus
                      />
                      {findText && (
                        <span className="text-[10px] text-zinc-500 font-mono whitespace-nowrap">
                          {findMatches.length} match{findMatches.length !== 1 ? "es" : ""}
                        </span>
                      )}
                      <button
                        onClick={() => { setShowFind(false); setFindText(""); }}
                        className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  {/* Content Body */}
                  <div className="flex-1 flex min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {contentLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <RefreshCw size={20} className="animate-spin text-zinc-500" />
                        </div>
                      ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in">
                          <div className="p-3 bg-red-500/10 rounded-lg text-red-500 mb-3 border border-red-500/20">
                            <X size={24} />
                          </div>
                          <p className="text-sm font-bold text-white mb-1">Read Error</p>
                          <p className="text-[11px] text-zinc-500">{error}</p>
                          <button
                            onClick={() => loadFileContent(selectedFile.path)}
                            className="mt-4 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex h-full">
                          {/* Line numbers */}
                          <div className="select-none text-right px-3 py-6 text-[11px] font-mono leading-relaxed text-zinc-700 bg-black/20 border-r border-white/5 shrink-0" style={{ minWidth: "3.5rem" }}>
                            {Array.from({ length: lineCount }, (_, i) => (
                              <div key={i + 1}>{i + 1}</div>
                            ))}
                          </div>
                          {/* Editor */}
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 bg-transparent text-xs font-mono text-zinc-300 p-6 resize-none outline-none border-none focus:ring-0 leading-relaxed"
                            spellCheck={false}
                            autoFocus
                          />
                        </div>
                      ) : isPreview ? (
                        <div className="p-8">
                          <div
                            className="prose prose-invert max-w-none text-sm leading-relaxed text-zinc-300 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-5 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-white/10 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-white/5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_p]:leading-relaxed [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-orange-300 [&_pre]:bg-zinc-900 [&_pre]:p-5 [&_pre]:rounded-xl [&_pre]:mb-6 [&_pre]:border [&_pre]:border-white/5 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-300 [&_pre_code]:text-xs [&_li]:ml-5 [&_li]:mb-1.5 [&_li]:pl-1 [&_a]:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-300 [&_a]:transition-colors [&_strong]:text-white [&_em]:text-zinc-200 [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full [&_hr]:border-zinc-800 [&_hr]:my-6"
                            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content) }}
                          />
                        </div>
                      ) : (
                        <pre className="p-6 text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">
                          {content}
                        </pre>
                      )}
                    </div>

                    {/* TOC sidebar (preview mode only) */}
                    {isPreview && !isEditing && toc.length > 0 && sidebarOpen && (
                      <div className="w-56 border-l border-white/5 bg-black/20 flex flex-col shrink-0 animate-in fade-in slide-in-from-right-2 duration-200">
                        <div className="px-4 py-3 border-b border-white/5">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                            Table of Contents
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                          {toc.map((entry, i) => (
                            <a
                              key={i}
                              href={`#${entry.anchor}`}
                              onClick={(e) => {
                                e.preventDefault();
                                const el = document.getElementById(entry.anchor);
                                el?.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="block px-4 py-1.5 text-[11px] text-zinc-500 hover:text-blue-400 hover:bg-blue-500/5 transition-colors truncate"
                              style={{ paddingLeft: `${12 + (entry.level - 1) * 16}px` }}
                            >
                              {entry.text}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4 animate-in fade-in">
                  <div className="p-6 rounded-full bg-white/[0.02] border border-white/5">
                    <FileText size={48} className="opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-400">Select a markdown file</p>
                    <p className="text-xs opacity-50 mt-1">Browse and edit workspace documentation</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-blue-400">Markdown</span>
              {selectedFile && (
                <>
                  <span className="text-zinc-500">{selectedFile.name}</span>
                  <span className="text-zinc-500">{new Intl.NumberFormat().format(selectedFile.size)} B</span>
                </>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-4 text-[9px]">
                <span>{charCount} chars</span>
                <span>{wordCount} words</span>
                <span>{lineCount} lines</span>
                {isEditing && <span className="text-amber-500/80 flex items-center gap-1"><Edit3 size={10} /> Editing</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
