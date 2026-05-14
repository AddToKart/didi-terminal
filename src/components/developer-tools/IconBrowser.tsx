import { useState, useMemo } from "react";
import { X, Search, Copy, Check, Grid3X3, List } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface IconBrowserProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_LIST = Object.keys(LucideIcons.icons)
  .filter(name => !name.endsWith("Icon"))
  .sort();

const VIEW_ICONS = ICON_LIST.slice(0, ICON_LIST.length);

export function IconBrowser({ isOpen, onClose }: IconBrowserProps) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    if (!query.trim()) return VIEW_ICONS;
    const q = query.toLowerCase();
    return VIEW_ICONS.filter(name => name.toLowerCase().includes(q));
  }, [query]);

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
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-4xl h-[80vh] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">

          {/* Header */}
          <div className="p-5 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                  <Grid3X3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Icon Browser</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                    {filtered.length} icons — lucide-react
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
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

            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-indigo-500 transition-colors">
                <Search size={14} />
              </div>
              <input
                type="text"
                placeholder="Search icons..."
                className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 transition-all shadow-inner"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Grid / List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
                <Search size={32} className="opacity-20" />
                <p className="text-xs">No icons match &ldquo;{query}&rdquo;</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 p-5">
                {filtered.map(name => {
                  const IconComp = LucideIcons.icons[name as keyof typeof LucideIcons.icons] as React.ComponentType<{ size?: number; className?: string }>;
                  const isCopied = copied === name;
                  return (
                    <button
                      key={name}
                      onClick={() => handleCopy(name)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all group ${isCopied ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'}`}
                      title="Click to copy import"
                    >
                      <div className="relative">
                        {IconComp ? <IconComp size={20} className={isCopied ? "text-emerald-400" : "text-zinc-300 group-hover:text-white transition-colors"} /> : <span className="text-zinc-600 text-[10px]">?</span>}
                        {isCopied && <Check size={10} className="absolute -top-1 -right-1 text-emerald-400" />}
                      </div>
                      <span className={`text-[9px] font-mono text-center leading-tight truncate w-full ${isCopied ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
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
                      className={`w-full flex items-center gap-4 px-6 py-3 transition-all text-left group ${isCopied ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'}`}
                    >
                      <div className="w-8 flex justify-center shrink-0">
                        {IconComp ? <IconComp size={18} className={isCopied ? "text-emerald-400" : "text-zinc-400 group-hover:text-white transition-colors"} /> : null}
                      </div>
                      <code className={`text-xs font-mono flex-1 ${isCopied ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {`import { ${name} } from "lucide-react"`}
                      </code>
                      {isCopied ? (
                        <Check size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <Copy size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono">import</kbd>
              Click any icon to copy the import statement
            </span>
            <span>{filtered.length} of {ICON_LIST.length}</span>
          </div>
        </div>
      </div>
    </>
  );
}
