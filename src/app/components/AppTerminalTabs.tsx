import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import type { TerminalTab } from "../../App";

interface AppTerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabCreate: () => void;
  onTabRename: (id: string, newName: string) => void;
}

export function AppTerminalTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabCreate,
  onTabRename,
}: AppTerminalTabsProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (id: string, name: string) => {
    setEditingTabId(id);
    setEditValue(name);
  };

  const handleRenameSubmit = () => {
    if (editingTabId && editValue.trim()) {
      onTabRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  return (
    <div className="h-9 flex items-center bg-app-bg border-b border-app-border shrink-0 overflow-x-auto custom-scrollbar">
      <div className="flex items-center h-full">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          return (
            <div
              key={tab.id}
              onClick={() => { if (!isEditing) onTabSelect(tab.id); }}
              onDoubleClick={() => handleDoubleClick(tab.id, tab.name)}
              className={`group flex items-center gap-2 px-4 h-full border-r border-app-border cursor-pointer select-none min-w-[120px] max-w-[200px] transition-colors ${
                isActive
                  ? "bg-app-panel text-brand-primary"
                  : "bg-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
              }`}
            >              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-none outline-none text-xs font-medium text-brand-primary flex-1 min-w-0"
                />
              ) : (
                <span className="text-xs font-medium truncate flex-1">{tab.name}</span>
              )}
              {!isEditing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(tab.id);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    isActive 
                      ? "text-brand-primary/50 hover:text-brand-primary hover:bg-brand-accent/20" 
                      : "opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40"
                  }`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={onTabCreate}
        className="h-full px-3 flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-[#151518] transition-colors border-r border-app-border shrink-0"
        title="New Tab"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
