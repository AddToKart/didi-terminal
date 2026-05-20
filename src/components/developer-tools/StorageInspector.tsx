import { useState, useEffect, useMemo } from "react";
import { X, Search, Copy, Check, Cookie, HardDrive, Trash2, Edit3, Plus, RefreshCw } from "lucide-react";

interface StorageInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

type StorageTab = "cookies" | "localStorage";

export function StorageInspector({ isOpen, onClose }: StorageInspectorProps) {
  const [tab, setTab] = useState<StorageTab>("localStorage");
  const [search, setSearch] = useState("");
  const [lsEntries, setLsEntries] = useState<{ key: string; value: string }[]>([]);
  const [cookies, setCookies] = useState<{ key: string; value: string }[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const refresh = () => {
    // localStorage
    const ls: { key: string; value: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) ls.push({ key: k, value: localStorage.getItem(k) || "" });
    }
    setLsEntries(ls);

    // cookies
    const c = document.cookie.split(";").filter(Boolean).map(pair => {
      const eq = pair.indexOf("=");
      return { key: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
    });
    setCookies(c);
  };

  useEffect(() => {
    if (isOpen) { refresh(); setSearch(""); setNewKey(""); setNewValue(""); setEditingKey(null); }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const data = tab === "localStorage" ? lsEntries : cookies;
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(e => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q));
  }, [search, tab, lsEntries, cookies]);

  const handleCopy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch { }
  };

  const handleDelete = (key: string) => {
    if (tab === "localStorage") localStorage.removeItem(key);
    refresh();
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
    const entry = lsEntries.find(e => e.key === key);
    setEditValue(entry?.value || "");
  };

  const handleSaveEdit = (oldKey: string) => {
    if (editValue !== undefined) {
      localStorage.setItem(oldKey, editValue);
    }
    setEditingKey(null);
    refresh();
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    localStorage.setItem(newKey.trim(), newValue);
    setNewKey("");
    setNewValue("");
    refresh();
  };

  if (!isOpen) return null;

  const entries = tab === "localStorage" ? lsEntries : cookies;
  const totalSize = tab === "localStorage"
    ? lsEntries.reduce((acc, e) => acc + e.key.length + e.value.length, 0)
    : cookies.reduce((acc, e) => acc + e.key.length + e.value.length, 0);

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col w-full max-w-2xl h-[75vh] sm:rounded-xl">

          <div className="px-5 pt-5 pb-3 border-b border-zinc-800 bg-zinc-900/10 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                  {tab === "localStorage" ? <HardDrive size={18} /> : <Cookie size={18} />}
                </div>
                <div><h3 className="text-sm font-bold text-white">Storage Inspector</h3><p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{entries.length} entries · {totalSize} B</p></div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={refresh} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"><RefreshCw size={14} /></button>
                <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all"><X size={14} /></button>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
                <button onClick={() => setTab("localStorage")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === "localStorage" ? 'bg-zinc-800 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <HardDrive size={12} /> localStorage
                </button>
                <button onClick={() => setTab("cookies")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${tab === "cookies" ? 'bg-zinc-800 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Cookie size={12} /> Cookies
                </button>
              </div>
              <div className="relative flex-1 min-w-[150px] group">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/30" />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-zinc-900">
            {tab === "localStorage" && (
              <div className="px-4 py-2 bg-zinc-900/10 border-b border-zinc-800 flex items-center gap-2 text-[10px]">
                <input placeholder="Key" value={newKey} onChange={e => setNewKey(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-emerald-500/30" />
                <input placeholder="Value" value={newValue} onChange={e => setNewValue(e.target.value)}
                  className="flex-[2] bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-emerald-500/30" />
                <button onClick={handleAdd} disabled={!newKey.trim()}
                  className="p-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 transition-all"><Plus size={14} /></button>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-700 gap-2">
                {tab === "localStorage" ? <HardDrive size={28} className="opacity-10" /> : <Cookie size={28} className="opacity-10" />}
                <p className="text-xs">No {tab === "localStorage" ? "localStorage" : "cookie"} entries found</p>
              </div>
            ) : filtered.map(entry => {
              const isCopied = copied === entry.key;
              const isEditing = editingKey === entry.key;
              return (
                <div key={entry.key} className={`flex items-center gap-3 px-5 py-3 group hover:bg-zinc-900 transition-colors ${isEditing ? 'bg-blue-500/5' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-zinc-300 truncate">{entry.key}</div>
                    {isEditing ? (
                      <input value={editValue} onChange={e => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(entry.key)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(entry.key); if (e.key === "Escape") setEditingKey(null); }}
                        className="w-full bg-zinc-900 border border-blue-500/50 rounded px-2 py-0.5 text-[10px] font-mono text-zinc-300 outline-none mt-1" autoFocus />
                    ) : (
                      <div className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">{entry.value}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleCopy(tab === "localStorage" ? `localStorage.getItem('${entry.key}')` : entry.value, entry.key)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-all" title="Copy">
                      {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                    {tab === "localStorage" && (
                      <button onClick={() => handleEdit(entry.key)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300 transition-all" title="Edit">
                        <Edit3 size={12} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(entry.key)} className="p-1.5 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-all" title="Delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-2 border-t border-zinc-800 bg-zinc-950 text-[9px] text-zinc-700 flex items-center justify-between shrink-0">
            <span>localStorage is shared across all tabs of this origin</span>
            <span className="font-mono">{entries.length} entries</span>
          </div>
        </div>
      </div>
    </div>
  );
}
