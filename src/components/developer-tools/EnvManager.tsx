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

interface VaultVar {
  id: string;
  env_key: string;
  env_value: string;
}

interface EnvManagerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EnvManager({ currentProject, isOpen, onClose }: EnvManagerProps) {
  const [configs, setConfigs] = useState<EnvConfig[]>([]);
  const configsRef = useRef<EnvConfig[]>([]);

  const [activeConfigPath, setActiveConfigPath] = useState<string>("global");
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Secure Vault States
  const [activeTab, setActiveTab] = useState<"files" | "vault">("files");
  const [vaultVars, setVaultVars] = useState<VaultVar[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultHasChanges, setVaultHasChanges] = useState(false);

  const [selectedImportPath, setSelectedImportPath] = useState<string>("");
  const [selectedExportPath, setSelectedExportPath] = useState<string>("");

  const updateConfigs = (cfgs: EnvConfig[]) => {
    configsRef.current = cfgs;
    setConfigs(cfgs);
    if (cfgs.length > 0) {
      setSelectedImportPath(cfgs[0].path);
      setSelectedExportPath(cfgs[0].path);
    }
  };

  const fetchEnv = async (allConfigs: EnvConfig[], mode: string) => {
    setLoading(true);
    setError(null);
    let allVars: EnvVar[] = [];

    try {
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

  const fetchVault = async () => {
    if (!currentProject) return;
    setVaultLoading(true);
    setError(null);
    try {
      const result = await invoke<VaultVar[]>("get_vault_vars", { workspaceId: currentProject });
      setVaultVars(result);
      setVaultHasChanges(false);
    } catch (err) {
      console.error("Failed to load vault vars:", err);
      setError("Failed to load secure vault variables");
    } finally {
      setVaultLoading(false);
    }
  };

  const scanProjects = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await invoke<EnvConfig[]>("scan_env_files", {
        cwd: currentProject,
      });
      updateConfigs(res);
      await fetchEnv(res, activeConfigPath);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      const grouped = new Map<string, EnvVar[]>();
      for (const v of envVars) {
        if (!grouped.has(v.config.path)) grouped.set(v.config.path, []);
        grouped.get(v.config.path)!.push(v);
      }

      const inScope =
        activeConfigPath === "global"
          ? configsRef.current
          : configsRef.current.filter((c) => c.path === activeConfigPath);

      for (const config of inScope) {
        const vars = grouped.get(config.path) ?? [];
        const content = vars.map((v) => `${v.key}=${v.value}`).join("\n");
        await invoke("write_file_content", { path: config.path, root: currentProject, content });
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

  const handleSaveVault = async () => {
    if (!currentProject) return;
    setSaving(true);
    try {
      const vars = vaultVars.map(v => ({
        id: v.id ? v.id : null,
        env_key: v.env_key,
        env_value: v.env_value
      }));
      await invoke("save_vault_vars", { workspaceId: currentProject, vars });
      setVaultHasChanges(false);
      await fetchVault();
    } catch (err) {
      console.error("Failed to save vault vars:", err);
      setError("Failed to save secure vault variables");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromEnv = async (configPath: string) => {
    try {
      const content = await invoke<string>("read_file_content", {
        path: configPath,
        root: currentProject,
      });
      const parsedVars = content
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => {
          const eqIdx = line.indexOf("=");
          if (eqIdx === -1) return null;
          const key = line.slice(0, eqIdx).trim();
          const value = line.slice(eqIdx + 1).trim();
          return { key, value };
        })
        .filter((v): v is { key: string; value: string } => v !== null);

      setVaultVars(prev => {
        const next = [...prev];
        for (const pv of parsedVars) {
          const existingIdx = next.findIndex(v => v.env_key === pv.key);
          if (existingIdx !== -1) {
            next[existingIdx] = { ...next[existingIdx], env_value: pv.value };
          } else {
            next.push({ id: "", env_key: pv.key, env_value: pv.value });
          }
        }
        return next;
      });
      setVaultHasChanges(true);
    } catch (err) {
      alert(`Failed to import from .env: ${err}`);
    }
  };

  const handleExportToEnv = async (configPath: string) => {
    try {
      const content = vaultVars.map(v => `${v.env_key}=${v.env_value}`).join("\n");
      await invoke("write_file_content", { path: configPath, root: currentProject, content });
      alert(`Successfully exported secure vault to ${configPath.substring(configPath.lastIndexOf('/') + 1)}!`);
      scanProjects();
    } catch (err) {
      alert(`Failed to export to .env: ${err}`);
    }
  };

  useEffect(() => {
    if (isOpen && currentProject) {
      setActiveConfigPath("global");
      scanProjects();
      if (activeTab === "vault") {
        fetchVault();
      }
    }
  }, [isOpen, currentProject, activeTab]);

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

  const addVaultVar = () => {
    setVaultVars([
      ...vaultVars,
      { id: "", env_key: "", env_value: "" }
    ]);
    setVaultHasChanges(true);
  };

  const updateVaultVar = (index: number, field: "env_key" | "env_value", value: string) => {
    const next = [...vaultVars];
    next[index] = { ...next[index], [field]: value };
    setVaultVars(next);
    setVaultHasChanges(true);
  };

  const removeVaultVar = (index: number) => {
    const next = [...vaultVars];
    next.splice(index, 1);
    setVaultVars(next);
    setVaultHasChanges(true);
  };

  const selectedLabel =
    activeTab === "vault"
      ? `Vault — ${configs.find(c => c.path === activeConfigPath)?.name || "Active Workspace"}`
      : activeConfigPath === "global"
        ? "Global (All Workspaces)"
        : configs.find((c) => c.path === activeConfigPath)?.name ??
          activeConfigPath;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/75 z-[100] animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden w-full max-w-5xl h-[650px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          {/* ── Header ── */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/15 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 w-[240px] shrink-0">
                  <div className={`p-2 rounded-lg border shrink-0 transition-colors ${
                    activeTab === "files" 
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}>
                    <FileKey2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <span className="truncate">Environment Variables</span>
                      {((activeTab === "files" && hasChanges) || (activeTab === "vault" && vaultHasChanges)) && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-[10px] text-amber-400 border border-amber-500/20 uppercase tracking-tighter">
                          Unsaved
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5 truncate">
                      {selectedLabel}
                    </p>
                  </div>
                </div>

                <div className="h-6 w-px bg-zinc-800 shrink-0" />

                {/* ── Tabs Toggle ── */}
                <div className="flex bg-zinc-950/60 p-0.5 rounded-lg border border-zinc-800 shrink-0">
                  <button
                    onClick={() => setActiveTab("files")}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      activeTab === "files"
                        ? "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                        : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    }`}
                  >
                    📁 .env Files
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("vault");
                      fetchVault();
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      activeTab === "vault"
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                        : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                    }`}
                  >
                    🔒 Secure Vault
                  </button>
                </div>

                {/* ── Workspace Selector ── */}
                {activeTab === "files" && (
                  <div className="shrink-0">
                    <Select
                      value={activeConfigPath}
                      onValueChange={(v) => {
                        setActiveConfigPath(v);
                        fetchEnv(configsRef.current, v);
                      }}
                    >
                      <SelectTrigger className="w-[220px] bg-zinc-900 border-zinc-800 text-xs font-bold text-blue-400 focus:ring-1 focus:ring-blue-500/50 shadow-inner h-9">
                        <SelectValue placeholder="Select Workspace..." />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-zinc-800 z-[200]">
                        <SelectItem
                          value="global"
                          className="text-xs font-bold text-white cursor-pointer focus:bg-zinc-900"
                        >
                          🌍 Global (All Workspaces)
                        </SelectItem>
                        {configs.map((cfg) => (
                          <SelectItem
                            key={cfg.path}
                            value={cfg.path}
                            className="text-xs font-medium focus:bg-zinc-900 focus:text-white cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase px-1 border-zinc-800 text-zinc-500"
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
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => activeTab === "files" ? fetchEnv(configsRef.current, activeConfigPath) : fetchVault()}
                  disabled={loading || vaultLoading}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Reload"
                >
                  <RefreshCw
                    size={14}
                    className={loading || vaultLoading ? "animate-spin" : ""}
                  />
                </button>
                <button
                  onClick={activeTab === "files" ? handleSave : handleSaveVault}
                  disabled={activeTab === "files" ? (!hasChanges || saving) : (!vaultHasChanges || saving)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-lg active:scale-95 disabled:bg-zinc-900 disabled:text-zinc-500 ${
                    activeTab === "files"
                      ? "bg-blue-500 hover:bg-blue-600 shadow-blue-500/20 text-white"
                      : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white"
                  }`}
                >
                  <Save size={14} />
                  {saving ? "Saving..." : "Save"}
                </button>
                <div className="w-px h-6 bg-zinc-800 mx-1" />
                <button
                  onClick={onClose}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Sync Utilities Bar (Vault only) ── */}
          {activeTab === "vault" && configs.length > 0 && (
            <div className="mx-4 mt-4 p-3 bg-zinc-900/40 border border-zinc-800 rounded-lg flex items-center justify-between gap-4 shrink-0 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="font-semibold text-emerald-400">🔒 Vault Sync:</span>
                <span>Secure two-way sync with plain-text workspace envs.</span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Import block */}
                <div className="flex items-center gap-1.5">
                  <Select
                    value={selectedImportPath}
                    onValueChange={setSelectedImportPath}
                  >
                    <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-800 text-[10px] h-7 px-2">
                      <SelectValue placeholder="Import file..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-[10px] z-[200]">
                      {configs.map((c) => (
                        <SelectItem key={c.path} value={c.path} className="text-[10px] cursor-pointer">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => handleSyncFromEnv(selectedImportPath)}
                    className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold text-emerald-400 rounded border border-emerald-500/20 transition-all active:scale-95"
                    title="Import decrypted keys into Secure Vault"
                  >
                    Import
                  </button>
                </div>

                <div className="h-4 w-px bg-zinc-800" />

                {/* Export block */}
                <div className="flex items-center gap-1.5">
                  <Select
                    value={selectedExportPath}
                    onValueChange={setSelectedExportPath}
                  >
                    <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-800 text-[10px] h-7 px-2">
                      <SelectValue placeholder="Export file..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-zinc-800 text-[10px] z-[200]">
                      {configs.map((c) => (
                        <SelectItem key={c.path} value={c.path} className="text-[10px] cursor-pointer">
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() => handleExportToEnv(selectedExportPath)}
                    className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-bold text-blue-400 rounded border border-blue-500/20 transition-all active:scale-95"
                    title="Export decrypted vault to plain text .env file"
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Column headers ── */}
          <div className="px-6 py-2 bg-zinc-900/40 border-b border-zinc-800 flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0 mt-2">
            {activeTab === "files" && activeConfigPath === "global" && (
              <div className="w-28 shrink-0">Workspace</div>
            )}
            <div className="flex-[0.4]">Key</div>
            <div className="flex-[0.6] px-4">Value</div>
            <div className="w-16 text-right">Actions</div>
          </div>

          {/* ── Variable list ── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 p-4">
            {activeTab === "vault" ? (
              vaultLoading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw size={20} className="animate-spin text-zinc-500" />
                </div>
              ) : error && vaultVars.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                  <AlertCircle size={48} className="text-zinc-600 mb-3" />
                  <p className="text-sm font-bold text-white mb-1">
                    Vault Error
                  </p>
                  <p className="text-xs text-zinc-500 mb-4">{error}</p>
                </div>
              ) : vaultVars.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                  <AlertCircle size={48} className="text-zinc-600 mb-3" />
                  <p className="text-sm font-bold text-white mb-1">
                    Secure Vault is Empty
                  </p>
                  <p className="text-xs text-zinc-500 mb-4">No encrypted credentials stored for this workspace.</p>
                  <button
                    onClick={addVaultVar}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold text-white transition-colors animate-all active:scale-95"
                  >
                    Add Secure Secret
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {vaultVars.map((env, index) => (
                    <div
                      key={`vault-${index}`}
                      className="flex items-center gap-2 group animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                      <input
                        type="text"
                        placeholder="SECURE_KEY_NAME"
                        value={env.env_key}
                        onChange={(e) => updateVaultVar(index, "env_key", e.target.value)}
                        className="flex-[0.4] min-w-0 bg-zinc-950 border border-zinc-800 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 placeholder:text-zinc-700 outline-none transition-all"
                      />

                      <div className="flex-[0.6] min-w-0 relative flex items-center">
                        <input
                          type={
                            showValues.has(`vault-${index}`)
                              ? "text"
                              : "password"
                          }
                          placeholder="secure value..."
                          value={env.env_value}
                          onChange={(e) =>
                            updateVaultVar(index, "env_value", e.target.value)
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-750 outline-none transition-all"
                        />
                        <button
                          onClick={() => {
                            const next = new Set(showValues);
                            const k = `vault-${index}`;
                            if (next.has(k)) next.delete(k);
                            else next.add(k);
                            setShowValues(next);
                          }}
                          className="absolute right-2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          {showValues.has(`vault-${index}`) ? (
                            <EyeOff size={14} />
                          ) : (
                            <Eye size={14} />
                          )}
                        </button>
                      </div>

                      <div className="w-16 flex items-center justify-end shrink-0">
                        <button
                          onClick={() => removeVaultVar(index)}
                          className="p-2 text-zinc-650 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addVaultVar}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-850 hover:border-emerald-500/30 hover:bg-emerald-500/5 rounded-lg text-xs font-bold text-zinc-500 hover:text-emerald-400 transition-all mt-4 group"
                  >
                    <Plus
                      size={14}
                      className="group-hover:scale-110 transition-transform"
                    />
                    Add Secure Secret
                  </button>
                </div>
              )
            ) : (
              loading ? (
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
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-bold text-white transition-colors"
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
                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-[10px] font-bold text-zinc-400 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-zinc-800 z-[200]">
                              {configs.map((cfg, idx) => (
                                <SelectItem
                                  key={idx}
                                  value={String(idx)}
                                  className="text-[10px] font-medium focus:bg-zinc-900 focus:text-white cursor-pointer"
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
                        className="flex-[0.4] min-w-0 bg-zinc-950 border border-zinc-800 focus:border-blue-500/50 rounded-lg px-3 py-2 text-xs font-mono font-bold text-blue-400 placeholder:text-zinc-700 outline-none transition-all"
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
                          className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-zinc-300 placeholder:text-zinc-750 outline-none transition-all"
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
                          className="p-2 text-zinc-650 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors active:scale-95"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addVar}
                    className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-all mt-4 group"
                  >
                    <Plus
                      size={14}
                      className="group-hover:scale-110 transition-transform"
                    />
                    Add Variable
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
