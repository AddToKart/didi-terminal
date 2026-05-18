import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { matchesKeys } from "../../services/keybindings";
import {
  X,
  Search,
  RefreshCw,
  Save,
  Edit3,
  Folder,
  ChevronRight,
  File,
  Copy,
  Check,
  Minimize2,
  Maximize2,
  Plus,
  Trash2,
  FileCode,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension: string | null;
}

interface ConfigEditorProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

const CONFIG_EXTENSIONS = new Set(["json", "jsonc", "toml", "yaml", "yml"]);

function isConfigFile(entry: FileEntry): boolean {
  return entry.extension !== null && CONFIG_EXTENSIONS.has(entry.extension.toLowerCase());
}

function getFileLabel(ext: string | null): string {
  const e = ext?.toLowerCase() || "";
  if (e === "json" || e === "jsonc") return "JSON";
  if (e === "toml") return "TOML";
  if (e === "yaml" || e === "yml") return "YAML";
  return "Config";
}

function getFileIconColor(ext: string | null): string {
  const e = ext?.toLowerCase() || "";
  if (e === "json" || e === "jsonc") return "text-amber-400";
  if (e === "toml") return "text-emerald-400";
  if (e === "yaml" || e === "yml") return "text-cyan-400";
  return "text-zinc-400";
}

const FORMATTED_EXTENSIONS = new Set(["json", "jsonc"]);

function formatJson(raw: string): string {
  return JSON.stringify(JSON.parse(raw), null, 2);
}

function validateJson(raw: string): string | null {
  try {
    JSON.parse(raw);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

function jsonType(v: unknown): JsonType {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as JsonType;
}

function SyntaxHighlightedRaw({ text, ext }: { text: string; ext: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const isJsonLike = ["json", "jsonc"].includes(ext.toLowerCase());
  const isYaml = ["yaml", "yml"].includes(ext.toLowerCase());

  const tokenized = useMemo(() => {
    return lines.map(line => {
      const tokens: { text: string; className: string }[] = [];

      if (isJsonLike) {
        let rest = line;
        while (rest.length > 0) {
          const keyMatch = rest.match(/^(\s*)"((?:\\.|[^"\\])*)"(\s*):/);
          if (keyMatch) {
            if (keyMatch[1]) tokens.push({ text: keyMatch[1], className: "" });
            tokens.push({ text: `"${keyMatch[2]}"`, className: "text-blue-400" });
            tokens.push({ text: `${keyMatch[3]}:`, className: "text-zinc-600" });
            rest = rest.slice(keyMatch[0].length);
            continue;
          }
          const strMatch = rest.match(/^"((?:\\.|[^"\\])*)"/);
          if (strMatch) {
            tokens.push({ text: strMatch[0], className: "text-orange-300" });
            rest = rest.slice(strMatch[0].length);
            continue;
          }
          const numMatch = rest.match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
          if (numMatch) {
            tokens.push({ text: numMatch[0], className: "text-emerald-400" });
            rest = rest.slice(numMatch[0].length);
            continue;
          }
          const boolMatch = rest.match(/^(true|false)/);
          if (boolMatch) {
            tokens.push({ text: boolMatch[0], className: "text-blue-400" });
            rest = rest.slice(boolMatch[0].length);
            continue;
          }
          const nullMatch = rest.match(/^null/);
          if (nullMatch) {
            tokens.push({ text: nullMatch[0], className: "text-zinc-500 italic" });
            rest = rest.slice(nullMatch[0].length);
            continue;
          }
          const braceMatch = rest.match(/^[\[\]\{\}]/);
          if (braceMatch) {
            tokens.push({ text: braceMatch[0], className: "text-zinc-400" });
            rest = rest.slice(braceMatch[0].length);
            continue;
          }
          const commaMatch = rest.match(/^,\s*/);
          if (commaMatch) {
            tokens.push({ text: commaMatch[0], className: "text-zinc-700" });
            rest = rest.slice(commaMatch[0].length);
            continue;
          }
          const wsMatch = rest.match(/^\s+/);
          if (wsMatch) {
            tokens.push({ text: wsMatch[0], className: "" });
            rest = rest.slice(wsMatch[0].length);
            continue;
          }
          tokens.push({ text: rest[0], className: "" });
          rest = rest.slice(1);
        }
      } else if (isYaml) {
        const commentMatch = line.match(/^(\s*#.*)/);
        if (commentMatch) {
          tokens.push({ text: line, className: "text-zinc-600 italic" });
          return tokens;
        }
        const keyVal = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)/);
        if (keyVal) {
          if (keyVal[1]) tokens.push({ text: keyVal[1], className: "" });
          tokens.push({ text: keyVal[2], className: "text-blue-400" });
          tokens.push({ text: keyVal[3], className: "text-zinc-600" });
          const val = keyVal[4];
          const strQuote = val.match(/^"(.*)"$/);
          if (strQuote) {
            tokens.push({ text: `"${strQuote[1]}"`, className: "text-orange-300" });
          } else if (/^\d+(\.\d+)?$/.test(val)) {
            tokens.push({ text: val, className: "text-emerald-400" });
          } else if (/^(true|false)$/.test(val)) {
            tokens.push({ text: val, className: "text-blue-400" });
          } else if (/^null$/.test(val)) {
            tokens.push({ text: val, className: "text-zinc-500 italic" });
          } else if (/^[-\d]/.test(val)) {
            tokens.push({ text: val, className: "text-emerald-400" });
          } else {
            tokens.push({ text: val, className: "" });
          }
        } else {
          tokens.push({ text: line, className: "" });
        }
      } else {
        tokens.push({ text: line, className: "" });
      }

      return tokens.length > 0 ? tokens : [{ text: " ", className: "" }];
    });
  }, [lines, isJsonLike, isYaml]);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="py-5 px-6 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
        {tokenized.map((tokens, i) => (
          <div key={i} className="hover:bg-white/[0.02] -mx-6 px-6 transition-colors">
            {tokens.map((t, ti) => (
              <span key={ti} className={t.className}>{t.text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ title, children, defaultOpen = true }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-xl bg-black/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-white/[0.02] transition-colors text-left"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""} text-zinc-600`} />
        {title}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function ValueBadge({ value, type }: { value: string; type: string }) {
  const colorMap: Record<string, string> = {
    string: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    number: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    boolean: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    null: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${colorMap[type] || "text-zinc-400 bg-white/5 border-white/10"}`}>
      {value}
    </span>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-300 bg-zinc-800 border border-zinc-700/50">
      {label}
    </span>
  );
}

function KeyValueRow({ label, value, type }: { label: string; value: string; type: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors group">
      <span className="text-[11px] font-medium text-zinc-500 min-w-[120px] truncate">{label}</span>
      <ValueBadge value={value} type={type} />
    </div>
  );
}

function TableView({ data, columns }: { data: Record<string, unknown>[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="bg-black/40 border-b border-white/5">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-wider">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
              {columns.map(col => (
                <td key={col} className="px-3 py-2 text-zinc-300 font-mono">
                  {renderCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell(val: unknown): React.ReactNode {
  if (val === null || val === undefined) return <span className="text-zinc-600 italic">null</span>;
  if (typeof val === "string") return <span className="text-orange-300">{val}</span>;
  if (typeof val === "number") return <span className="text-emerald-400">{val}</span>;
  if (typeof val === "boolean") return <span className="text-blue-400">{String(val)}</span>;
  if (Array.isArray(val)) return <span className="text-zinc-500">[{val.length} items]</span>;
  if (typeof val === "object") return <span className="text-zinc-500">{`{${Object.keys(val as Record<string, unknown>).length} keys}`}</span>;
  return <span>{String(val)}</span>;
}

function renderValue(v: unknown): React.ReactNode {
  if (v === null) return <ValueBadge value="null" type="null" />;
  if (typeof v === "string") return <ValueBadge value={`"${v}"`} type="string" />;
  if (typeof v === "number") return <ValueBadge value={String(v)} type="number" />;
  if (typeof v === "boolean") return <ValueBadge value={String(v)} type="boolean" />;
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-zinc-600 text-xs italic">empty array</span>;
    if (v.every(item => typeof item === "string" || typeof item === "number" || typeof item === "boolean")) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {v.map((item, i) => (
            typeof item === "string"
              ? <Chip key={i} label={item} />
              : <ValueBadge key={i} value={String(item)} type={typeof item} />
          ))}
        </div>
      );
    }
    if (v.every(item => typeof item === "object" && item !== null && !Array.isArray(item))) {
      const columns = [...new Set(v.flatMap(item => Object.keys(item as Record<string, unknown>)))];
      return <TableView data={v as Record<string, unknown>[]} columns={columns} />;
    }
    return <span className="text-zinc-600 text-xs">Array ({v.length} items)</span>;
  }
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>);
    return (
      <div className="space-y-1">
        {entries.map(([k, val]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="text-[11px] font-medium text-blue-400 min-w-[100px] truncate shrink-0">{k}</span>
            <div className="flex-1">{renderValue(val)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(v)}</span>;
}

function PrettyView({ text, ext }: { text: string; ext: string }) {
  const isJsonLike = ["json", "jsonc"].includes(ext.toLowerCase());

  const parsed = useMemo(() => {
    if (!isJsonLike) return null;
    try { return JSON.parse(text); } catch { return null; }
  }, [text, isJsonLike]);

  const entries = useMemo(() => {
    if (!parsed || typeof parsed !== "object") return [];
    return Object.entries(parsed as Record<string, unknown>);
  }, [parsed]);

  if (!isJsonLike || !parsed) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-6">
        <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre-wrap">{text}</pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-4">

        {/* Summary */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Keys</span>
            <span className="font-bold text-white">{entries.length}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Size</span>
            <span className="font-bold text-white">{new Intl.NumberFormat().format(text.length)} B</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Lines</span>
            <span className="font-bold text-white">{text.split("\n").length}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Format</span>
            <span className="font-bold text-emerald-400">JSON ✓</span>
          </div>
        </div>

        {/* Sections */}
        {entries.map(([key, value]) => {
          const t = jsonType(value);
          const icon = t === "object" ? (
            <span className="text-xs text-zinc-600">{Object.keys(value as Record<string, unknown>).length} props</span>
          ) : t === "array" ? (
            <span className="text-xs text-zinc-600">{(value as unknown[]).length} items</span>
          ) : null;

          return (
            <SectionCard key={key} title={
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-mono">{key}</span>
                {icon}
              </div>
            } defaultOpen={t !== "array" || (value as unknown[]).length <= 20}>
              {t === "object" && Object.keys(value as Record<string, unknown>).length === 0 && (
                <p className="text-xs text-zinc-600 italic py-2">Empty object</p>
              )}
              {t === "object" && Object.keys(value as Record<string, unknown>).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                  {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02]">
                      <span className="text-[10px] font-medium text-blue-400 shrink-0 min-w-[80px] truncate">{k}</span>
                      <div className="flex-1 min-w-0">{renderValue(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              {t === "array" && (value as unknown[]).length === 0 && (
                <p className="text-xs text-zinc-600 italic py-2">Empty array</p>
              )}
              {t === "array" && (value as unknown[]).length > 0 && (
                <div>{renderValue(value)}</div>
              )}
              {t === "string" && <KeyValueRow label={key} value={`"${value}"`} type="string" />}
              {t === "number" && <KeyValueRow label={key} value={String(value)} type="number" />}
              {t === "boolean" && <KeyValueRow label={key} value={String(value)} type="boolean" />}
              {t === "null" && <KeyValueRow label={key} value="null" type="null" />}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

import JsonWorker from "../../workers/json.worker?worker";

export function ConfigEditor({ currentProject, isOpen, onClose }: ConfigEditorProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentDir, setCurrentDir] = useState<string>("");
  const [dirHistory, setDirHistory] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [rawContent, setRawContent] = useState("");
  const [editContent, setEditContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"pretty" | "tree" | "raw">("pretty");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState(false);

  const [parsed, setParsed] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new JsonWorker();
    workerRef.current.onmessage = (e: MessageEvent) => {
      setParsed(e.data.parsed);
      setParseError(e.data.error);
    };
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (rawContent && selectedFile && FORMATTED_EXTENSIONS.has(selectedFile.extension?.toLowerCase() || "")) {
      workerRef.current?.postMessage({ raw: rawContent });
    } else {
      setParsed(null);
      setParseError(null);
    }
  }, [rawContent, selectedFile]);

  const isParseable = parsed !== null && parseError === null;

  function getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current)) {
        const idx = parseInt(part);
        if (isNaN(idx)) return undefined;
        current = current[idx];
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  function setNestedValue(obj: unknown, path: string, value: unknown): unknown {
    const parts = path.split(".");
    if (parts.length === 1) {
      const key = parts[0];
      if (Array.isArray(obj)) {
        const idx = parseInt(key);
        if (!isNaN(idx)) {
          const copy = [...obj];
          copy[idx] = value;
          return copy;
        }
        return obj;
      }
      if (typeof obj === "object" && obj !== null) {
        return { ...(obj as Record<string, unknown>), [key]: value };
      }
      return value;
    }
    const head = parts[0];
    const rest = parts.slice(1).join(".");
    if (Array.isArray(obj)) {
      const idx = parseInt(head);
      if (!isNaN(idx)) {
        const copy = [...obj];
        copy[idx] = setNestedValue(copy[idx], rest, value);
        return copy;
      }
      return obj;
    }
    if (typeof obj === "object" && obj !== null) {
      return {
        ...(obj as Record<string, unknown>),
        [head]: setNestedValue((obj as Record<string, unknown>)[head], rest, value),
      };
    }
    const out: Record<string, unknown> = {};
    out[head] = value;
    return out;
  }

  function deleteNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    if (parts.length === 1) {
      const key = parts[0];
      if (Array.isArray(obj)) {
        const idx = parseInt(key);
        if (!isNaN(idx)) {
          const copy = [...obj];
          copy.splice(idx, 1);
          return copy;
        }
        return obj;
      }
      if (typeof obj === "object" && obj !== null) {
        const copy = { ...(obj as Record<string, unknown>) };
        delete copy[key];
        return copy;
      }
      return obj;
    }
    const head = parts[0];
    const rest = parts.slice(1).join(".");
    if (Array.isArray(obj)) {
      const idx = parseInt(head);
      if (!isNaN(idx)) {
        const copy = [...obj];
        copy[idx] = deleteNestedValue(copy[idx], rest);
        return copy;
      }
      return obj;
    }
    if (typeof obj === "object" && obj !== null) {
      return {
        ...(obj as Record<string, unknown>),
        [head]: deleteNestedValue((obj as Record<string, unknown>)[head], rest),
      };
    }
    return obj;
  }

  function addToParent(obj: unknown, parentPath: string, key: string, value: unknown): unknown {
    if (!parentPath) {
      if (typeof obj === "object" && obj !== null) {
        return { ...(obj as Record<string, unknown>), [key]: value };
      }
      return obj;
    }
    const parent = getNestedValue(obj, parentPath);
    if (Array.isArray(parent)) {
      return setNestedValue(obj, parentPath, [...parent, value]);
    }
    if (typeof parent === "object" && parent !== null) {
      return setNestedValue(obj, `${parentPath}.${key}`, value);
    }
    return obj;
  }

  const handleUpdateValue = (path: string, raw: string) => {
    if (!parsed) return;
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(raw);
    } catch {
      parsedValue = raw;
    }
    const updated = setNestedValue(parsed, path, parsedValue);
    const formatted = JSON.stringify(updated, null, 2);
    setRawContent(formatted);
    setEditContent(formatted);
  };

  const handleDeleteKey = (path: string) => {
    if (!parsed) return;
    const updated = deleteNestedValue(parsed, path);
    const formatted = JSON.stringify(updated, null, 2);
    setRawContent(formatted);
    setEditContent(formatted);
  };

  const handleAddKey = (parentPath: string, key: string) => {
    if (!parsed) return;
    const updated = addToParent(parsed, parentPath, key, "");
    const formatted = JSON.stringify(updated, null, 2);
    setRawContent(formatted);
    setEditContent(formatted);
  };

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
      const result = await invoke<string>("read_file_content", { path: filePath, root: currentProject });
      setRawContent(result);
      setEditContent(result);
      setIsEditing(false);
      setExpandedPaths(new Set());
      setEditingPath(null);
    } catch (err) {
      setError(`Failed to read file: ${err}`);
      setRawContent("");
      setEditContent("");
    } finally {
      setContentLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedFile) return;
    let toSave = editContent;
    if (FORMATTED_EXTENSIONS.has(selectedFile.extension?.toLowerCase() || "")) {
      const err = validateJson(editContent);
      if (err) {
        setError(`JSON Error: ${err}`);
        return;
      }
      try { toSave = formatJson(editContent); } catch { }
    }
    setSaving(true);
    setError(null);
    try {
      await invoke("write_file_content", { path: selectedFile.path, root: currentProject, content: toSave });
      setRawContent(toSave);
      setEditContent(toSave);
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
      setRawContent("");
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
    setRawContent("");
    setEditContent("");
    setIsEditing(false);
  };

  const handleRefresh = () => {
    if (currentDir) loadDirectory(currentDir);
    if (selectedFile) loadFileContent(selectedFile.path);
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(editContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesKeys(e, "save-file") && isEditing) {
        e.preventDefault();
        handleSave();
      }
    };
    if (!isOpen) return;
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isEditing, handleSave]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen || !currentProject) return;
    setSelectedFile(null);
    setRawContent("");
    setEditContent("");
    setIsEditing(false);
    setViewMode("pretty");
    setDirHistory([]);
    setSearchTerm("");
    setError(null);
    setSidebarOpen(true);
    setIsFullscreen(false);
    setExpandedPaths(new Set());
    setEditingPath(null);
    loadDirectory(currentProject);
  }, [isOpen, currentProject, loadDirectory]);

  const configFiles = entries.filter(e => !e.is_dir && isConfigFile(e));
  const otherFiles = entries.filter(e => !e.is_dir && !isConfigFile(e));
  const directories = entries.filter(e => e.is_dir);

  const filteredConfigs = configFiles.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOther = otherFiles.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDirs = directories.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

  function renderTree(obj: unknown, path: string, depth: number): React.ReactNode {
    const t = jsonType(obj);
    const isExpanded = expandedPaths.has(path);

    if (t === "object") {
      const entries = Object.entries(obj as Record<string, unknown>);
      const isEmpty = entries.length === 0;
      const comma = depth > 0;
      return (
        <div key={path} className="select-none">
          <div className="flex items-center gap-1">
            {depth > 0 && <span className="text-zinc-700">{comma ? "," : ""}</span>}
            <button
              onClick={() => toggleExpand(path)}
              className="p-0.5 hover:bg-white/5 rounded text-zinc-500"
            >
              <ChevronRight size={10} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
            {depth > 0 && <span className="text-xs text-zinc-500 font-medium">{path.split(".").pop()}: </span>}
            <span className="text-[11px] text-zinc-600">{isEmpty ? "{}" : isExpanded ? "{" : `{…} (${entries.length})`}</span>
          </div>
          {isExpanded && !isEmpty && (
            <div className="ml-5 border-l border-white/5 pl-3">
              {entries.map(([k, v]) => (
                <div key={`${path}.${k}`} className="flex items-center gap-1 py-0.5 group">
                  {renderTree(v, path ? `${path}.${k}` : k, depth + 1)}
                  <button
                    onClick={() => handleDeleteKey(path ? `${path}.${k}` : k)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-400 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newKey = `key${entries.length}`;
                  handleAddKey(path, newKey);
                  setTimeout(() => toggleExpand(path), 0);
                }}
                className="flex items-center gap-1 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 hover:opacity-100"
              >
                <Plus size={10} />
                Add key
              </button>
            </div>
          )}
          {isExpanded && !isEmpty && depth > 0 && <span className="text-zinc-700 ml-5">,</span>}
        </div>
      );
    }

    if (t === "array") {
      const arr = obj as unknown[];
      const isEmpty = arr.length === 0;
      return (
        <div key={path} className="select-none">
          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleExpand(path)}
              className="p-0.5 hover:bg-white/5 rounded text-zinc-500"
            >
              <ChevronRight size={10} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </button>
            <span className="text-xs text-zinc-500 font-medium">{path.split(".").pop()}: </span>
            <span className="text-[11px] text-zinc-600">{isEmpty ? "[]" : isExpanded ? "[" : `[…] (${arr.length})`}</span>
          </div>
          {isExpanded && !isEmpty && (
            <div className="ml-5 border-l border-white/5 pl-3">
              {arr.map((item, i) => (
                <div key={`${path}.${i}`} className="flex items-center gap-1 py-0.5 group">
                  {renderTree(item, `${path}.${i}`, depth + 1)}
                  <button
                    onClick={() => handleDeleteKey(`${path}.${i}`)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-400 transition-all"
                    title="Delete"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  handleAddKey(path, "");
                  setTimeout(() => toggleExpand(path), 0);
                }}
                className="flex items-center gap-1 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 hover:opacity-100"
              >
                <Plus size={10} />
                Add item
              </button>
            </div>
          )}
        </div>
      );
    }

    const keyName = path.split(".").pop() || "";
    const fullPath = path;
    const isEditing = editingPath === fullPath;

    const renderValue = () => {
      if (isEditing) {
        return (
          <input
            autoFocus
            type={t === "number" ? "number" : t === "boolean" ? "text" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              handleUpdateValue(fullPath, editValue);
              setEditingPath(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleUpdateValue(fullPath, editValue);
                setEditingPath(null);
              }
              if (e.key === "Escape") setEditingPath(null);
            }}
            className="bg-zinc-900 border border-blue-500/50 rounded px-1.5 py-0.5 text-[11px] font-mono text-white outline-none w-40"
            onClick={(e) => e.stopPropagation()}
          />
        );
      }

      const display = (() => {
        switch (t) {
          case "string": return `"${obj}"`;
          case "number": return String(obj);
          case "boolean": return String(obj);
          case "null": return "null";
          default: return String(obj);
        }
      })();

      const color = t === "string" ? "text-orange-300" : t === "number" ? "text-emerald-400" : t === "boolean" ? "text-blue-400" : "text-zinc-500";

      return (
        <span
          className={`text-xs font-mono ${color} cursor-text hover:bg-white/5 px-1 rounded transition-colors`}
          onClick={() => {
            setEditingPath(fullPath);
            setEditValue(t === "null" ? "" : String(obj));
          }}
          title="Click to edit"
        >
          {display}
        </span>
      );
    };

    return (
      <div key={path} className="flex items-center gap-1.5 py-0.5">
        <span className="text-xs text-zinc-500 font-medium">{keyName}: </span>
        {renderValue()}
        <span className="text-zinc-700">,</span>
      </div>
    );
  }

  if (!isOpen) return null;

  const isJson = !!selectedFile && FORMATTED_EXTENSIONS.has(selectedFile.extension?.toLowerCase() || "");
  const canTreeView = isJson && isParseable;
  const ext = selectedFile?.extension || null;

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
                <div className={`p-2 rounded-lg border ${getFileIconColor(ext).replace("text-", "border-").replace(/-400/, "-500/20").replace(/(text-)/, "bg-$1/10")}`}>
                  <FileCode size={18} className={getFileIconColor(ext)} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Config Editor</h3>
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
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedFile && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${sidebarOpen ? 'bg-zinc-800/60 text-zinc-300' : 'bg-white/5 text-zinc-500 hover:text-zinc-300'}`}
                  title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                >
                  <Folder size={14} />
                </button>
              )}
              <div className="relative flex-1 max-w-sm group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-blue-500 transition-colors">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Filter config files..."
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
            {/* Sidebar */}
            {sidebarOpen && (
              <div className="w-64 border-r border-white/5 bg-black/20 flex flex-col shrink-0 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {dirHistory.length > 0 && (
                      <button onClick={handleGoBack} className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors" title="Go back">
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
                    <div className="flex items-center justify-center h-full"><RefreshCw size={16} className="animate-spin text-zinc-500" /></div>
                  ) : error && entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                      <FileCode size={32} className="text-zinc-600 mb-2" />
                      <p className="text-[11px] text-zinc-500">{error}</p>
                    </div>
                  ) : (
                    <div className="py-2">
                      {filteredDirs.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Directories</div>
                          {filteredDirs.map(e => (
                            <button key={e.path} onClick={() => handleSelectEntry(e)}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left text-zinc-400 hover:text-white hover:bg-white/[0.03]">
                              <Folder size={14} className="text-zinc-600 shrink-0" />
                              <span className="truncate">{e.name}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {filteredConfigs.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">Config Files</div>
                          {filteredConfigs.map(e => {
                            const isActive = selectedFile?.path === e.path;
                            const iconColor = getFileIconColor(e.extension);
                            return (
                              <button key={e.path} onClick={() => handleSelectEntry(e)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left ${isActive ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'}`}>
                                <FileCode size={14} className={`${iconColor} shrink-0`} />
                                <span className="truncate flex-1">{e.name}</span>
                                <span className="text-[9px] text-zinc-600 font-mono">{getFileLabel(e.extension)}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      {filteredOther.length > 0 && (
                        <>
                          <div className="px-4 py-1.5 text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">Other Files</div>
                          {filteredOther.map(e => {
                            const isActive = selectedFile?.path === e.path;
                            return (
                              <button key={e.path} onClick={() => handleSelectEntry(e)}
                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs transition-all text-left ${isActive ? 'bg-blue-500/10 text-blue-400 border-l-2 border-blue-500' : 'text-zinc-400 hover:text-white hover:bg-white/[0.03] border-l-2 border-transparent'}`}>
                                <File size={14} className="text-zinc-600 shrink-0" />
                                <span className="truncate">{e.name}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      {filteredDirs.length === 0 && filteredConfigs.length === 0 && filteredOther.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-40">
                          <FileCode size={32} className="text-zinc-600 mb-2" />
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
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 bg-zinc-900/30 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode size={14} className={`${getFileIconColor(selectedFile.extension)} shrink-0`} />
                      <span className="text-xs font-bold text-zinc-300 truncate">{selectedFile.name}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{getFileLabel(selectedFile.extension)}</span>
                      <span className="text-[9px] text-zinc-600 font-mono">{new Intl.NumberFormat().format(selectedFile.size)} B</span>
                      {isJson && (
                        <span className={`text-[9px] font-mono ${isParseable ? 'text-emerald-500' : 'text-red-400'}`}>
                          {isParseable ? "Valid" : "Invalid"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!isEditing ? (
                        <>
                          <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5 border border-white/5">
                            <button
                              onClick={() => setViewMode("pretty")}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${viewMode === "pretty" ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                              title="Syntax-highlighted preview"
                            >
                              Preview
                            </button>
                            {isJson && (
                              <button
                                onClick={() => setViewMode("tree")}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${viewMode === "tree" ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                title="Collapsible tree view"
                              >
                                Tree
                              </button>
                            )}
                            <button
                              onClick={() => setViewMode("raw")}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${viewMode === "raw" ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                              title="Raw text"
                            >
                              Raw
                            </button>
                          </div>
                          <button
                            onClick={handleCopyContent}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all"
                            title="Copy content"
                          >
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </button>
                          <button
                            onClick={() => { setIsEditing(true); setViewMode("raw"); }}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-all"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={handleSave}
                            disabled={saving || (isJson && !isParseable)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-white/10 disabled:text-zinc-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95"
                          >
                            <Save size={14} />
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => { setEditContent(rawContent); setIsEditing(false); setViewMode("pretty"); }}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Validation error */}
                  {parseError && viewMode !== "pretty" && (
                    <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-[11px] text-red-400 font-mono">
                      ⚠ {parseError}
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {contentLoading ? (
                      <div className="flex items-center justify-center h-full"><RefreshCw size={20} className="animate-spin text-zinc-500" /></div>
                    ) : error ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in">
                        <div className="p-3 bg-red-500/10 rounded-lg text-red-500 mb-3 border border-red-500/20"><X size={24} /></div>
                        <p className="text-sm font-bold text-white mb-1">Read Error</p>
                        <p className="text-[11px] text-zinc-500">{error}</p>
                        <button onClick={() => loadFileContent(selectedFile.path)} className="mt-4 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs transition-colors">Retry</button>
                      </div>
                    ) : isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-full bg-black/30 text-xs font-mono text-zinc-300 p-6 resize-none outline-none border-none focus:ring-0 leading-relaxed"
                        spellCheck={false}
                        autoFocus
                      />
                    ) : viewMode === "pretty" ? (
                      <PrettyView text={rawContent} ext={selectedFile.extension || ""} />
                    ) : viewMode === "raw" || !canTreeView ? (
                      <SyntaxHighlightedRaw text={rawContent} ext={selectedFile.extension || ""} />
                    ) : (
                      <div className="p-6 font-mono">
                        <div className="text-[11px] leading-relaxed text-zinc-300">
                          {"{"}
                          <div className="ml-4 border-l border-white/5 pl-4">
                            {parsed && Object.entries(parsed).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-1 py-0.5 group">
                                {renderTree(v, k, 1)}
                                <button
                                  onClick={() => handleDeleteKey(k)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-400 transition-all mt-0.5"
                                  title="Delete"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span>{"}"}</span>
                            <button
                              onClick={() => {
                                const newKey = `key${parsed ? Object.keys(parsed).length : 0}`;
                                handleAddKey("", newKey);
                              }}
                              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                            >
                              <Plus size={10} /> Add key
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4 animate-in fade-in">
                  <div className="p-6 rounded-full bg-white/[0.02] border border-white/5">
                    <FileCode size={48} className="opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-zinc-400">Select a config file</p>
                    <p className="text-xs opacity-50 mt-1">Edit JSON, TOML, and YAML workspace configurations</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-blue-400">Config</span>
              {selectedFile && (
                <>
                  <span className="text-zinc-500">{selectedFile.name}</span>
                  <span className="text-zinc-500">{new Intl.NumberFormat().format(selectedFile.size)} B</span>
                </>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-4 text-[9px]">
                <span>{rawContent.split("\n").length} lines</span>
                <span>{rawContent.length} chars</span>
                {isEditing && <span className="text-amber-500/80 flex items-center gap-1"><Edit3 size={10} /> Editing</span>}
                {isJson && <span className={isParseable ? "text-emerald-500/80" : "text-red-400/80"}>{isParseable ? "Valid JSON" : "Invalid JSON"}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
