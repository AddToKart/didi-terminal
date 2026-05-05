import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface AppConfig {
  shell: string;
  llm_endpoint: string;
  theme_cyan: string;
  theme_amber: string;
}

interface Props {
  onClose: () => void;
}

export function SettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    invoke<AppConfig>("get_config").then(setConfig).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (config) {
      await invoke("set_config", { newConfig: config });
      // Apply to document immediately
      document.documentElement.style.setProperty('--tw-colors-brand-cyan', config.theme_cyan);
      document.documentElement.style.setProperty('--tw-colors-brand-amber', config.theme_amber);
      onClose();
    }
  };

  if (!config) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <div className="bg-app-bg border border-app-border rounded shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-app-border">
          <h2 className="text-lg text-brand-cyan font-bold uppercase tracking-widest">System Configuration</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-brand-amber transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shell Path</label>
            <input 
              type="text" 
              value={config.shell}
              onChange={e => setConfig({...config, shell: e.target.value})}
              className="w-full bg-black border border-app-border text-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-cyan"
            />
            <p className="text-[9px] text-slate-600">e.g. pwsh.exe, cmd.exe, bash</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">LLM API Endpoint (OpenAI Compatible)</label>
            <input 
              type="url" 
              value={config.llm_endpoint}
              onChange={e => setConfig({...config, llm_endpoint: e.target.value})}
              className="w-full bg-black border border-app-border text-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-cyan"
            />
          </div>

          <div className="flex gap-4">
            <div className="space-y-1 flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={config.theme_cyan}
                  onChange={e => setConfig({...config, theme_cyan: e.target.value})}
                  className="bg-black border border-app-border h-8 w-12 cursor-pointer"
                />
                <span className="text-xs text-slate-400 font-mono">{config.theme_cyan}</span>
              </div>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alert Color</label>
              <div className="flex items-center gap-2">
                <input 
                  type="color" 
                  value={config.theme_amber}
                  onChange={e => setConfig({...config, theme_amber: e.target.value})}
                  className="bg-black border border-app-border h-8 w-12 cursor-pointer"
                />
                <span className="text-xs text-slate-400 font-mono">{config.theme_amber}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-app-border flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold uppercase text-black bg-brand-cyan hover:bg-brand-cyan/80 transition-colors flex items-center gap-2">
              <Save size={14} /> Save Config
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}