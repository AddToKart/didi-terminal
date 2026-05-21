import { useState, useEffect, useCallback, useRef } from "react";
import { X, Copy, Check, Plus, Trash2, Download, Database, RefreshCw, Sparkles, ChevronDown, Table, Sliders } from "lucide-react";
import { 
  FieldType, 
  SchemaField, 
  generators, 
  formatAsJSON, 
  formatAsCSV, 
  formatAsSQL,
  presets,
  SchemaPreset
} from "./mock-generators";

interface MockDataGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

const getFieldOptionsMeta = (type: FieldType) => {
  switch (type) {
    case "customArray":
      return { show: true, label: "Options (comma-separated):", placeholder: "e.g. active, pending, banned" };
    case "number":
    case "price":
      return { show: true, label: "Range (Min, Max):", placeholder: "e.g. 10, 100" };
    case "boolean":
      return { show: true, label: "True Probability (0.0 – 1.0):", placeholder: "e.g. 0.3 for 30%" };
    default:
      return { show: false, label: "", placeholder: "" };
  }
};

// Tiny per-cell copied indicator
function CopyCell({ val, type, children }: { val: any; type: FieldType; children: React.ReactNode }) {
  const [flash, setFlash] = useState(false);

  const getTextValue = () => {
    if (val === null || val === undefined) return "";
    return val.toString();
  };

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(getTextValue());
      setFlash(true);
      setTimeout(() => setFlash(false), 1000);
    } catch { /* ignore */ }
  };

  // Avatar cells don't copy-on-click (they show image)
  if (type === "avatarUrl") return <>{children}</>;

  return (
    <div
      onClick={handleClick}
      title="Click to copy"
      className={`inline-flex items-center gap-1.5 group/cell cursor-copy rounded px-1 -mx-1 transition-all duration-150 ${
        flash ? "bg-green-500/15" : "hover:bg-white/4"
      }`}
    >
      {children}
      <span className={`shrink-0 transition-all duration-150 ${flash ? "opacity-100 text-green-400" : "opacity-0 group-hover/cell:opacity-50 text-zinc-500"}`}>
        {flash ? <Check size={10} /> : <Copy size={10} />}
      </span>
    </div>
  );
}

// ── CODE HIGHLIGHTER UTILITIES ──

function highlightJSON(line: string, lineIdx: number) {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}[\],:])/g;

  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    if (token.startsWith('"')) {
      if (token.endsWith(':')) {
        parts.push(
          <span key={`key-${key++}`} className="text-sky-300 font-medium font-mono">
            {token.slice(0, -1)}
          </span>
        );
        parts.push(<span key={`colon-${key++}`} className="text-zinc-600 font-mono">:</span>);
      } else {
        parts.push(
          <span key={`str-${key++}`} className="text-emerald-400/90 font-mono">
            {token}
          </span>
        );
      }
    } else if (/^(true|false)$/.test(token)) {
      parts.push(
        <span key={`bool-${key++}`} className="text-amber-400 font-bold font-mono">
          {token}
        </span>
      );
    } else if (token === "null") {
      parts.push(
        <span key={`null-${key++}`} className="text-red-400/90 italic font-mono">
          {token}
        </span>
      );
    } else if (/^-?\d+(?:\.\d*)?$/.test(token)) {
      parts.push(
        <span key={`num-${key++}`} className="text-violet-400 font-bold font-mono">
          {token}
        </span>
      );
    } else if (/[{}[\],]/.test(token)) {
      parts.push(
        <span key={`punc-${key++}`} className="text-zinc-650 font-medium font-mono">
          {token}
        </span>
      );
    } else {
      parts.push(<span key={`other-${key++}`} className="font-mono">{token}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="font-mono">{line.substring(lastIndex)}</span>);
  }

  return (
    <div key={lineIdx} className="min-h-[1.2rem] hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors whitespace-pre">
      {parts}
    </div>
  );
}

function highlightSQL(line: string, lineIdx: number) {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\b(?:INSERT INTO|VALUES|TRUE|FALSE|NULL)\b|`[^`]+`|'[^']*'|\b\d+(?:\.\d*)?\b|[(),;])/gi;

  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${key++}`}>{line.substring(lastIndex, match.index)}</span>);
    }

    const token = match[0];
    const upperToken = token.toUpperCase();

    if (upperToken === "INSERT INTO" || upperToken === "VALUES") {
      parts.push(
        <span key={`kw-${key++}`} className="text-sky-400 font-black tracking-wide uppercase font-mono">
          {token}
        </span>
      );
    } else if (upperToken === "TRUE" || upperToken === "FALSE") {
      parts.push(
        <span key={`bool-${key++}`} className="text-amber-400 font-bold font-mono">
          {token}
        </span>
      );
    } else if (upperToken === "NULL") {
      parts.push(
        <span key={`null-${key++}`} className="text-red-400 italic font-mono">
          {token}
        </span>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <span key={`col-${key++}`} className="text-zinc-300 font-mono">
          {token}
        </span>
      );
    } else if (token.startsWith("'") && token.endsWith("'")) {
      parts.push(
        <span key={`str-${key++}`} className="text-emerald-400/90 font-mono">
          {token}
        </span>
      );
    } else if (/^\d+(?:\.\d*)?$/.test(token)) {
      parts.push(
        <span key={`num-${key++}`} className="text-violet-400 font-bold font-mono">
          {token}
        </span>
      );
    } else if (/[(),;]/.test(token)) {
      parts.push(
        <span key={`punc-${key++}`} className="text-zinc-650 font-bold font-mono">
          {token}
        </span>
      );
    } else {
      parts.push(<span key={`other-${key++}`} className="font-mono">{token}</span>);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(<span key={`rest-${key++}`} className="font-mono">{line.substring(lastIndex)}</span>);
  }

  return (
    <div key={lineIdx} className="min-h-[1.2rem] hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors whitespace-pre">
      {parts}
    </div>
  );
}

function highlightCSV(line: string, lineIdx: number) {
  const parts: React.ReactNode[] = [];
  const cells = line.split(",");
  const isHeader = lineIdx === 0;

  cells.forEach((cell, idx) => {
    if (idx > 0) {
      parts.push(<span key={`comma-${idx}`} className="text-zinc-650 font-black font-mono">,</span>);
    }

    if (isHeader) {
      parts.push(
        <span key={`cell-${idx}`} className="text-sky-300 font-extrabold uppercase tracking-wider text-[10px] font-mono">
          {cell}
        </span>
      );
    } else {
      if (cell.startsWith('"') && cell.endsWith('"')) {
        parts.push(
          <span key={`cell-${idx}`} className="text-emerald-400/90 font-mono">
            {cell}
          </span>
        );
      } else if (/^\d+(?:\.\d*)?$/.test(cell)) {
        parts.push(
          <span key={`cell-${idx}`} className="text-violet-400 font-mono font-bold">
            {cell}
          </span>
        );
      } else if (/^(true|false)$/i.test(cell)) {
        parts.push(
          <span key={`cell-${idx}`} className="text-amber-400 font-mono font-bold">
            {cell}
          </span>
        );
      } else if (cell.includes("@")) {
        parts.push(
          <span key={`cell-${idx}`} className="text-sky-400/90 font-mono">
            {cell}
          </span>
        );
      } else if (cell === "") {
        parts.push(
          <span key={`cell-${idx}`} className="text-zinc-700 font-mono italic text-[10px]">
            empty
          </span>
        );
      } else {
        parts.push(
          <span key={`cell-${idx}`} className="text-zinc-300 font-mono">
            {cell}
          </span>
        );
      }
    }
  });

  return (
    <div key={lineIdx} className="min-h-[1.2rem] hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors whitespace-pre">
      {parts}
    </div>
  );
}

function HighlightedCode({ code, format }: { code: string; format: "json" | "csv" | "sql" }) {
  const lines = code.split("\n");
  
  return (
    <div className="font-mono text-[11px] leading-relaxed select-text space-y-0.5 selection:bg-green-500/20">
      {lines.map((line, idx) => {
        if (format === "json") {
          return highlightJSON(line, idx);
        } else if (format === "sql") {
          return highlightSQL(line, idx);
        } else {
          return highlightCSV(line, idx);
        }
      })}
    </div>
  );
}

export function MockDataGenerator({ isOpen, onClose }: MockDataGeneratorProps) {
  const [fields, setFields] = useState<SchemaField[]>([
    { id: "saas-1", name: "id", type: "uuid" },
    { id: "saas-2", name: "full_name", type: "fullName" },
    { id: "saas-3", name: "email", type: "email" },
    { id: "saas-4", name: "role", type: "role" },
    { id: "saas-5", name: "avatar", type: "avatarUrl" },
    { id: "saas-6", name: "status", type: "customArray", options: "Active, Pending, Suspended" },
    { id: "saas-7", name: "joined_at", type: "date" }
  ]);
  
  const [rowCount, setRowCount] = useState<number>(10);
  const [format, setFormat] = useState<"json" | "csv" | "sql">("json");
  const [tableName, setTableName] = useState("users");
  const [mode, setMode] = useState<"normal" | "advanced">("normal");
  const [output, setOutput] = useState("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateData = useCallback(() => {
    const data: any[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row: any = {};
      const context: any = { index: i };
      fields.forEach(field => {
        const generator = generators[field.type];
        row[field.name] = generator ? generator(field, context) : "";
      });
      data.push(row);
    }
    setPreviewData(data);
    if (format === "json") setOutput(formatAsJSON(data));
    else if (format === "csv") setOutput(formatAsCSV(data));
    else if (format === "sql") setOutput(formatAsSQL(data, tableName));
  }, [fields, rowCount, format, tableName]);

  useEffect(() => {
    setIsGenerating(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      generateData();
      setIsGenerating(false);
    }, 120);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [generateData]);

  const addField = () => {
    const newId = (Math.random() * 1e6).toFixed(0);
    setFields(prev => [...prev, { id: newId, name: `field_${prev.length + 1}`, type: "fullName" }]);
  };

  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));
  const updateField = (id: string, updates: Partial<SchemaField>) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

  const loadPreset = (preset: SchemaPreset) => {
    setFields(preset.fields.map(f => ({ ...f, id: (Math.random() * 1e6).toFixed(0) })));
    setTableName(preset.tableName);
  };

  const handleCopy = async () => {
    if (!output) return;
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /**/ }
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tableName}_mock_data.${format}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getOutputSize = () => {
    if (!output) return "0 B";
    const b = new Blob([output]).size;
    return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(2)} KB`;
  };

  const renderTableCell = (type: FieldType, val: any) => {
    if (val === null || val === undefined) return <span className="text-zinc-700 italic text-[10px]">null</span>;

    let inner: React.ReactNode;

    switch (type) {
      case "avatarUrl":
        inner = (
          <img
            src={val}
            alt="avatar"
            className="w-7 h-7 rounded-full bg-zinc-900 shadow-sm"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(val)}`; }}
          />
        );
        break;

      case "email":
        inner = (
          <span className="text-sky-400 font-medium text-[11px]">{val}</span>
        );
        break;

      case "boolean":
        inner = val ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-green-500/10 text-green-400">True</span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-400">False</span>
        );
        break;

      case "price":
        inner = <span className="text-emerald-400 font-bold font-mono text-[11px]">${parseFloat(val).toFixed(2)}</span>;
        break;

      case "currency":
        inner = <span className="font-bold uppercase tracking-widest text-[9px] text-zinc-500">{val}</span>;
        break;

      case "hexColor":
        inner = (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm shrink-0 shadow-sm" style={{ backgroundColor: val }} />
            <span className="font-mono text-[10px] text-zinc-500">{val}</span>
          </div>
        );
        break;

      case "role":
      case "customArray": {
        const s = val.toString().toLowerCase();
        const isGreen = ["active", "admin", "approved", "online"].some(k => s.includes(k));
        const isYellow = ["pending", "editor", "moderator", "warning"].some(k => s.includes(k));
        const isRed = ["suspended", "banned", "declined", "offline", "error"].some(k => s.includes(k));
        const color = isGreen
          ? "bg-green-500/10 text-green-400"
          : isYellow
          ? "bg-amber-500/10 text-amber-400"
          : isRed
          ? "bg-red-500/10 text-red-400"
          : "bg-zinc-900/60 text-zinc-400";
        inner = (
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${color}`}>{val}</span>
        );
        break;
      }

      case "password":
        inner = <span className="text-zinc-600 font-mono text-[10px] tracking-wider">••••••••••••</span>;
        break;

      case "date":
      case "timestamp":
        inner = <span className="text-violet-400 font-mono text-[10px]">{val.toString()}</span>;
        break;

      case "uuid":
        inner = <span className="text-zinc-600 font-mono text-[10px]">{val.toString()}</span>;
        break;

      case "url":
      case "domain":
        inner = <span className="text-sky-500 font-mono text-[10px] truncate max-w-[160px] inline-block">{val.toString()}</span>;
        break;

      case "number":
      case "id":
        inner = <span className="text-amber-400 font-bold font-mono text-[11px]">{val.toString()}</span>;
        break;

      default:
        inner = <span className="text-zinc-350 font-mono text-[11px] truncate max-w-[160px] inline-block">{val.toString()}</span>;
    }

    return (
      <CopyCell val={val} type={type}>
        {inner}
      </CopyCell>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="bg-[#08080a] border border-zinc-900 rounded-2xl shadow-2xl w-full max-w-[1200px] h-full sm:h-[87vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── Header ── */}
        <div className="px-5 py-3.5 border-b border-zinc-900/80 bg-zinc-950/60 flex items-center justify-between shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 bg-green-500/10 rounded-lg text-green-400 border border-green-500/15 shrink-0">
              <Database size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-white tracking-widest uppercase">Mock Data Suite</h3>
              <p className="text-[10px] text-zinc-600 truncate">Synthesize production-ready placeholder datasets</p>
            </div>
          </div>

          {/* Mode Pills */}
          <div className="flex bg-black/40 p-0.5 rounded-lg border border-zinc-900 shrink-0">
            <button
              onClick={() => setMode("normal")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                mode === "normal" ? "bg-green-500/15 text-green-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <Table size={12} /> Visual
            </button>
            <button
              onClick={() => setMode("advanced")}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                mode === "advanced" ? "bg-green-500/15 text-green-400" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              <Sliders size={12} /> Developer
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-900 transition-colors shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* ─ Left Panel ─ */}
          <div className="w-[320px] shrink-0 flex flex-col border-r border-zinc-900/80 bg-[#050507]">
            {/* Config */}
            <div className="p-4 border-b border-zinc-900/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                  <Sparkles size={9} className="text-green-500" /> Configuration
                </span>
                <button
                  onClick={addField}
                  className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 hover:bg-green-500/20 px-2 py-0.5 rounded transition-colors"
                >
                  <Plus size={11} /> Add Field
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Rows</label>
                  <input
                    type="number"
                    value={rowCount}
                    onChange={e => setRowCount(Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)))}
                    className="w-full bg-black/50 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 outline-none font-mono focus:ring-1 focus:ring-green-500/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Format</label>
                  <div className="flex bg-black/50 rounded-md p-0.5 h-[30px]">
                    {(["json", "csv", "sql"] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setFormat(fmt)}
                        className={`flex-1 text-[9px] font-bold rounded transition-all uppercase tracking-wider ${
                          format === fmt ? "bg-zinc-800 text-white" : "text-zinc-600 hover:text-zinc-300"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {format === "sql" && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Table Name</label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={e => setTableName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="w-full bg-black/50 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 outline-none font-mono focus:ring-1 focus:ring-green-500/30"
                  />
                </div>
              )}

              {/* Presets — both modes */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 flex items-center gap-1">
                  <Sparkles size={9} className="text-yellow-500" /> Presets
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {presets.map(p => (
                    <button
                      key={p.name}
                      onClick={() => loadPreset(p)}
                      className="text-left px-2.5 py-2 bg-black/30 hover:bg-zinc-900/50 rounded-lg transition-all group"
                    >
                      <div className="text-[9px] font-extrabold text-zinc-500 group-hover:text-green-400 transition-colors truncate">{p.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {fields.map(field => {
                const meta = getFieldOptionsMeta(field.type);
                return (
                  <div key={field.id} className="bg-black/30 p-2.5 rounded-lg relative group hover:bg-black/50 transition-all">
                    <button
                      onClick={() => removeField(field.id)}
                      className="absolute top-2 right-2 text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                    <div className="grid grid-cols-12 gap-1.5 mb-1.5 pr-5">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={field.name}
                          onChange={e => updateField(field.id, { name: e.target.value.replace(/\s+/g, "_") })}
                          placeholder="field_name"
                          className="w-full bg-transparent border-b border-zinc-800 pb-0.5 text-[11px] text-zinc-350 font-mono focus:border-green-500/50 outline-none"
                        />
                      </div>
                      <div className="col-span-7 relative">
                        <select
                          value={field.type}
                          onChange={e => updateField(field.id, { type: e.target.value as FieldType, options: "" })}
                          className="w-full bg-zinc-950 rounded px-1.5 pr-5 py-0.5 text-[10px] text-zinc-400 outline-none appearance-none font-mono"
                        >
                          <optgroup label="User & Identity">
                            <option value="uuid">UUID v4</option>
                            <option value="id">Auto-increment ID</option>
                            <option value="fullName">Full Name</option>
                            <option value="firstName">First Name</option>
                            <option value="lastName">Last Name</option>
                            <option value="gender">Gender</option>
                            <option value="email">Email Address</option>
                            <option value="username">Username</option>
                            <option value="password">Password</option>
                            <option value="phone">Phone Number</option>
                            <option value="avatarUrl">Avatar URL</option>
                            <option value="role">User Role</option>
                          </optgroup>
                          <optgroup label="Location">
                            <option value="streetAddress">Street Address</option>
                            <option value="city">City</option>
                            <option value="state">State</option>
                            <option value="country">Country</option>
                            <option value="zipCode">Zip Code</option>
                            <option value="latitude">Latitude</option>
                            <option value="longitude">Longitude</option>
                          </optgroup>
                          <optgroup label="Text & Content">
                            <option value="word">Word</option>
                            <option value="sentence">Sentence</option>
                            <option value="paragraph">Paragraph</option>
                            <option value="hexColor">Hex Color</option>
                            <option value="customArray">Custom List</option>
                          </optgroup>
                          <optgroup label="Finance">
                            <option value="companyName">Company Name</option>
                            <option value="jobTitle">Job Title</option>
                            <option value="price">Price</option>
                            <option value="currency">Currency Code</option>
                            <option value="creditCard">Credit Card (Masked)</option>
                          </optgroup>
                          <optgroup label="IT & Tech">
                            <option value="ipv4">IPv4</option>
                            <option value="ipv6">IPv6</option>
                            <option value="macAddress">MAC Address</option>
                            <option value="domain">Domain</option>
                            <option value="url">URL</option>
                            <option value="userAgent">User Agent</option>
                          </optgroup>
                          <optgroup label="Date & Time">
                            <option value="date">Date (ISO)</option>
                            <option value="time">Time</option>
                            <option value="timestamp">Unix Timestamp</option>
                          </optgroup>
                          <optgroup label="Numbers & Logic">
                            <option value="number">Number Range</option>
                            <option value="boolean">Boolean</option>
                          </optgroup>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1 text-zinc-600">
                          <ChevronDown size={9} />
                        </div>
                      </div>
                    </div>
                    {meta.show && (
                      <input
                        type="text"
                        value={field.options || ""}
                        onChange={e => updateField(field.id, { options: e.target.value })}
                        placeholder={meta.placeholder}
                        className="w-full bg-zinc-950 rounded px-2 py-1 text-[9px] text-zinc-500 font-mono outline-none focus:ring-1 focus:ring-green-500/20"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─ Right Preview Panel ─ */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#020203] relative">
            
            {/* Action bar */}
            <div className="absolute top-3 right-4 flex items-center gap-2 z-10">
              {mode === "advanced" && (
                <span className="text-[9px] font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded">
                  {getOutputSize()}
                </span>
              )}
              {isGenerating && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                  <RefreshCw size={10} className="animate-spin" /> Generating…
                </span>
              )}
              <button
                onClick={handleCopy}
                disabled={!output}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy All"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!output}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-md text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Download size={12} />
                Download
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto custom-scrollbar pt-12">
              {previewData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-700">
                  <Database size={36} className="mb-3 opacity-20" strokeWidth={1} />
                  <p className="text-xs">Add fields to see a preview</p>
                </div>
              ) : mode === "normal" ? (
                /* ── Visual Table ── */
                <div className="px-4 pb-6">
                  <table className="w-full text-left" style={{ borderSpacing: 0, borderCollapse: "separate" }}>
                    <thead>
                      <tr>
                        {/* Row # */}
                        <th className="sticky top-0 z-10 bg-[#050507] px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-700 w-10 text-right">#</th>
                        {fields.map(field => (
                          <th
                            key={field.id}
                            className="sticky top-0 z-10 bg-[#050507] px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 whitespace-nowrap"
                          >
                            {field.name}
                          </th>
                        ))}
                      </tr>
                      {/* Separator line instead of border */}
                      <tr>
                        <td colSpan={fields.length + 1} className="h-px bg-zinc-900/70 p-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`group/row transition-colors duration-75 hover:bg-zinc-900/30 ${idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.012]"}`}
                        >
                          {/* Row number */}
                          <td className="px-3 py-2.5 text-[9px] font-mono text-zinc-800 text-right select-none">
                            {idx + 1}
                          </td>
                          {fields.map(field => (
                            <td key={field.id} className="px-3 py-2.5 align-middle">
                              {renderTableCell(field.type, row[field.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ── Developer Raw ── */
                <div className="p-5 overflow-auto max-w-full">
                  <HighlightedCode code={output} format={format} />
                </div>
              )}
            </div>

            {/* Table footer hint */}
            {mode === "normal" && previewData.length > 0 && (
              <div className="shrink-0 px-4 py-2 border-t border-zinc-900/60 bg-[#050507] flex items-center justify-between">
                <span className="text-[9px] text-zinc-700 font-mono">
                  {previewData.length} rows · {fields.length} columns
                </span>
                <span className="text-[9px] text-zinc-700 flex items-center gap-1">
                  <Copy size={9} /> Click any cell to copy its value
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}