import { useState, useEffect } from "react";
import { 
  X, 
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  FileKey2,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface EnvVar {
  key: string;
  value: string;
  isNew?: boolean;
}

interface EnvManagerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EnvManager({ currentProject, isOpen, onClose }: EnvManagerProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchEnv = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const content = await invoke<string>("read_file_content", { path: `${currentProject}/.env` });
      
      const parsedVars: EnvVar[] = content
        .split("\n")
        .filter(line => line.trim() && !line.trim().startsWith("#"))
        .map(line => {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            return { key: match[1].trim(), value: match[2].trim() };
          }
          return null;
        })
        .filter((v): v is EnvVar => v !== null);

      setEnvVars(parsedVars);
      setHasChanges(false);
      setError(null);
    } catch (err) {
      console.error("Failed to read .env:", err);
      // It's okay if .env doesn't exist yet
      setEnvVars([]);
      setError("No .env file found or failed to read.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      const content = envVars.map(v => `${v.key}=${v.value}`).join("\n");
      await invoke("write_file_content", { path: `${currentProject}/.env`, content });
      setHasChanges(false);
      setError(null);
    } catch (err) {
      console.error("Failed to save .env:", err);
      setError("Failed to save .env file");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEnv();
    }
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const toggleVisibility = (key: string) => {
    const next = new Set(showValues);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setShowValues(next);
  };

  const updateVar = (index: number, field: "key" | "value", newValue: string) => {
    const next = [...envVars];
    next[index] = { ...next[index], [field]: newValue };
    setEnvVars(next);
    setHasChanges(true);
  };

  const removeVar = (index: number) => {
    const next = [...envVars];
    next.splice(index, 1);
    setEnvVars(next);
    setHasChanges(true);
  };

  const addVar = () => {
    setEnvVars([...envVars, { key: "", value: "", isNew: true }]);
    setHasChanges(true);
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-500" 
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-3xl h-[650px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          <div className="p-5 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
                  <FileKey2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Environment Variables
                    {hasChanges && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-[10px] text-amber-400 border border-amber-500/20 uppercase tracking-tighter">
                        Unsaved Changes
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">.env Manager</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchEnv}
                  disabled={loading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Reload from disk"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-white/10 disabled:text-zinc-500 text-white rounded-lg transition-all text-xs font-bold shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <div className="w-px h-6 bg-white/10 mx-1" />
                <button 
                  onClick={onClose}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-2 bg-black/40 border-b border-white/5 flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
            <div className="flex-[0.4]">Key</div>
            <div className="flex-[0.6] px-4">Value</div>
            <div className="w-16 text-right">Actions</div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 p-4">
            {error && envVars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <AlertCircle size={48} className="text-zinc-600 mb-3" />
                <p className="text-sm font-bold text-white mb-2">No .env found</p>
                <button onClick={addVar} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors">
                  Create New .env
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {envVars.map((env, index) => (
                  <div key={index} className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300">
                    <input 
                      type="text"
                      placeholder="KEY_NAME"
                      value={env.key}
                      onChange={(e) => updateVar(index, "key", e.target.value)}
                      className="flex-[0.4] bg-black/40 border border-white/5 focus:border-blue-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-400 placeholder:text-zinc-700 outline-none transition-all"
                    />
                    
                    <div className="flex-[0.6] relative flex items-center">
                      <input 
                        type={showValues.has(env.key) || env.isNew ? "text" : "password"}
                        placeholder="value..."
                        value={env.value}
                        onChange={(e) => updateVar(index, "value", e.target.value)}
                        className="w-full bg-black/40 border border-white/5 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 outline-none transition-all"
                      />
                      <button 
                        onClick={() => toggleVisibility(env.key)}
                        className="absolute right-2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showValues.has(env.key) || env.isNew ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div className="w-16 flex items-center justify-end">
                      <button 
                        onClick={() => removeVar(index)}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addVar}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-all mt-4 group"
                >
                  <Plus size={14} className="group-hover:scale-110 transition-transform" /> Add Variable
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
