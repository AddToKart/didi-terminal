import { useState, useEffect } from "react";
import { 
  X, 
  Package,
  Play,
  Box,
  RefreshCw,
  Search,
  ExternalLink
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageManagerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PackageManager({ currentProject, isOpen, onClose }: PackageManagerProps) {
  const [pkg, setPkg] = useState<PackageJson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"scripts" | "dependencies" | "devDependencies">("scripts");

  const fetchPackage = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const content = await invoke<string>("read_file_content", { path: `${currentProject}/package.json` });
      setPkg(JSON.parse(content));
      setError(null);
    } catch (err) {
      console.error("Failed to read package.json:", err);
      setError("Failed to read package.json file");
      setPkg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPackage();
    }
  }, [isOpen, currentProject]);

  if (!isOpen) return null;

  const scripts = Object.entries(pkg?.scripts || {});
  const deps = Object.entries(pkg?.dependencies || {});
  const devDeps = Object.entries(pkg?.devDependencies || {});

  const renderScripts = () => {
    const filtered = scripts.filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtered.length === 0) return <div className="p-4 text-center text-zinc-500 text-xs">No scripts found.</div>;

    return (
      <div className="grid grid-cols-2 gap-2">
        {filtered.map(([name, cmd]) => (
          <div key={name} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all group">
            <div className="min-w-0 flex-1 pr-3">
              <div className="text-xs font-bold text-zinc-200 truncate">{name}</div>
              <div className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{cmd}</div>
            </div>
            <button 
              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md transition-all shrink-0 active:scale-90"
              title={`Run ${name}`}
              onClick={() => {
                // In the future, this could trigger a new terminal tab running the script
                navigator.clipboard.writeText(`npm run ${name}`);
                alert(`Copied "npm run ${name}" to clipboard!`);
              }}
            >
              <Play size={14} className="ml-0.5" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderDeps = (dependencies: [string, string][]) => {
    const filtered = dependencies.filter(([name]) => name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filtered.length === 0) return <div className="p-4 text-center text-zinc-500 text-xs">No dependencies found.</div>;

    return (
      <div className="space-y-1">
        {filtered.map(([name, version]) => (
          <div key={name} className="flex items-center justify-between px-4 py-2 bg-black/20 hover:bg-white/[0.02] border border-transparent hover:border-white/5 rounded-lg transition-all group">
            <div className="flex items-center gap-3">
              <Box size={14} className="text-zinc-600 group-hover:text-purple-400 transition-colors" />
              <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">{name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 bg-white/5 px-2 py-0.5 rounded">{version}</span>
              <button 
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-white transition-all"
                onClick={() => window.open(`https://www.npmjs.com/package/${name}`, '_blank')}
                title="View on NPM"
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
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
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    Package Manager
                    {pkg?.name && (
                      <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] text-zinc-300 border border-white/5 font-mono">
                        {pkg.name} {pkg.version && `v${pkg.version}`}
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">package.json Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchPackage}
                  disabled={loading}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Reload from disk"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
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

            <div className="flex items-center gap-4">
              <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                {(["scripts", "dependencies", "devDependencies"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                      activeTab === tab 
                        ? "bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/30" 
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {tab}
                    {tab === "scripts" && <span className="ml-1.5 text-[9px] bg-black/40 px-1 rounded">{scripts.length}</span>}
                    {tab === "dependencies" && <span className="ml-1.5 text-[9px] bg-black/40 px-1 rounded">{deps.length}</span>}
                    {tab === "devDependencies" && <span className="ml-1.5 text-[9px] bg-black/40 px-1 rounded">{devDeps.length}</span>}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-purple-500 transition-colors">
                  <Search size={14} />
                </div>
                <input 
                  type="text"
                  placeholder="Filter scripts or dependencies..."
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-1.5 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/30 transition-all shadow-inner h-[34px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 p-4">
            {error ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <Package size={48} className="text-zinc-600 mb-3" />
                <p className="text-sm font-bold text-white mb-2">{error}</p>
                <p className="text-[11px] text-zinc-500 max-w-xs">Make sure you are in a Node.js project directory containing a valid package.json file.</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === "scripts" && renderScripts()}
                {activeTab === "dependencies" && renderDeps(deps)}
                {activeTab === "devDependencies" && renderDeps(devDeps)}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
