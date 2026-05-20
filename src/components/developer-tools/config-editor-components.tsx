import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

function jsonType(v: unknown): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v as "object" | "array" | "string" | "number" | "boolean" | "null";
}

export function SyntaxHighlightedRaw({ text, ext }: { text: string; ext: string }) {
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
          <div key={i} className="hover:bg-zinc-900/20 -mx-6 px-6 transition-colors">
            {tokens.map((t, ti) => (
              <span key={ti} className={t.className}>{t.text}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionCard({ title, children, defaultOpen = true }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800/80 rounded-xl bg-[#0a0a0c] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-900/20 transition-colors text-left"
      >
        <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""} text-zinc-600`} />
        {title}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

export function ValueBadge({ value, type }: { value: string; type: string }) {
  const colorMap: Record<string, string> = {
    string: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    number: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    boolean: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    null: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${colorMap[type] || "text-zinc-400 bg-zinc-900/60 border-zinc-800"}`}>
      {value}
    </span>
  );
}

export function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-300 bg-zinc-800 border border-zinc-700/50">
      {label}
    </span>
  );
}

export function KeyValueRow({ label, value, type }: { label: string; value: string; type: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg hover:bg-zinc-900/20 transition-colors group">
      <span className="text-[11px] font-medium text-zinc-500 min-w-[120px] truncate">{label}</span>
      <ValueBadge value={value} type={type} />
    </div>
  );
}

export function TableView({ data, columns }: { data: Record<string, unknown>[]; columns: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="bg-[#08080a] border-b border-zinc-800/80">
            {columns.map(col => (
              <th key={col} className="px-3 py-2 font-bold text-zinc-500 uppercase tracking-wider">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.03]">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-zinc-900/20 transition-colors">
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

export function renderCell(val: unknown): ReactNode {
  if (val === null || val === undefined) return <span className="text-zinc-600 italic">null</span>;
  if (typeof val === "string") return <span className="text-orange-300">{val}</span>;
  if (typeof val === "number") return <span className="text-emerald-400">{val}</span>;
  if (typeof val === "boolean") return <span className="text-blue-400">{String(val)}</span>;
  if (Array.isArray(val)) return <span className="text-zinc-500">[{val.length} items]</span>;
  if (typeof val === "object") return <span className="text-zinc-500">{`{${Object.keys(val as Record<string, unknown>).length} keys}`}</span>;
  return <span>{String(val)}</span>;
}

export function renderValue(v: unknown): ReactNode {
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

export function PrettyView({ text, ext }: { text: string; ext: string }) {
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

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/20 border border-zinc-800/80">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Keys</span>
            <span className="font-bold text-white">{entries.length}</span>
          </div>
          <div className="w-px h-4 bg-zinc-800/80" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Size</span>
            <span className="font-bold text-white">{new Intl.NumberFormat().format(text.length)} B</span>
          </div>
          <div className="w-px h-4 bg-zinc-800/80" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Lines</span>
            <span className="font-bold text-white">{text.split("\n").length}</span>
          </div>
          <div className="w-px h-4 bg-zinc-800/80" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Format</span>
            <span className="font-bold text-emerald-400">JSON ✓</span>
          </div>
        </div>

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
                    <div key={k} className="flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-900/20">
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
