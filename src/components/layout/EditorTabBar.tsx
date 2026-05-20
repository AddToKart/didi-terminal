import { useRef, useEffect } from "react";
import { X, Circle } from "lucide-react";
import type { EditorTab } from "@/types/editor.types";

interface EditorTabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

function getLanguageColor(language: string): string {
  const map: Record<string, string> = {
    typescript: "#3b82f6",
    tsx: "#06b6d4",
    javascript: "#f59e0b",
    jsx: "#f59e0b",
    rust: "#f97316",
    python: "#3b82f6",
    css: "#a78bfa",
    scss: "#ec4899",
    html: "#f97316",
    json: "#10b981",
    markdown: "#e4e4e7",
    md: "#e4e4e7",
    mdx: "#8b5cf6",
  };
  return map[language] ?? "#71717a";
}

function LanguageDot({ language }: { language: string }) {
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: getLanguageColor(language) }}
    />
  );
}

export function EditorTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
}: EditorTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view when it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  if (tabs.length === 0) {
    return (
      <div className="h-9 border-b border-zinc-800 bg-zinc-950 flex items-center px-4">
        <span className="text-[11px] text-zinc-700 select-none">No files open</span>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="h-9 border-b border-zinc-800 bg-zinc-950 flex items-end overflow-x-auto scrollbar-hide select-none"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : null}
            onClick={() => onSelectTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) onCloseTab(tab.id); // middle-click
            }}
            className={`
              group relative flex items-center gap-1.5 px-3 h-9 min-w-0 max-w-[180px] shrink-0
              text-[12px] font-medium transition-all border-r border-zinc-800/60
              ${isActive
                ? "bg-[#09090b] text-zinc-200 border-b-2 border-b-sky-400"
                : "bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60"
              }
            `}
            title={tab.filePath}
          >
            <LanguageDot language={tab.language} />
            <span className="truncate min-w-0 flex-1">{tab.fileName}</span>
            {tab.isDirty && (
              <Circle size={6} className="fill-sky-400 text-sky-400 shrink-0" />
            )}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              className={`
                shrink-0 p-0.5 rounded hover:bg-zinc-700 transition-all
                ${tab.isDirty
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
                }
              `}
            >
              <X size={11} className="text-zinc-500 hover:text-zinc-200" />
            </span>
          </button>
        );
      })}

      {/* Trailing space to allow scrolling past last tab */}
      <div className="flex-1 border-b border-zinc-800 h-9" />
    </div>
  );
}
