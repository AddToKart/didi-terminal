import { Search, ChevronRight, X } from "lucide-react";

interface TerminalFindBarProps {
  show: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFindNext: (query: string) => void;
  onFindPrevious: (query: string) => void;
  onClose: () => void;
}

export function TerminalFindBar({ show, query, onQueryChange, onKeyDown, onFindNext, onFindPrevious, onClose }: TerminalFindBarProps) {
  if (!show) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-app-border bg-zinc-900/60 shrink-0" onClick={(e) => e.stopPropagation()}>
      <Search size={12} className="text-zinc-500 shrink-0" />
      <input
        type="text"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Find in terminal..."
        className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none border-none"
        autoFocus
      />
      <div className="flex items-center gap-1">
        <button
          onClick={() => onFindPrevious(query)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Previous (Shift+Enter)"
        >
          <ChevronRight size={12} className="rotate-180" />
        </button>
        <button
          onClick={() => onFindNext(query)}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Next (Enter)"
        >
          <ChevronRight size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
