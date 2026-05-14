import { useState, useMemo } from "react";
import { X, Search, Copy, Check, Grid3X3, List, Minimize2, Maximize2, Palette } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface IconBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_LIST = Object.keys(LucideIcons.icons)
  .filter(name => !name.endsWith("Icon"))
  .sort();

const ICON_CATEGORIES: { name: string; prefix: string }[] = [
  { name: "Actions", prefix: "" },
  { name: "Arrows", prefix: "Arrow" },
  { name: "Media", prefix: "Video" },
  { name: "Files", prefix: "File" },
  { name: "Folders", prefix: "Folder" },
  { name: "Shapes", prefix: "Circle" },
  { name: "Devices", prefix: "Monitor" },
  { name: "UI", prefix: "Panel" },
];

export function IconBrowser({ isOpen, onClose }: IconBrowserProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = ICON_LIST;
    if (selectedCategory) {
      list = list.filter(name => name.startsWith(selectedCategory));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(name => name.toLowerCase().includes(q));
    }
    return list;
  }, [query, selectedCategory]);

  const handleCopy = async (name: string) => {
    const importLine = `import { ${name} } from "lucide-react"`;
    try {
      await navigator.clipboard.writeText(importLine);
      setCopied(name);
      setTimeout(() => setCopied(null), 2000);
    } catch { }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-0 sm:p-3 pointer-events-none">
        <div className={`bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 ${isFullscreen ? "w-full h-full sm:m-0" : "w-full max-w-6xl h-full sm:h-[88vh]"}`}>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl text-indigo-400 border border-indigo-500/20 shadow-sm">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Icon Browser</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                    {filtered.length} of {ICON_LIST.length} icons — lucide-react
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
                  onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                  title={viewMode === "grid" ? "List view" : "Grid view"}
                >
                  {viewMode === "grid" ? <List size={14} /> : <Grid3X3 size={14} />}
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
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-indigo-400 transition-colors">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Search icons..."
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-all shadow-inner"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Category pills */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto custom-scrollbar pb-0.5">
              {ICON_CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(selectedCategory === cat.prefix ? null : cat.prefix)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap border ${
                    selectedCategory === cat.prefix
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-sm'
                      : 'bg-white/5 text-zinc-500 border-white/5 hover:bg-white/10 hover:text-zinc-300'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-2 py-1 rounded-full text-[10px] font-bold text-zinc-600 hover:text-zinc-400 transition-all border border-transparent hover:border-white/5"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>

          {/* Grid / List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 p-8">
                <Search size={36} className="opacity-10" />
                <p className="text-sm font-medium">No icons found</p>
                <p className="text-[11px] text-zinc-600">Try a different search term or clear the filter</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 p-5">
                {filtered.map(name => {
                  const IconComp = LucideIcons.icons[name as keyof typeof LucideIcons.icons] as React.ComponentType<{ size?: number; className?: string }>;
                  const isCopied = copied === name;
                  return (
                    <button
                      key={name}
                      onClick={() => handleCopy(name)}
                      className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-150 group ${
                        isCopied
                          ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 hover:shadow-sm hover:-translate-y-0.5'
                      }`}
                      title="Click to copy import"
                    >
                      <div className="relative flex items-center justify-center w-8 h-8">
                        {IconComp ? (
                          <IconComp size={22} className={`transition-all duration-150 ${
                            isCopied ? "text-emerald-400" : "text-zinc-300 group-hover:text-white group-hover:scale-110"
                          }`} />
                        ) : (
                          <span className="text-zinc-600 text-[10px]">?</span>
                        )}
                        {isCopied && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center animate-in zoom-in duration-150">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] font-mono text-center leading-tight truncate w-full transition-colors ${
                        isCopied ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                      }`}>
                        {isCopied ? "Copied!" : name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {filtered.map(name => {
                  const IconComp = LucideIcons.icons[name as keyof typeof LucideIcons.icons] as React.ComponentType<{ size?: number; className?: string }>;
                  const isCopied = copied === name;
                  return (
                    <button
                      key={name}
                      onClick={() => handleCopy(name)}
                      className={`w-full flex items-center gap-4 px-6 py-3.5 transition-all text-left group ${
                        isCopied ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="w-9 flex justify-center shrink-0">
                        {IconComp ? (
                          <IconComp size={18} className={`transition-colors ${
                            isCopied ? "text-emerald-400" : "text-zinc-500 group-hover:text-white"
                          }`} />
                        ) : null}
                      </div>
                      <code className={`text-xs font-mono flex-1 transition-colors ${
                        isCopied ? 'text-emerald-400' : 'text-zinc-300'
                      }`}>
                        {`import { ${name} } from "lucide-react"`}
                      </code>
                      {isCopied ? (
                        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold shrink-0 animate-in fade-in slide-in-from-right-1 duration-150">
                          <Check size={12} />
                          Copied
                        </span>
                      ) : (
                        <Copy size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono font-bold">import</kbd>
              Click any icon to copy its import statement
            </span>
            <span className="font-mono text-zinc-500">{filtered.length} / {ICON_LIST.length}</span>
          </div>
        </div>
      </div>
    </>
  );
}
