export interface Keybinding {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultKeys: string;
  keys: string;
}

const STORAGE_KEY = "didi_settings";

const DEFAULT_BINDINGS: Keybinding[] = [
  { id: "quick-palette", label: "Quick Palette", description: "Open command palette", category: "Global", defaultKeys: "Ctrl+P", keys: "Ctrl+P" },
  { id: "zen-toggle", label: "Toggle Zen Mode", description: "Switch to/from Zen layout", category: "Zen Mode", defaultKeys: "Alt+Q", keys: "Alt+Q" },
  { id: "zen-focus", label: "Focus Terminal", description: "Toggle focus on active terminal", category: "Zen Mode", defaultKeys: "Alt+F", keys: "Alt+F" },
  { id: "zen-new", label: "New Zen Terminal", description: "Spawn a new Zen terminal", category: "Zen Mode", defaultKeys: "Alt+N", keys: "Alt+N" },
  { id: "zen-close", label: "Close Zen Terminal", description: "Close active Zen terminal", category: "Zen Mode", defaultKeys: "Alt+W", keys: "Alt+W" },
  { id: "zen-layout-v", label: "Zen Layout Vertical", description: "Set Zen layout to vertical", category: "Zen Mode", defaultKeys: "Alt+V", keys: "Alt+V" },
  { id: "zen-layout-h", label: "Zen Layout Horizontal", description: "Set Zen layout to horizontal", category: "Zen Mode", defaultKeys: "Alt+H", keys: "Alt+H" },
  { id: "zen-layout-g", label: "Zen Layout Grid", description: "Set Zen layout to grid", category: "Zen Mode", defaultKeys: "Alt+G", keys: "Alt+G" },
  { id: "find-in-file", label: "Find in File", description: "Search within the editor", category: "Editor", defaultKeys: "Ctrl+F", keys: "Ctrl+F" },
  { id: "save-file", label: "Save File", description: "Save the current file", category: "Editor", defaultKeys: "Ctrl+S", keys: "Ctrl+S" },
];

let cached: Keybinding[] | null = null;

export function getBindings(): Keybinding[] {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.keybindings) {
        cached = DEFAULT_BINDINGS.map(d => {
          const saved = parsed.keybindings.find((s: { id: string; keys: string }) => s.id === d.id);
          return saved ? { ...d, keys: saved.keys } : d;
        });
        return cached;
      }
    }
  } catch { }
  cached = DEFAULT_BINDINGS.map(d => ({ ...d }));
  return cached;
}

export function getBinding(id: string): Keybinding {
  return getBindings().find(b => b.id === id) || DEFAULT_BINDINGS.find(b => b.id === id)!;
}

export function matchesKeys(e: KeyboardEvent, id: string): boolean {
  const binding = getBinding(id);
  // Support multiple shortcuts separated by " / " (e.g. "Ctrl+P / Ctrl+K")
  const variants = binding.keys.split(" / ");
  for (const variant of variants) {
    if (matchSingle(e, variant)) return true;
  }
  return false;
}

function matchSingle(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split("+");
  const hasCtrl = parts.includes("Ctrl");
  const hasAlt = parts.includes("Alt");
  const hasShift = parts.includes("Shift");
  const key = parts[parts.length - 1];

  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  if (hasCtrl !== ctrlOrMeta) return false;
  if (hasAlt !== e.altKey) return false;
  if (hasShift !== e.shiftKey) return false;

  const actualKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (key !== actualKey) return false;

  return true;
}

export function clearBindingsCache() {
  cached = null;
}
