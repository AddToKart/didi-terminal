import { useState, useEffect, useRef } from "react";
import { X, Save, Terminal as ShellIcon, Globe, Cpu, Key, Palette, Keyboard, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface AppConfig {
  shell: string;
  llm_endpoint: string;
  llm_model: string;
  llm_api_key: string;
  theme_cyan: string;
  theme_amber: string;
  theme_mode: string;
  glassmorphism: boolean;
  github_pat: string;
}

interface Keybinding {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultKeys: string;
  keys: string;
}

const DEFAULT_KEYBINDINGS: Keybinding[] = [
  { id: "quick-palette", label: "Omnibar", description: "Open command palette and workspace search", category: "Global", defaultKeys: "Ctrl+P / Ctrl+K", keys: "Ctrl+P / Ctrl+K" },
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

const SETTINGS_KEY = "didi_settings";

interface Props {
  onClose: () => void;
}

function loadSavedKeybindings(): Keybinding[] {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.keybindings) {
        return DEFAULT_KEYBINDINGS.map(d => {
          const saved = parsed.keybindings.find((s: Keybinding) => s.id === d.id);
          return saved ? { ...d, keys: saved.keys } : d;
        });
      }
    }
  } catch { }
  return DEFAULT_KEYBINDINGS;
}

function saveKeybindings(bindings: Keybinding[]) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.keybindings = bindings.map(b => ({ id: b.id, keys: b.keys }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  } catch { }
}

function formatKeyEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.key && !["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  }
  return parts.join("+");
}

export function SettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"appearance" | "infra" | "shortcuts">("appearance");
  const [keybindings, setKeybindings] = useState<Keybinding[]>(loadSavedKeybindings);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [hasShortcutChanges, setHasShortcutChanges] = useState(false);
  const recordingRef = useRef<HTMLDivElement>(null);

  const [availableShells, setAvailableShells] = useState<{ name: string; command: string; is_wsl: boolean }[]>([]);

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).catch(console.error);
    invoke<{ name: string; command: string; is_wsl: boolean }[]>("get_available_shells").then(setAvailableShells).catch(console.error);
  }, []);

  useEffect(() => {
    if (!recordingId) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const formatted = formatKeyEvent(e);
      if (formatted) {
        setKeybindings(prev => prev.map(k => k.id === recordingId ? { ...k, keys: formatted } : k));
        setHasShortcutChanges(true);
        setRecordingId(null);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recordingId]);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    const finalConfig = { ...config, glassmorphism: false };
    await invoke("set_config", { newConfig: finalConfig });
    document.documentElement.style.setProperty("--tw-colors-brand-accent", config.theme_cyan);
    document.documentElement.style.setProperty("--tw-colors-brand-warn", config.theme_amber);
    if (config.theme_mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    document.documentElement.classList.remove("glass");
    invoke("update_vibrancy", { enable: false, theme: config.theme_mode }).catch(console.error);
    const { emit } = await import("@tauri-apps/api/event");
    emit("config-updated");
    saveKeybindings(keybindings);
    onClose();
  };

  const handleResetShortcuts = () => {
    setKeybindings(DEFAULT_KEYBINDINGS.map(k => ({ ...k })));
    setHasShortcutChanges(true);
  };

  if (!config) return null;

  const tabs = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "infra", label: "Infrastructure", icon: Cpu },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[200]" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center z-[201] p-3 pointer-events-none">
        <div className="w-full max-w-5xl h-[90vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-zinc-900 bg-zinc-900/10 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl text-blue-400 border border-blue-500/20 shadow-sm">
                  <Palette size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Settings</h2>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">Configure your workspace</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 w-fit">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[11px] font-bold transition-all ${activeTab === id ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-8 py-6 space-y-6">

            {/* === APPEARANCE TAB === */}
            {activeTab === "appearance" && (
              <>
                <div className="space-y-4">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2">Visual Style</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-zinc-400">Theme Preference</label>
                      <select value={config.theme_mode} onChange={e => setConfig({ ...config, theme_mode: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all cursor-pointer">
                        <option value="dark">Dark Mode</option>
                        <option value="light">Light Mode</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2">Branding & Theming</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900 space-y-3">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Primary Accent</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={config.theme_cyan} onChange={e => setConfig({ ...config, theme_cyan: e.target.value })}
                          className="h-9 w-14 bg-transparent cursor-pointer rounded-lg overflow-hidden border border-zinc-800" />
                        <span className="text-[11px] text-zinc-300 font-mono font-bold">{config.theme_cyan}</span>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900 space-y-3">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Alert / Warn</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={config.theme_amber} onChange={e => setConfig({ ...config, theme_amber: e.target.value })}
                          className="h-9 w-14 bg-transparent cursor-pointer rounded-lg overflow-hidden border border-zinc-800" />
                        <span className="text-[11px] text-zinc-300 font-mono font-bold">{config.theme_amber}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* === INFRASTRUCTURE TAB === */}
            {activeTab === "infra" && (
              <div className="space-y-4">
                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2">Environment Portability</h3>
                <div className="flex items-center gap-3 pb-2">
                  <button
                    onClick={async () => {
                      try {
                        const { save } = await import("@tauri-apps/plugin-dialog");
                        const { invoke } = await import("@tauri-apps/api/core");
                        const path = await save({ filters: [{ name: "Didi Profile", extensions: ["didi-profile"] }] });
                        if (path) {
                          const ls = JSON.stringify(localStorage);
                          await invoke("export_profile", { destinationPath: path, localStorageJson: ls });
                          alert("Profile exported successfully.");
                        }
                      } catch (e) {
                        alert(`Export failed: ${e}`);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Profile
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const { open } = await import("@tauri-apps/plugin-dialog");
                        const { invoke } = await import("@tauri-apps/api/core");
                        const path = await open({ filters: [{ name: "Didi Profile", extensions: ["didi-profile"] }] });
                        if (path) {
                          const lsStr = await invoke<string>("import_profile", { sourcePath: path });
                          const ls = JSON.parse(lsStr);
                          Object.keys(ls).forEach(k => localStorage.setItem(k, ls[k]));
                          alert("Profile imported. The application will now restart.");
                          window.location.reload();
                        }
                      } catch (e) {
                        alert(`Import failed: ${e}`);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-primary border border-brand-accent/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import Profile
                  </button>
                </div>

                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2">Shell & Runtime</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2">
                      <ShellIcon size={13} className="text-zinc-600" /> Default Shell
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Select Detected Shell</span>
                        <select
                          value={availableShells.some(s => s.command === config.shell) ? config.shell : "custom"}
                          onChange={e => {
                            const val = e.target.value;
                            if (val !== "custom") {
                              setConfig({ ...config, shell: val });
                            }
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all cursor-pointer h-9"
                        >
                          {availableShells.map(s => (
                            <option key={s.command} value={s.command}>{s.name}</option>
                          ))}
                          <option value="custom">Custom Shell Command...</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Shell Command / Path</span>
                        <input
                          type="text"
                          value={config.shell}
                          onChange={e => setConfig({ ...config, shell: e.target.value })}
                          placeholder="e.g. pwsh.exe, bash"
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all font-mono h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2 pt-2">Source Control & Integrations</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2">
                      <Key size={13} className="text-zinc-600" /> GitHub Personal Access Token
                    </label>
                    <input type="password" value={config.github_pat} onChange={e => setConfig({ ...config, github_pat: e.target.value })}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all font-mono" />
                    <p className="text-[9px] text-zinc-500">Required for full-screen Git issues, PRs, and comments integration.</p>
                  </div>
                </div>

                <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2 pt-2">LLM Connection</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2">
                      <Globe size={13} className="text-zinc-600" /> LLM Endpoint
                    </label>
                    <input type="url" value={config.llm_endpoint} onChange={e => setConfig({ ...config, llm_endpoint: e.target.value })}
                      placeholder="http://localhost:8080/v1"
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2">
                        <Cpu size={13} className="text-zinc-600" /> Model Name
                      </label>
                      <input type="text" value={config.llm_model} onChange={e => setConfig({ ...config, llm_model: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-2">
                        <Key size={13} className="text-zinc-600" /> API Key
                      </label>
                      <input type="password" value={config.llm_api_key} onChange={e => setConfig({ ...config, llm_api_key: e.target.value })}
                        placeholder="Optional for local sidecar"
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-2 rounded-lg text-xs outline-none focus:border-blue-500/40 transition-all" />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button type="button" onClick={async () => {
                      if (!config) return;
                      await invoke("set_config", { newConfig: config });
                      const status = await invoke<string>("get_sidecar_status");
                      setLlmStatus(status);
                    }}
                      className="px-4 py-2 border border-zinc-800 hover:border-blue-500 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg text-[10px] font-bold uppercase transition-all">
                      Verify Connection
                    </button>
                    {llmStatus && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-500">
                        <div className={`w-1.5 h-1.5 rounded-full ${llmStatus === "Connected" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {llmStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* === KEYBOARD SHORTCUTS TAB === */}
            {activeTab === "shortcuts" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/80 border-b border-zinc-900 pb-2 flex-1">Key Bindings</h3>
                  {hasShortcutChanges && (
                    <button onClick={handleResetShortcuts}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-850 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 transition-all text-[9px] font-bold">
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Click a shortcut to rebind it. Press the desired key combination on your keyboard to assign it.
                </p>

                {["Global", "Zen Mode", "Editor"].map(category => {
                  const items = keybindings.filter(k => k.category === category);
                  if (items.length === 0) return null;
                  return (
                    <div key={category}>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">{category}</div>
                      <div className="space-y-1">
                        {items.map(item => {
                          const isRecording = recordingId === item.id;
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/40 border border-zinc-900 hover:bg-zinc-900/80 transition-all group">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-zinc-300">{item.label}</div>
                                <div className="text-[9px] text-zinc-600">{item.description}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isRecording ? (
                                  <div ref={recordingRef}
                                    className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-400 text-[10px] font-bold font-mono animate-pulse flex items-center gap-1.5 min-w-[90px] justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                    Press keys...
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setRecordingId(item.id)}
                                    className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold font-mono transition-all min-w-[90px] ${
                                      item.keys !== item.defaultKeys
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/15'
                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                                    }`}
                                  >
                                    {item.keys}
                                  </button>
                                )}
                                {item.keys !== item.defaultKeys && !isRecording && (
                                  <button
                                    onClick={() => setKeybindings(prev => prev.map(k => k.id === item.id ? { ...k, keys: item.defaultKeys } : k))}
                                    className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Reset to default"
                                  >
                                    <RotateCcw size={10} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {hasShortcutChanges && (
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-400/80 flex items-center gap-2">
                    <RotateCcw size={12} />
                    Shortcut changes are saved when you click "Save Configuration"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-900/20 flex items-center justify-end gap-3 shrink-0">
            <button onClick={onClose}
              className="px-4 py-2 text-zinc-500 hover:text-zinc-300 font-bold uppercase text-[9px] tracking-widest transition-colors">
              Cancel
            </button>
            <button onClick={() => handleSaveConfig()}
              className="px-5 py-2 font-bold uppercase text-[9px] tracking-[0.15em] bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-blue-500/20">
              <Save size={13} /> Save Configuration
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
