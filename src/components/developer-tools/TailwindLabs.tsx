import { useState, useMemo } from "react";
import { X, Search, Copy, Check, Palette, Ruler, Code2, Maximize2, Minimize2, Type, SunMoon } from "lucide-react";

interface TailwindLabsProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS: Record<string, Record<string, string>> = {
  Slate: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155", 800: "#1e293b", 900: "#0f172a", 950: "#020617" },
  Gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827", 950: "#030712" },
  Zinc: { 50: "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8", 400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46", 800: "#27272a", 900: "#18181b", 950: "#09090b" },
  Neutral: { 50: "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4", 400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717", 950: "#0a0a0a" },
  Stone: { 50: "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1", 400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c", 800: "#292524", 900: "#1c1917", 950: "#0c0a09" },
  Red: { 50: "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5", 400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a" },
  Orange: { 50: "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74", 400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c", 800: "#9a3412", 900: "#7c2d12", 950: "#431407" },
  Amber: { 50: "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309", 800: "#92400e", 900: "#78350f", 950: "#451a03" },
  Yellow: { 50: "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047", 400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207", 800: "#854d0e", 900: "#713f12", 950: "#422006" },
  Lime: { 50: "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264", 400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f", 800: "#3f6212", 900: "#365314", 950: "#1a2e05" },
  Green: { 50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d", 800: "#166534", 900: "#14532d", 950: "#052e16" },
  Emerald: { 50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7", 400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857", 800: "#065f46", 900: "#064e3b", 950: "#022c22" },
  Cyan: { 50: "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9", 400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490", 800: "#155e75", 900: "#164e63", 950: "#083344" },
  Sky: { 50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e", 950: "#082f49" },
  Blue: { 50: "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a", 950: "#172554" },
  Indigo: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc", 400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 800: "#3730a3", 900: "#312e81", 950: "#1e1b4b" },
  Violet: { 50: "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd", 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9", 800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065" },
  Purple: { 50: "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe", 400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce", 800: "#6b21a8", 900: "#581c87", 950: "#3b0764" },
  Fuchsia: { 50: "#fdf4ff", 100: "#fae8ff", 200: "#f5d0fe", 300: "#f0abfc", 400: "#e879f9", 500: "#d946ef", 600: "#c026d3", 700: "#a21caf", 800: "#86198f", 900: "#701a75", 950: "#4a044e" },
  Pink: { 50: "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4", 400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d", 800: "#9d174d", 900: "#831843", 950: "#500724" },
  Rose: { 50: "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af", 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c", 800: "#9f1239", 900: "#881337", 950: "#4c0519" },
};

const FONT_SIZES = [
  { cls: "text-xs", size: "0.75rem", px: 12, line: "1rem (16px)" },
  { cls: "text-sm", size: "0.875rem", px: 14, line: "1.25rem (20px)" },
  { cls: "text-base", size: "1rem", px: 16, line: "1.5rem (24px)" },
  { cls: "text-lg", size: "1.125rem", px: 18, line: "1.75rem (28px)" },
  { cls: "text-xl", size: "1.25rem", px: 20, line: "1.75rem (28px)" },
  { cls: "text-2xl", size: "1.5rem", px: 24, line: "2rem (32px)" },
  { cls: "text-3xl", size: "1.875rem", px: 30, line: "2.25rem (36px)" },
  { cls: "text-4xl", size: "2.25rem", px: 36, line: "2.5rem (40px)" },
  { cls: "text-5xl", size: "3rem", px: 48, line: "1" },
  { cls: "text-6xl", size: "3.75rem", px: 60, line: "1" },
];

const FONT_FAMILIES = [
  { cls: "font-sans", name: "Inter / system-ui", sample: "The quick brown fox jumps over the lazy dog" },
  { cls: "font-serif", name: "ui-serif, Georgia, Cambria", sample: "The quick brown fox jumps over the lazy dog" },
  { cls: "font-mono", name: "JetBrains Mono / monospace", sample: "const hello = 'world';" },
];

const LEADING = [
  { cls: "leading-none", value: "1" },
  { cls: "leading-tight", value: "1.25" },
  { cls: "leading-snug", value: "1.375" },
  { cls: "leading-normal", value: "1.5" },
  { cls: "leading-relaxed", value: "1.625" },
  { cls: "leading-loose", value: "2" },
];

const TRACKING = [
  { cls: "tracking-tighter", value: "-0.05em" },
  { cls: "tracking-tight", value: "-0.025em" },
  { cls: "tracking-normal", value: "0" },
  { cls: "tracking-wide", value: "0.025em" },
  { cls: "tracking-wider", value: "0.05em" },
  { cls: "tracking-widest", value: "0.1em" },
];

const SHADOWS = [
  { cls: "shadow-sm", css: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
  { cls: "shadow", css: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)" },
  { cls: "shadow-md", css: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" },
  { cls: "shadow-lg", css: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" },
  { cls: "shadow-xl", css: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" },
  { cls: "shadow-2xl", css: "0 25px 50px -12px rgb(0 0 0 / 0.25)" },
];

const OPACITIES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

const BLURS = [
  { cls: "blur-none", value: "0" },
  { cls: "blur-sm", value: "4px" },
  { cls: "blur", value: "8px" },
  { cls: "blur-md", value: "12px" },
  { cls: "blur-lg", value: "16px" },
  { cls: "blur-xl", value: "24px" },
  { cls: "blur-2xl", value: "40px" },
  { cls: "blur-3xl", value: "64px" },
];

const RADIUS = [
  { cls: "rounded-none", value: "0" },
  { cls: "rounded-sm", value: "0.125rem (2px)" },
  { cls: "rounded", value: "0.25rem (4px)" },
  { cls: "rounded-md", value: "0.375rem (6px)" },
  { cls: "rounded-lg", value: "0.5rem (8px)" },
  { cls: "rounded-xl", value: "0.75rem (12px)" },
  { cls: "rounded-2xl", value: "1rem (16px)" },
  { cls: "rounded-3xl", value: "1.5rem (24px)" },
  { cls: "rounded-full", value: "9999px" },
];

const BREAKPOINTS = [
  { prefix: "sm", min: "640px", desc: "Tablet (portrait)" },
  { prefix: "md", min: "768px", desc: "Tablet (landscape)" },
  { prefix: "lg", min: "1024px", desc: "Desktop" },
  { prefix: "xl", min: "1280px", desc: "Wide desktop" },
  { prefix: "2xl", min: "1536px", desc: "Ultrawide" },
];

const CLASSES: { class: string; css: string; group: string }[] = [
  { class: "container", css: "width: 100%; max-width: 1280px; margin: 0 auto;", group: "Layout" },
  { class: "flex", css: "display: flex;", group: "Flexbox" },
  { class: "inline-flex", css: "display: inline-flex;", group: "Flexbox" },
  { class: "flex-row", css: "flex-direction: row;", group: "Flexbox" },
  { class: "flex-col", css: "flex-direction: column;", group: "Flexbox" },
  { class: "flex-wrap", css: "flex-wrap: wrap;", group: "Flexbox" },
  { class: "flex-1", css: "flex: 1 1 0%;", group: "Flexbox" },
  { class: "flex-auto", css: "flex: 1 1 auto;", group: "Flexbox" },
  { class: "flex-shrink-0", css: "flex-shrink: 0;", group: "Flexbox" },
  { class: "items-center", css: "align-items: center;", group: "Flexbox" },
  { class: "items-start", css: "align-items: flex-start;", group: "Flexbox" },
  { class: "items-end", css: "align-items: flex-end;", group: "Flexbox" },
  { class: "justify-center", css: "justify-content: center;", group: "Flexbox" },
  { class: "justify-between", css: "justify-content: space-between;", group: "Flexbox" },
  { class: "justify-end", css: "justify-content: flex-end;", group: "Flexbox" },
  { class: "gap-1", css: "gap: 0.25rem (4px);", group: "Flexbox" },
  { class: "gap-2", css: "gap: 0.5rem (8px);", group: "Flexbox" },
  { class: "gap-4", css: "gap: 1rem (16px);", group: "Flexbox" },
  { class: "grid", css: "display: grid;", group: "Grid" },
  { class: "grid-cols-2", css: "grid-template-columns: repeat(2, minmax(0, 1fr));", group: "Grid" },
  { class: "grid-cols-3", css: "grid-template-columns: repeat(3, minmax(0, 1fr));", group: "Grid" },
  { class: "gap-x-4", css: "column-gap: 1rem;", group: "Grid" },
  { class: "gap-y-4", css: "row-gap: 1rem;", group: "Grid" },
  { class: "hidden", css: "display: none;", group: "Display" },
  { class: "block", css: "display: block;", group: "Display" },
  { class: "inline-block", css: "display: inline-block;", group: "Display" },
  { class: "relative", css: "position: relative;", group: "Position" },
  { class: "absolute", css: "position: absolute;", group: "Position" },
  { class: "fixed", css: "position: fixed;", group: "Position" },
  { class: "sticky", css: "position: sticky;", group: "Position" },
  { class: "inset-0", css: "top: 0; right: 0; bottom: 0; left: 0;", group: "Position" },
  { class: "z-10", css: "z-index: 10;", group: "Position" },
  { class: "z-50", css: "z-index: 50;", group: "Position" },
  { class: "w-full", css: "width: 100%;", group: "Sizing" },
  { class: "w-screen", css: "width: 100vw;", group: "Sizing" },
  { class: "w-auto", css: "width: auto;", group: "Sizing" },
  { class: "w-1/2", css: "width: 50%;", group: "Sizing" },
  { class: "max-w-md", css: "max-width: 28rem (448px);", group: "Sizing" },
  { class: "max-w-lg", css: "max-width: 32rem (512px);", group: "Sizing" },
  { class: "max-w-xl", css: "max-width: 36rem (576px);", group: "Sizing" },
  { class: "max-w-2xl", css: "max-width: 42rem (672px);", group: "Sizing" },
  { class: "max-w-4xl", css: "max-width: 56rem (896px);", group: "Sizing" },
  { class: "max-w-7xl", css: "max-width: 80rem (1280px);", group: "Sizing" },
  { class: "h-full", css: "height: 100%;", group: "Sizing" },
  { class: "h-screen", css: "height: 100vh;", group: "Sizing" },
  { class: "min-h-screen", css: "min-height: 100vh;", group: "Sizing" },
  { class: "p-0", css: "padding: 0;", group: "Spacing" },
  { class: "p-1", css: "padding: 0.25rem (4px);", group: "Spacing" },
  { class: "p-2", css: "padding: 0.5rem (8px);", group: "Spacing" },
  { class: "p-4", css: "padding: 1rem (16px);", group: "Spacing" },
  { class: "p-6", css: "padding: 1.5rem (24px);", group: "Spacing" },
  { class: "p-8", css: "padding: 2rem (32px);", group: "Spacing" },
  { class: "px-4", css: "padding-left: 1rem; padding-right: 1rem;", group: "Spacing" },
  { class: "py-2", css: "padding-top: 0.5rem; padding-bottom: 0.5rem;", group: "Spacing" },
  { class: "m-4", css: "margin: 1rem (16px);", group: "Spacing" },
  { class: "mx-auto", css: "margin-left: auto; margin-right: auto;", group: "Spacing" },
  { class: "overflow-hidden", css: "overflow: hidden;", group: "Layout" },
  { class: "overflow-auto", css: "overflow: auto;", group: "Layout" },
  { class: "cursor-pointer", css: "cursor: pointer;", group: "Interactivity" },
  { class: "select-none", css: "user-select: none;", group: "Interactivity" },
  { class: "pointer-events-none", css: "pointer-events: none;", group: "Interactivity" },
  { class: "transition", css: "transition-property: all; transition-timing: cubic-bezier(0.4,0,0.2,1); transition-duration: 150ms;", group: "Animations" },
  { class: "transition-colors", css: "transition-property: color, background-color, border-color;", group: "Animations" },
  { class: "transition-all", css: "transition-property: all;", group: "Animations" },
  { class: "animate-pulse", css: "animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;", group: "Animations" },
  { class: "animate-spin", css: "animation: spin 1s linear infinite;", group: "Animations" },
  { class: "hover:bg-white/10", css: "background-color: rgba(255,255,255,0.1); (on hover)", group: "Hover" },
  { class: "hover:text-white", css: "color: white; (on hover)", group: "Hover" },
  { class: "focus:outline-none", css: "outline: none; (on focus)", group: "Focus" },
  { class: "focus:ring-2", css: "box-shadow: 0 0 0 2px var(--tw-ring-color); (on focus)", group: "Focus" },
  { class: "group-hover:opacity-100", css: "opacity: 1; (when parent .group hovered)", group: "Group" },
  { class: "dark:bg-zinc-900", css: "background-color: #18181b; (in dark mode)", group: "Dark Mode" },
  { class: "dark:text-white", css: "color: white; (in dark mode)", group: "Dark Mode" },
  { class: "sm:flex", css: "display: flex; (at 640px+)", group: "Breakpoints" },
  { class: "md:flex", css: "display: flex; (at 768px+)", group: "Breakpoints" },
  { class: "lg:flex", css: "display: flex; (at 1024px+)", group: "Breakpoints" },
];

const SPACING = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96];

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

const COLOR_NAMES = Object.keys(COLORS);

function isLight(shade: string) {
  return parseInt(shade) <= 300;
}

export function TailwindLabs({ isOpen, onClose }: TailwindLabsProps) {
  const [tab, setTab] = useState<"colors" | "type" | "effects" | "spacing" | "classes">("colors");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [gradientFrom, setGradientFrom] = useState("blue");
  const [gradientTo, setGradientTo] = useState("purple");
  const [gradientShade, setGradientShade] = useState("500");

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { }
  };

  const filteredClasses = useMemo(() => {
    if (!query.trim()) return CLASSES;
    const q = query.toLowerCase();
    return CLASSES.filter(c => c.class.toLowerCase().includes(q) || c.css.toLowerCase().includes(q));
  }, [query]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof CLASSES>();
    for (const c of filteredClasses) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    }
    return Array.from(map.entries());
  }, [filteredClasses]);

  if (!isOpen) return null;

  const tabs = [
    ["colors", "Colors", Palette],
    ["type", "Type", Type],
    ["effects", "Effects", SunMoon],
    ["spacing", "Spacing", Ruler],
    ["classes", "Classes", Code2],
  ] as const;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
        <div className={`bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col ${isFullscreen ? "w-full h-full sm:m-0" : "w-full max-w-6xl h-full sm:h-[88vh]"}`}>

          {/* Header */}
          <div className="px-5 pt-5 pb-3 border-b border-white/5 bg-zinc-900/40 shrink-0 overflow-x-auto">
            <div className="flex items-center justify-between mb-4 min-w-fit">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-sky-500/20 to-blue-500/20 rounded-xl text-sky-400 border border-sky-500/20 shadow-sm shrink-0">
                  <Palette size={20} />
                </div>
                <div className="whitespace-nowrap">
                  <h3 className="text-base font-bold text-white tracking-tight">Tailwind Labs</h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Design tokens & utilities</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95" title={isFullscreen ? "Exit" : "Fullscreen"}>
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"><X size={14} /></button>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5 border border-white/5 w-fit">
              {tabs.map(([key, label, Icon]) => (
                <button key={key} onClick={() => { setTab(key); setQuery(""); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${tab === key ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {tab === "classes" && (
              <div className="relative mt-3 group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-blue-400 transition-colors"><Search size={14} /></div>
                <input type="text" placeholder="Search classes..." value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/40 transition-all shadow-inner" />
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">

            {/* === COLORS TAB === */}
            {tab === "colors" && (
              <div className="p-5 space-y-4">
                {COLOR_NAMES.map(name => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-zinc-300">{name}</span>
                      {selectedColor === name && (
                        <button onClick={() => setSelectedColor(null)} className="text-[9px] text-zinc-600 hover:text-zinc-400">✕ Clear</button>
                      )}
                    </div>
                    <div className="flex gap-1 rounded-xl overflow-hidden h-10">
                      {SHADES.map(shade => {
                        const hex = COLORS[name][shade];
                        const cls = `bg-${name.toLowerCase()}-${shade}`;
                        return (
                          <button key={shade} onClick={() => handleCopy(cls, `color-${name}-${shade}`)} title={`${cls}\n${hex}`}
                            className="flex-1 relative group/color transition-all hover:flex-[2] hover:scale-y-[1.05]" style={{ backgroundColor: hex }}>
                            <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover/color:opacity-100 ${isLight(shade) ? 'text-zinc-800' : 'text-white'}`}>
                              <span className="text-[8px] font-bold font-mono">{shade}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(["bg", "text", "border"] as const).map(prefix => (
                        <button key={prefix} onClick={() => handleCopy(`${prefix}-${name.toLowerCase()}-500`, `prop-${name}-${prefix}`)}
                          className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-all font-mono">
                          {`${prefix}-${name.toLowerCase()}-500`}
                        </button>
                      ))}
                      <button onClick={() => setSelectedColor(selectedColor === name ? null : name)}
                        className="text-[9px] px-2 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-600 hover:text-zinc-400 transition-all">
                        All shades
                      </button>
                    </div>
                    {selectedColor === name && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {SHADES.map(shade => {
                          const hex = COLORS[name][shade];
                          return (
                            <button key={shade} onClick={() => handleCopy(hex, `hex-${name}-${shade}`)} title={`${name}-${shade}: ${hex}`}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                              <span className="w-2.5 h-2.5 rounded" style={{ backgroundColor: hex }} />
                              {shade} <span className="text-zinc-600">{hex}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Gradient Preview */}
                <div className="mt-6 pt-4 border-t border-white/5">
                  <div className="text-xs font-bold text-zinc-300 mb-3">Gradient Generator</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">From</span>
                      <select value={gradientFrom} onChange={e => setGradientFrom(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500/40">
                        {COLOR_NAMES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">To</span>
                      <select value={gradientTo} onChange={e => setGradientTo(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500/40">
                        {COLOR_NAMES.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Shade</span>
                      <select value={gradientShade} onChange={e => setGradientShade(e.target.value)}
                        className="bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-zinc-300 font-mono outline-none focus:border-blue-500/40">
                        {["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3 items-center flex-wrap">
                    <div className="h-16 w-48 rounded-xl shadow-inner" style={{ background: `linear-gradient(to right, ${COLORS[gradientFrom.charAt(0).toUpperCase() + gradientFrom.slice(1)]?.[gradientShade] || '#3b82f6'}, ${COLORS[gradientTo.charAt(0).toUpperCase() + gradientTo.slice(1)]?.[gradientShade] || '#8b5cf6'})` }} />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleCopy(`from-${gradientFrom}-${gradientShade}`, "grad-from")}
                        className="text-[9px] px-2.5 py-1 rounded bg-white/5 border border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all font-mono text-left">
                        from-{gradientFrom}-{gradientShade}
                      </button>
                      <button onClick={() => handleCopy(`to-${gradientTo}-${gradientShade}`, "grad-to")}
                        className="text-[9px] px-2.5 py-1 rounded bg-white/5 border border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/10 transition-all font-mono text-left">
                        to-{gradientTo}-{gradientShade}
                      </button>
                      <button onClick={() => handleCopy(`bg-gradient-to-r from-${gradientFrom}-${gradientShade} to-${gradientTo}-${gradientShade}`, "grad-full")}
                        className="text-[9px] px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all font-mono">
                        Copy full class
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === TYPOGRAPHY TAB === */}
            {tab === "type" && (
              <div className="p-5 space-y-6">
                {/* Font Sizes */}
                <div>
                  <div className="text-xs font-bold text-zinc-300 mb-3">Font Sizes</div>
                  <div className="space-y-3">
                    {FONT_SIZES.map(f => {
                      const isCopied = copied === `fs-${f.cls}`;
                      return (
                        <button key={f.cls} onClick={() => handleCopy(f.cls, `fs-${f.cls}`)}
                          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${isCopied ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'}`}>
                          <span style={{ fontSize: f.size }} className="font-bold text-white truncate flex-1">Aa</span>
                          <div className="text-right shrink-0">
                            <div className={`text-xs font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-sky-400'}`}>{f.cls}</div>
                            <div className="text-[9px] text-zinc-600 font-mono">{f.px}px · {f.size} · lh: {f.line}</div>
                          </div>
                          {isCopied && <Check size={14} className="text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Families */}
                <div className="pt-2 border-t border-white/5">
                  <div className="text-xs font-bold text-zinc-300 mb-3">Font Families</div>
                  <div className="space-y-2">
                    {FONT_FAMILIES.map(f => {
                      const isCopied = copied === `ff-${f.cls}`;
                      return (
                        <button key={f.cls} onClick={() => handleCopy(f.cls, `ff-${f.cls}`)}
                          className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${isCopied ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'}`}>
                          <span className={`flex-1 text-sm ${f.cls} ${isCopied ? 'text-emerald-400' : 'text-zinc-300'}`}>{f.sample}</span>
                          <div className="text-right shrink-0">
                            <div className={`text-xs font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-sky-400'}`}>{f.cls}</div>
                            <div className="text-[9px] text-zinc-600">{f.name}</div>
                          </div>
                          {isCopied && <Check size={14} className="text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Line Height & Letter Spacing */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <div className="text-xs font-bold text-zinc-300 mb-3">Line Height</div>
                    <div className="space-y-1">
                      {LEADING.map(l => {
                        const isCopied = copied === `lh-${l.cls}`;
                        return (
                          <button key={l.cls} onClick={() => handleCopy(l.cls, `lh-${l.cls}`)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-all group text-left">
                            <span className={`text-xs flex-1 ${l.cls} ${isCopied ? 'text-emerald-400' : 'text-zinc-400'}`}>The quick brown fox</span>
                            <span className={`text-[10px] font-mono ${isCopied ? 'text-emerald-400' : 'text-zinc-500'}`}>{l.cls}</span>
                            {isCopied && <Check size={10} className="text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-300 mb-3">Letter Spacing</div>
                    <div className="space-y-1">
                      {TRACKING.map(t => {
                        const isCopied = copied === `tr-${t.cls}`;
                        return (
                          <button key={t.cls} onClick={() => handleCopy(t.cls, `tr-${t.cls}`)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.02] transition-all group text-left">
                            <span className={`text-xs flex-1 ${t.cls} ${isCopied ? 'text-emerald-400' : 'text-zinc-400'}`}>Tracking</span>
                            <span className={`text-[10px] font-mono ${isCopied ? 'text-emerald-400' : 'text-zinc-500'}`}>{t.cls}</span>
                            {isCopied && <Check size={10} className="text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* === EFFECTS TAB === */}
            {tab === "effects" && (
              <div className="p-5 space-y-6">

                {/* Shadows */}
                <div>
                  <div className="text-xs font-bold text-zinc-300 mb-3">Box Shadows</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SHADOWS.map(s => {
                      const isCopied = copied === `sh-${s.cls}`;
                      return (
                        <button key={s.cls} onClick={() => handleCopy(s.cls, `sh-${s.cls}`)}
                          className={`flex flex-col items-center gap-4 p-2 rounded-2xl transition-all group ${isCopied ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/5 hover:bg-white/[0.08]'}`}>
                          <div className="w-full aspect-[4/3] rounded-xl bg-zinc-100 flex items-center justify-center overflow-hidden">
                            <div 
                              className="w-14 h-14 bg-white rounded-xl transition-transform group-hover:scale-110 duration-500" 
                              style={{ boxShadow: s.css }} 
                            />
                          </div>
                          <div className="text-center pb-2">
                            <div className={`text-[10px] font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-zinc-400'}`}>{s.cls}</div>
                            <div className="text-[8px] text-zinc-600 mt-0.5 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300">{s.css}</div>
                          </div>
                          {isCopied && <Check size={12} className="text-emerald-400 mb-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Opacity */}
                <div className="pt-2 border-t border-white/5">
                  <div className="text-xs font-bold text-zinc-300 mb-3">Opacity Scale</div>
                  <div className="flex gap-0.5 rounded-xl overflow-hidden h-14">
                    {OPACITIES.map(op => (
                      <button key={op} onClick={() => handleCopy(`opacity-${op}`, `op-${op}`)}
                        title={`opacity-${op}`}
                        className="flex-1 relative group/op hover:flex-[2] transition-all"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${op / 100})` }}>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/op:opacity-100">
                          <span className={`text-[7px] font-bold font-mono ${op > 50 ? 'text-white' : 'text-zinc-800'}`}>{op}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[8px] text-zinc-700 font-mono mt-1 px-0.5">
                    <span>opacity-0</span>
                    <span>opacity-50</span>
                    <span>opacity-100</span>
                  </div>
                </div>

                {/* Blur */}
                <div className="pt-2 border-t border-white/5">
                  <div className="text-xs font-bold text-zinc-300 mb-3">Blur</div>
                  <div className="flex gap-2 flex-wrap">
                    {BLURS.map(b => {
                      const isCopied = copied === `bl-${b.cls}`;
                      return (
                        <button key={b.cls} onClick={() => handleCopy(b.cls, `bl-${b.cls}`)}
                          className={`flex flex-col items-center gap-2 px-3 py-3 rounded-xl transition-all ${isCopied ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'}`}>
                          <span className="text-lg font-bold text-white" style={{ filter: `blur(${b.value})` }}>A</span>
                          <div className="text-center">
                            <div className={`text-[9px] font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-zinc-400'}`}>{b.cls}</div>
                            <div className="text-[8px] text-zinc-600">{b.value}</div>
                          </div>
                          {isCopied && <Check size={10} className="text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Border Radius */}
                <div className="pt-2 border-t border-white/5">
                  <div className="text-xs font-bold text-zinc-300 mb-3">Border Radius</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {RADIUS.map(r => {
                      const isCopied = copied === `br-${r.cls}`;
                      return (
                        <button key={r.cls} onClick={() => handleCopy(r.cls, `br-${r.cls}`)}
                          className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl transition-all ${isCopied ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'}`}>
                          <div className={`w-10 h-10 bg-blue-500/30 ${r.cls}`} />
                          <div className="text-center">
                            <div className={`text-[9px] font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-zinc-400'}`}>{r.cls}</div>
                            <div className="text-[7px] text-zinc-600">{r.value}</div>
                          </div>
                          {isCopied && <Check size={10} className="text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === SPACING TAB === */}
            {tab === "spacing" && (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-600"><Ruler size={12} /> Tailwind spacing scale</div>
                  <div className="flex gap-2 text-[9px] text-zinc-600">
                    {BREAKPOINTS.map(bp => (
                      <span key={bp.prefix} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{bp.prefix}: {bp.min}</span>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {SPACING.map(value => {
                    const cls = value === 0 ? "p-0" : value % 1 === 0 ? `p-${value}` : `p-${String(value).replace(".", "/")}`;
                    const px = value * 4;
                    const rem = value * 0.25;
                    const barWidth = Math.max(value * 6, value > 0 ? 4 : 0);
                    const isCopied = copied === `sp-${value}`;
                    return (
                      <button key={value} onClick={() => handleCopy(cls, `sp-${value}`)}
                        className={`w-full flex items-center gap-4 py-1.5 px-3 rounded-lg transition-all group ${isCopied ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'}`}>
                        <span className="w-20 text-[11px] font-mono font-bold text-right shrink-0 text-zinc-400">{cls}</span>
                        <div className="flex-1 flex items-center h-4">
                          {value > 0 ? (
                            <div className={`h-3 rounded transition-all ${isCopied ? 'bg-emerald-500/40' : 'bg-blue-500/30 group-hover:bg-blue-500/40'}`}
                              style={{ width: `${Math.min(barWidth, 100)}%`, maxWidth: `${barWidth}px` }} />
                          ) : (
                            <div className="h-0.5 w-full rounded bg-zinc-800" />
                          )}
                          {value === 0 && <span className="text-[10px] text-zinc-600 ml-2">0 — no spacing</span>}
                        </div>
                        <span className="w-24 text-[9px] font-mono text-right shrink-0 text-zinc-600">{px}px · {rem}rem</span>
                        {isCopied && <Check size={12} className="text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === CLASSES TAB === */}
            {tab === "classes" && (
              <div className="divide-y divide-white/[0.03]">
                {groups.map(([group, items]) => (
                  <div key={group}>
                    <div className="px-6 py-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest bg-black/20 sticky top-0 z-10 backdrop-blur-sm">
                      {group} ({items.length})
                    </div>
                    {items.map(item => {
                      const isCopied = copied === `cl-${item.class}`;
                      return (
                        <button key={item.class} onClick={() => handleCopy(item.class, `cl-${item.class}`)}
                          className={`w-full flex items-start gap-4 px-6 py-3 transition-all text-left group ${isCopied ? 'bg-emerald-500/5' : 'hover:bg-white/[0.02]'}`}>
                          <div className="flex-1 min-w-0">
                            <code className={`text-xs font-mono font-bold ${isCopied ? 'text-emerald-400' : 'text-sky-400'}`}>{item.class}</code>
                            <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">{item.css}</div>
                          </div>
                          {isCopied ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold shrink-0"><Check size={12} />Copied</span>
                          ) : (
                            <Copy size={13} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 shrink-0">
            <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-mono font-bold">copy</kbd> Click to copy</span>
            <span className="font-mono text-zinc-500">
              {tab === "colors" && `${COLOR_NAMES.length} colors`}
              {tab === "type" && `${FONT_SIZES.length + FONT_FAMILIES.length} typography`}
              {tab === "effects" && `${SHADOWS.length + OPACITIES.length + BLURS.length + RADIUS.length} effects`}
              {tab === "spacing" && `${SPACING.length} values`}
              {tab === "classes" && `${CLASSES.length} utilities`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
