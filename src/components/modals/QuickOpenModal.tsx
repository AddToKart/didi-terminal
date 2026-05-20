import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, FileCode2, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEditorStore } from "@/services/stores/editor-store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  root: string;
}

export function QuickOpenModal({ isOpen, onClose, root }: Props) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { openTab } = useEditorStore();

  useEffect(() => {
    if (isOpen && root) {
      setLoading(true);
      invoke<string[]>("search_project_files", { cwd: root })
        .then((result) => {
          setFiles(result);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
      
      setQuery("");
      setSelectedIndex(0);
      
      // small timeout to ensure it focuses after mounting
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, root]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredFiles = files.filter((f) =>
    f.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 50); // limit to 50 results for performance

  const handleSelect = async (path: string) => {
    onClose();
    try {
      const fullPath = `${root}/${path}`;
      const content = await invoke<string>("read_file_content", {
        path: fullPath,
        root,
      });

      const fileName = path.split(/[/\\]/).pop() || path;
      const extMatch = fileName.match(/\.([^.]+)$/);
      const ext = extMatch ? extMatch[1] : "";

      openTab({
        id: fullPath,
        filePath: fullPath,
        fileName,
        content,
        language: ext || "text",
        isDirty: false,
      });
    } catch (err) {
      console.error("Failed to open file", err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[300]" onClick={onClose} />
      
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-[301] p-4 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-150">
          
          <div className="flex items-center px-4 py-3 border-b border-zinc-900 bg-zinc-900/40">
            <Search size={16} className="text-zinc-500 mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredFiles[selectedIndex]) {
                    handleSelect(filteredFiles[selectedIndex]);
                  }
                }
              }}
              placeholder="Search files by name..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200 placeholder:text-zinc-600 font-mono"
            />
          </div>

          <div 
            ref={listRef}
            className="max-h-[40vh] overflow-y-auto custom-scrollbar flex flex-col p-1"
          >
            {loading ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <Search size={20} className="animate-pulse" />
                <span>Scanning project files...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-zinc-600">
                No matching files found
              </div>
            ) : (
              filteredFiles.map((file, idx) => {
                const isSelected = idx === selectedIndex;
                const fileName = file.split("/").pop() || file;
                const dirPath = file.substring(0, file.lastIndexOf("/")) || "/";
                
                return (
                  <button
                    key={file}
                    onClick={() => handleSelect(file)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group text-left",
                      isSelected ? "bg-blue-500/10" : "hover:bg-zinc-900/50"
                    )}
                  >
                    <FileCode2 
                      size={14} 
                      className={cn(
                        isSelected ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400"
                      )} 
                    />
                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        "text-xs font-mono truncate",
                        isSelected ? "text-blue-200 font-medium" : "text-zinc-300"
                      )}>
                        {fileName}
                      </span>
                      <span className={cn(
                        "text-[9px] font-mono truncate",
                        isSelected ? "text-blue-400/60" : "text-zinc-600"
                      )}>
                        {dirPath}
                      </span>
                    </div>
                    {isSelected && (
                      <CornerDownLeft size={12} className="ml-auto text-blue-500 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
          
        </div>
      </div>
    </>
  );
}
