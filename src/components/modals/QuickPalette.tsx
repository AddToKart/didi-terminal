import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Command } from "lucide-react";

export interface PaletteAction {
  id: string;
  label: string;
  description: string;
  category: string;
  categoryOrder: number;
  icon: React.ElementType;
  shortcut?: string;
  onSelect: () => void;
}

interface QuickPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let prevMatch = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti === prevMatch + 1 ? 3 : 1;
      prevMatch = ti;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

export function QuickPalette({ isOpen, onClose, actions }: QuickPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) {
      const grouped = new Map<string, PaletteAction[]>();
      for (const a of actions) {
        const cat = a.category;
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(a);
      }
      return Array.from(grouped.entries()).map(([cat, items]) => ({
        category: cat,
        categoryOrder: items[0].categoryOrder,
        items,
      })).sort((a, b) => a.categoryOrder - b.categoryOrder);
    }

    const scored = actions.map(a => ({
      action: a,
      score: fuzzyScore(query, a.label),
    })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    const grouped = new Map<string, { action: PaletteAction; score: number }[]>();
    for (const item of scored) {
      const cat = item.action.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(item);
    }
    return Array.from(grouped.entries()).map(([cat, items]) => ({
      category: cat,
      categoryOrder: items[0].action.categoryOrder,
      items: items.sort((a, b) => b.score - a.score).map(x => x.action),
    })).sort((a, b) => a.categoryOrder - b.categoryOrder);
  }, [query, actions]);

  const flatItems = results.flatMap(g => g.items);
  const totalItems = flatItems.length;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  const executeItem = (index: number) => {
    const item = flatItems[index];
    if (item) {
      item.onSelect();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, totalItems - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      executeItem(activeIndex);
      return;
    }
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const itemEls = el.querySelectorAll<HTMLElement>("[data-index]");
    const target = itemEls[activeIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  let globalIndex = -1;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[200]"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-start justify-center z-[201] pt-[12vh] pointer-events-none">
        <div className="w-full max-w-xl bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto animate-in zoom-in-95 slide-in-from-top-2 duration-150">
          {/* Search */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
            <Search size={16} className="text-zinc-500 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search panels..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none border-none"
              spellCheck={false}
              autoComplete="off"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-zinc-600 bg-white/5 rounded border border-white/5">
              <Command size={10} />K
            </kbd>
          </div>

          {/* Results */}
          {totalItems > 0 ? (
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar py-2">
              {results.map(group => (
                <div key={group.category}>
                  <div className="px-5 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                    {group.category}
                  </div>
                  {group.items.map(action => {
                    globalIndex++;
                    const idx = globalIndex;
                    const Icon = action.icon;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={action.id}
                        data-index={idx}
                        onClick={() => executeItem(idx)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`w-full flex items-center gap-3 px-5 py-2.5 text-xs transition-all text-left ${
                          isActive
                            ? "bg-blue-500/15 text-blue-400"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                        }`}
                      >
                        <Icon size={16} className={isActive ? "text-blue-400" : "text-zinc-600 shrink-0"} />
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold truncate ${isActive ? "text-blue-400" : "text-zinc-200"}`}>
                            {action.label}
                          </div>
                          <div className="text-[10px] text-zinc-600 truncate">{action.description}</div>
                        </div>
                        {action.shortcut && (
                          <kbd className="text-[10px] text-zinc-700 font-mono">{action.shortcut}</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={24} className="text-zinc-700 mb-2" />
              <p className="text-xs text-zinc-500">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : null}

          {/* Footer hint */}
          <div className="px-5 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center gap-4 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold">↵</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
