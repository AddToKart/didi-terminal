import { 
  FileText, 
  Code2, 
  Hash, 
  Layout, 
  FileCode, 
  FileType, 
  Settings, 
  FileJson
} from "lucide-react";

interface FileIconProps {
  filename: string;
  className?: string;
  size?: number;
}

export function FileIcon({ filename, className = "", size = 12 }: FileIconProps) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // ── Rust ───────────────────────────────────────────────────────────────────
  if (ext === "rs") {
    return (
      <div className={`relative ${className}`} title="Rust">
        <Settings size={size} className="text-orange-500" />
        <div className="absolute inset-0 flex items-center justify-center opacity-40">
           <div className="w-[4px] h-[4px] rounded-full bg-orange-200" />
        </div>
      </div>
    );
  }

  // ── TypeScript / React ─────────────────────────────────────────────────────
  if (ext === "ts" || ext === "tsx") {
    return (
      <div className={`relative ${className}`} title="TypeScript">
        <Code2 size={size} className="text-blue-400" />
      </div>
    );
  }

  // ── JavaScript / React ─────────────────────────────────────────────────────
  if (ext === "js" || ext === "jsx") {
    return (
      <div className={`relative ${className}`} title="JavaScript">
        <Code2 size={size} className="text-yellow-400" />
      </div>
    );
  }

  // ── CSS / SCSS ─────────────────────────────────────────────────────────────
  if (ext === "css" || ext === "scss" || ext === "less") {
    return <Hash size={size} className={`text-blue-500 ${className}`} />;
  }

  // ── HTML ───────────────────────────────────────────────────────────────────
  if (ext === "html") {
    return <Layout size={size} className={`text-orange-600 ${className}`} />;
  }

  // ── JSON ───────────────────────────────────────────────────────────────────
  if (ext === "json") {
    return <FileJson size={size} className={`text-yellow-500 ${className}`} />;
  }

  // ── Python ─────────────────────────────────────────────────────────────────
  if (ext === "py") {
    return <FileType size={size} className={`text-blue-400 ${className}`} />;
  }

  // ── Markdown ───────────────────────────────────────────────────────────────
  if (ext === "md") {
    return <FileText size={size} className={`text-zinc-400 ${className}`} />;
  }

  // ── Git ────────────────────────────────────────────────────────────────────
  if (filename === ".gitignore" || filename.startsWith(".git")) {
    return <Settings size={size} className={`text-red-500 ${className}`} />;
  }

  // ── Configuration / Settings ──────────────────────────────────────────────
  if (ext === "yaml" || ext === "yml" || ext === "toml" || ext === "xml") {
    return <Settings size={size} className={`text-zinc-500 ${className}`} />;
  }

  // ── Default ────────────────────────────────────────────────────────────────
  return <FileCode size={size} className={`text-zinc-500 ${className}`} />;
}
