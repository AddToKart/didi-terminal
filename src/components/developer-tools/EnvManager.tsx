import { useState, useEffect, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface EnvConfig {
  path: string;
  name: string;
}

interface EnvVar {
  key: string;
  value: string;
  isNew?: boolean;
  config: EnvConfig;
}

interface EnvManagerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EnvManager({ currentProject, isOpen, onClose }: EnvManagerProps) {
  const [configs, setConfigs] = useState<EnvConfig[]>([]);
  // Use a ref so async callbacks always have the fresh list of configs
  const configsRef = useRef<EnvConfig[]>([]);

  const [activeConfigPath, setActiveConfigPath] = useState<string>("global");
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Keep ref in sync with state
  const updateConfigs = (cfgs: EnvConfig[]) => {
    configsRef.current = cfgs;
    setConfigs(cfgs);
  };

  /**
   * Read each .env file independently and aggregate the vars with their
   * originating config attached. Each var knows which file it came from,
   * so saves can write back to the correct file without merging anything.
   */
  const fetchEnv = async (allConfigs: EnvConfig[], mode: string) => {
    setLoading(true);
    setError(null);
    let allVars: EnvVar[] = [];

    try {
      // In global mode: read ALL discovered configs.
      // In a specific mode: read only the one .env whose path matches.
      const targetConfigs =
        mode === "global"
          ? allConfigs
          : allConfigs.filter((c) => c.path === mode);

      if (targetConfigs.length === 0 && mode !== "global") {
        setError("Could not find the selected .env file.");
        setLoading(false);
        return;
      }

      for (const config of targetConfigs) {
        try {
          const content = await invoke<string>("read_file_content", {
            path: config.path,
            root: currentProject,
          });
          const parsedVars: EnvVar[] = content
            .split("\n")
            .filter((line) => line.trim() && !line.trim().startsWith("#"))
            .map((line) => {
              const eqIdx = line.indexOf("=");
              if (eqIdx === -1) return null;
              const key = line.slice(0, eqIdx).trim();
              const value = line.slice(eqIdx + 1).trim();
              return { key, value, config };
            })
            .filter((v): v is EnvVar => v !== null);

          allVars = [...allVars, ...parsedVars];
        } catch (e) {
          console.warn("Could not read", config.path, e);
          // Don't abort — continue with other configs
        }
      }

      setEnvVars(allVars);
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to read .env:", err);
      setError("Failed to load environment variables.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initial scan: discover all .env files in the project tree, then load
   * them according to the current mode. We pass the freshly-scanned list
   * directly to fetchEnv so we never depend on a stale state snapshot.
   */
  const scanProjects = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await invoke<EnvConfig[]>("scan_env_files", {
        cwd: currentProject,
      });
      updateConfigs(res);
      // Pass res directly — state update above is async and not yet reflected
      await fetchEnv(res, activeConfigPath);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setLoading(false);
    }
  };

  /**
   * Save writes ONLY to the files that are in scope for the current mode:
   *  - global: writes each file its own vars (never merges files together)
   *  - specific path: writes only that one file
   * This prevents accidental cross-contamination between frontend/.env and
   * backend/.env.
   */
  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      // Group vars back by their originating config path
      const grouped = new Map<string, EnvVar[]>();
      for (const v of envVars) {
        if (!grouped.has(v.config.path)) grouped.set(v.config.path, []);
        grouped.get(v.config.path)!.push(v);
      }

      // Determine which config files are in scope
      const inScope =
        activeConfigPath === "global"
          ? configsRef.current
          : configsRef.current.filter((c) => c.path === activeConfigPath);

      for (const config of inScope) {
        const vars = grouped.get(config.path) ?? [];
        // Preserve empty files — write an empty string rather than skipping
        const content = vars.map((v) => `${v.key}=${v.value}`).join("\n");
        await invoke("write_file_content", { path: config.path, content });
      }

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
    if (isOpen && currentProject) {
      // Reset to global view on each open
      setActiveConfigPath("global");
      scanProjects();
    }
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const toggleVisibility = (key: string) => {
    const next = new Set(showValues);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setShowValues(next);
  };

  const updateVar = (
    index: number,
    field: "key" | "value" | "config",
    newValue: any
  ) => {
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
    // Default the new var's config to the currently selected file,
    // or the first discovered config if in global mode.
    const defaultConfig =
      activeConfigPath === "global"
        ? configs.length > 0
          ? configs[0]
          : { path: `${currentProject}/.env`, name: "root" }
        : configs.find((c) => c.path === activeConfigPath) ?? {
            path: `${currentProject}/.env`,
            name: "root",
          };

    setEnvVars([
      ...envVars,
      { key: "", value: "", isNew: true, config: defaultConfig },
    ]);
    setHasChanges(true);
  };

  // Display label for the currently selected scope
  const selectedLabel =
    activeConfigPath === "global"
      ? "Global (All Workspaces)"
      : configs.find((c) => c.path === activeConfigPath)?.name ??
        activeConfigPath;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-500"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden w-full max-w-4xl h-[650px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          {/* ── Header ── */}
          <div className="p-5 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <div className="flex items-center gap-3 w-[260px] shrink-0">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20 shrink-0">
                    <FileKey2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span className="truncate">Environment Variables</span>
                      {hasChanges && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-[10px] text-amber-400 border border-amber-500/20 uppercase tracking-tighter">
                          Unsaved
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5 truncate">
                      .env Manager — {selectedLabel}
                    </p>
                  </div>
                </div>

                <div className="h-6 w-px bg-white/10 mx-4 shrink-0" />

                {/* ── Workspace Selector ── */}
                <div className="shrink-0">
                  <Select
                    value={activeConfigPath}
                    onValueChange={(v) => {
                      setActiveConfigPath(v);
                      // Use configsRef so the closure always has the latest list
                      fetchEnv(configsRef.current, v);
                    }}
                  >
                    <SelectTrigger className="w-[220px] bg-black/40 border-white/10 text-xs font-bold text-blue-400 focus:ring-1 focus:ring-blue-500/50 shadow-inner h-9">
                      <SelectValue placeholder="Select Workspace..." />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-white/10 z-[200]">
                      <SelectItem
                        value="global"
                        className="text-xs font-bold text-white cursor-pointer focus:bg-white/10"
                      >
                        🌍 Global (All Workspaces)
                      </SelectItem>
                      {configs.map((cfg) => (
                        <SelectItem
                          key={cfg.path}
                          value={cfg.path}
                          className="text-xs font-medium focus:bg-white/10 focus:text-white cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase px-1 border-white/10 text-zinc-500"
                            >
                              ENV
                            </Badge>
                            <span className="truncate max-w-[140px]">{cfg.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchEnv(configsRef.current, activeConfigPath)}
                  disabled={loading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Reload from disk"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? "animate-spin" : ""}
                  />
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

          {/* ── Column headers ── */}
          <div className="px-6 py-2 bg-black/40 border-b border-white/5 flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">
            {activeConfigPath === "global" && (
              <div className="w-28 shrink-0">Workspace</div>
            )}
            <div className="flex-[0.4]">Key</div>
            <div className="flex-[0.6] px-4">Value</div>
            <div className="w-16 text-right">Actions</div>
          </div>

          {/* ── Variable list ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 p-4">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw size={20} className="animate-spin text-zinc-500" />
              </div>
            ) : error && envVars.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <AlertCircle size={48} className="text-zinc-600 mb-3" />
                <p className="text-sm font-bold text-white mb-1">
                  No .env found
                </p>
                <p className="text-xs text-zinc-500 mb-4">{error}</p>
                <button
                  onClick={addVar}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold text-white transition-colors"
                >
                  Create New Variable
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {envVars.map((env, index) => (
                  <div
                    key={`${env.config.path}-${index}`}
                    className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    {/* Workspace badge — only in global mode */}
                    {activeConfigPath === "global" && (
                      <div className="w-28 shrink-0">
                        <Select
                          value={String(
                            configs.findIndex(
                              (c) => c.path === env.config.path
                            )
                          )}
                          onValueChange={(v) => {
                            const cfg = configs[parseInt(v)];
                            if (cfg) updateVar(index, "config", cfg);
                          }}
                        >
                          <SelectTrigger className="w-full bg-black/40 border-white/5 text-[10px] font-bold text-zinc-400 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-white/10 z-[200]">
                            {configs.map((cfg, idx) => (
                              <SelectItem
                                key={idx}
                                value={String(idx)}
                                className="text-[10px] font-medium focus:bg-white/10 focus:text-white cursor-pointer"
                              >
                                {cfg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="KEY_NAME"
                      value={env.key}
                      onChange={(e) => updateVar(index, "key", e.target.value)}
                      className="flex-[0.4] min-w-0 bg-black/40 border border-white/5 focus:border-blue-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-400 placeholder:text-zinc-700 outline-none transition-all"
                    />

                    <div className="flex-[0.6] min-w-0 relative flex items-center">
                      <input
                        type={
                          showValues.has(env.key) || env.isNew
                            ? "text"
                            : "password"
                        }
                        placeholder="value..."
                        value={env.value}
                        onChange={(e) =>
                          updateVar(index, "value", e.target.value)
                        }
                        className="w-full bg-black/40 border border-white/5 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 outline-none transition-all"
                      />
                      <button
                        onClick={() => toggleVisibility(env.key)}
                        className="absolute right-2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showValues.has(env.key) || env.isNew ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>

                    <div className="w-16 flex items-center justify-end shrink-0">
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
                  <Plus
                    size={14}
                    className="group-hover:scale-110 transition-transform"
                  />
                  Add Variable
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
