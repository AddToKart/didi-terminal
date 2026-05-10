import { useState, useEffect } from "react";
import { X, Save, Terminal as ShellIcon, Globe, Cpu, Key, Palette } from "lucide-react";
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
}

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [llmStatus, setLlmStatus] = useState<string | null>(null);

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).catch(console.error);
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (config) {
      await invoke("set_config", { newConfig: config });
      // Apply to document immediately
      document.documentElement.style.setProperty('--tw-colors-brand-accent', config.theme_cyan);
      document.documentElement.style.setProperty('--tw-colors-brand-warn', config.theme_amber);
      
      if (config.theme_mode === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      
      if (config.glassmorphism) {
        document.documentElement.classList.add("glass");
      } else {
        document.documentElement.classList.remove("glass");
      }
      
      invoke("update_vibrancy", { enable: config.glassmorphism, theme: config.theme_mode }).catch(console.error);
      
      onClose();
    }
  };

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl bg-app-panel border border-app-border rounded-xl overflow-hidden">
        <div className="flex flex-row justify-between items-center border-b border-app-border p-4 pb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-brand-primary flex items-center gap-2">
              <Palette className="text-brand-accent" size={20} />
              System Settings
            </h2>
            <p className="text-xs text-zinc-400 font-medium">Configure your workspace environment and orchestration protocol.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-400 hover:text-brand-warn transition-colors rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Appearance Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent/80 border-b border-brand-accent/20 pb-2">Visual Style</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Theme Preference</label>
                <select 
                  value={config.theme_mode}
                  onChange={e => setConfig({...config, theme_mode: e.target.value})}
                  className="w-full bg-zinc-950/40 border border-app-border text-zinc-200 px-3 py-2 rounded-md text-sm outline-none focus:border-brand-accent transition-all cursor-pointer"
                >
                  <option value="dark">Dark Mode</option>
                  <option value="light">Light Mode</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="group flex items-center justify-between p-3 rounded-lg border border-app-border bg-zinc-950/40 hover:bg-zinc-950/60 transition-all cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-200">Liquid Glass</span>
                    <span className="text-[10px] text-zinc-500">Enable Apple-style glassmorphism</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={config.glassmorphism}
                    onChange={e => setConfig({...config, glassmorphism: e.target.checked})}
                    className="accent-brand-accent w-4 h-4 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Infrastructure Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent/80 border-b border-brand-accent/20 pb-2">Infrastructure</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <ShellIcon size={14} className="text-zinc-500" /> Default Shell
                </label>
                <input 
                  type="text"
                  value={config.shell}
                  onChange={e => setConfig({...config, shell: e.target.value})}
                  placeholder="e.g. pwsh.exe, bash"
                  className="w-full bg-zinc-950/40 border border-app-border text-zinc-200 px-3 py-2 rounded-md text-sm outline-none focus:border-brand-accent transition-all font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Globe size={14} className="text-zinc-500" /> LLM Endpoint
                </label>
                <input 
                  type="url" 
                  value={config.llm_endpoint}
                  onChange={e => setConfig({...config, llm_endpoint: e.target.value})}
                  placeholder="http://localhost:8080/v1"
                  className="w-full bg-zinc-950/40 border border-app-border text-zinc-200 px-3 py-2 rounded-md text-sm outline-none focus:border-brand-accent transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                    <Cpu size={14} className="text-zinc-500" /> Model Name
                  </label>
                  <input
                    type="text"
                    value={config.llm_model}
                    onChange={e => setConfig({...config, llm_model: e.target.value})}
                    className="w-full bg-zinc-950/40 border border-app-border text-zinc-200 px-3 py-2 rounded-md text-sm outline-none focus:border-brand-accent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                    <Key size={14} className="text-zinc-500" /> API Key
                  </label>
                  <input
                    type="password"
                    value={config.llm_api_key}
                    onChange={e => setConfig({...config, llm_api_key: e.target.value})}
                    placeholder="Optional for local sidecar"
                    className="w-full bg-zinc-950/40 border border-app-border text-zinc-200 px-3 py-2 rounded-md text-sm outline-none focus:border-brand-accent transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!config) return;
                    await invoke("set_config", { newConfig: config });
                    const status = await invoke<string>("get_sidecar_status");
                    setLlmStatus(status);
                  }}
                  className="px-4 py-2 border border-app-border hover:border-brand-accent text-zinc-300 hover:text-brand-primary rounded-md text-xs font-bold uppercase transition-all"
                >
                  Verify LLM Connection
                </button>
                {llmStatus && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/50 border border-zinc-800 text-[10px] font-bold text-zinc-400">
                    <div className={`w-1.5 h-1.5 rounded-full ${llmStatus === "Connected" ? "bg-emerald-500" : "bg-red-500"}`} />
                    Status: {llmStatus}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Branding Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent/80 border-b border-brand-accent/20 pb-2">Branding & Theming</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-app-border bg-zinc-950/40 space-y-3">
                <label className="text-xs font-semibold text-zinc-400">Primary Accent</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={config.theme_cyan}
                    onChange={e => setConfig({...config, theme_cyan: e.target.value})}
                    className="h-8 w-12 bg-transparent cursor-pointer rounded overflow-hidden border border-app-border"
                  />
                  <span className="text-xs text-zinc-300 font-mono font-bold">{config.theme_cyan}</span>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-app-border bg-zinc-950/40 space-y-3">
                <label className="text-xs font-semibold text-zinc-400">Alert / Warn</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={config.theme_amber}
                    onChange={e => setConfig({...config, theme_amber: e.target.value})}
                    className="h-8 w-12 bg-transparent cursor-pointer rounded overflow-hidden border border-app-border"
                  />
                  <span className="text-xs text-zinc-300 font-mono font-bold">{config.theme_amber}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-app-border flex justify-end gap-3 bg-zinc-950/20">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-zinc-400 hover:text-white font-bold uppercase text-[10px] tracking-widest transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => handleSave()}
            className="px-6 py-2 font-bold uppercase text-[10px] tracking-[0.15em] bg-brand-accent text-white rounded-md hover:brightness-110 transition-all flex items-center"
          >
            <Save size={14} className="mr-2" /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
