import { useState, useEffect, useCallback } from "react";
import { 
  Folder, File, ChevronRight, Search, X, 
  Copy, ExternalLink, RefreshCw, FolderOpen,
  FileCode, FileJson, FileText, Settings, Database,
  Cpu, Globe, Image as ImageIcon, Video,
  Terminal as TerminalIcon
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension?: string;
}

interface ProjectFileExplorerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const FileIcon = ({ entry }: { entry: FileEntry }) => {
  if (entry.is_dir) return <Folder className="text-amber-400 fill-amber-400/20" size={16} />;
  
  const ext = entry.extension?.toLowerCase();
  
  if (["ts", "tsx", "js", "jsx"].includes(ext || "")) return <FileCode className="text-blue-400" size={16} />;
  if (["rs"].includes(ext || "")) return <Cpu className="text-orange-500" size={16} />;
  if (["json"].includes(ext || "")) return <FileJson className="text-yellow-400" size={16} />;
  if (["html", "css", "scss"].includes(ext || "")) return <Globe className="text-pink-400" size={16} />;
  if (["md", "txt"].includes(ext || "")) return <FileText className="text-zinc-400" size={16} />;
  if (["db", "sqlite", "sql"].includes(ext || "")) return <Database className="text-emerald-400" size={16} />;
  if (["toml", "yaml", "yml", "env", "conf"].includes(ext || "")) return <Settings className="text-zinc-500" size={16} />;
  if (["png", "jpg", "jpeg", "svg", "gif"].includes(ext || "")) return <ImageIcon className="text-purple-400" size={16} />;
  if (["mp4", "mov"].includes(ext || "")) return <Video className="text-red-400" size={16} />;
  
  return <File className="text-zinc-400" size={16} />;
};

export function ProjectFileExplorer({ currentProject, isOpen, onClose }: ProjectFileExplorerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  const loadDirectory = useCallback(async (path: string) => {
    if (!path) return;
    setLoading(true);
    try {
      const result = await invoke<FileEntry[]>("list_directory", { path });
      setEntries(result);
      setCurrentPath(path);
    } catch (error) {
      console.error("Failed to list directory:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && currentProject) {
      loadDirectory(currentProject);
      setHistory([currentProject]);
    }
  }, [isOpen, currentProject, loadDirectory]);

  const handleFolderClick = (path: string) => {
    setHistory(prev => [...prev, path]);
    loadDirectory(path);
  };

  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      loadDirectory(newHistory[newHistory.length - 1]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const filteredEntries = entries.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className={`fixed top-0 right-0 h-screen w-[450px] bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 shadow-2xl z-[50] transition-all duration-500 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <FolderOpen className="text-indigo-400" size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Project Explorer</h2>
              <p className="text-[10px] text-zinc-500 font-mono truncate max-w-[250px]">
                {currentPath.replace(/\\/g, '/')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 border-b border-zinc-800/50 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={history.length <= 1}
              className="p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Go Back"
            >
              <ChevronRight className="rotate-180" size={18} />
            </button>
            <div className="flex-1 relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" size={14} />
              <input 
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-indigo-500/50 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-zinc-600 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => loadDirectory(currentPath)}
              className={`p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 ${loading ? 'animate-spin text-indigo-400' : ''}`}
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading && entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <RefreshCw className="animate-spin text-indigo-500" size={24} />
              <span className="text-xs text-zinc-500 font-medium">Scanning directory...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 italic">
              <Search size={32} className="mb-2 opacity-20" />
              <span className="text-xs">No files found</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredEntries.map((entry) => (
                <div 
                  key={entry.path}
                  onClick={() => entry.is_dir && handleFolderClick(entry.path)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${entry.is_dir ? 'hover:bg-amber-500/5' : 'hover:bg-indigo-500/5'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon entry={entry} />
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[13px] truncate ${entry.is_dir ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>
                        {entry.name}
                      </span>
                      {!entry.is_dir && (
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {formatSize(entry.size)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      className="p-1.5 hover:bg-white/10 rounded-md text-zinc-500 hover:text-indigo-400"
                      title="Copy Path"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(entry.path);
                      }}
                    >
                      <Copy size={12} />
                    </button>
                    {entry.is_dir ? (
                      <ChevronRight size={14} className="text-zinc-600" />
                    ) : (
                      <ExternalLink size={12} className="text-zinc-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800/50 bg-zinc-900/10 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <span>{entries.filter(e => e.is_dir).length} Folders</span>
            <span>{entries.filter(e => !e.is_dir).length} Files</span>
          </div>
          <div className="flex items-center gap-1 text-indigo-400/70">
            <TerminalIcon size={10} />
            <span>Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
