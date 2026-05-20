import { useState, useEffect } from "react";
import { 
  X, 
  Package,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

interface ProjectConfig {
  path: string;
  name: string;
  manager: string;
  file_type: string;
}

interface OutdatedPackage {
  current: string;
  wanted: string;
  latest: string;
  type: string; // dependencies, devDependencies
}

interface PackageItem {
  name: string;
  installed: string;
  latest?: string;
  type?: string;
  status: "up-to-date" | "minor" | "major" | "patch" | "unknown";
  manager: string;
}

interface PackageManagerProps {
  currentProject: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PackageManager({ currentProject, isOpen, onClose }: PackageManagerProps) {
  const [configs, setConfigs] = useState<ProjectConfig[]>([]);
  const [activeConfig, setActiveConfig] = useState<ProjectConfig | null>(null);
  
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [updating, setUpdating] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Scan for projects
  useEffect(() => {
    if (isOpen && currentProject) {
      scanProjects();
    }
  }, [isOpen, currentProject]);

  const scanProjects = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const res = await invoke<ProjectConfig[]>("scan_project_configs", { cwd: currentProject });
      setConfigs(res);
      if (res.length > 0) {
        setActiveConfig(res[0]);
      }
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch packages for active project
  useEffect(() => {
    if (activeConfig) {
      fetchPackages(activeConfig);
    }
  }, [activeConfig]);

  // Simulated progress bar for heavy scanning (like npm outdated)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setScanProgress(0);
      interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 500);
    } else {
      setScanProgress(100);
      setTimeout(() => setScanProgress(0), 500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const fetchPackages = async (config: ProjectConfig) => {
    setLoading(true);
    setError(null);
    setPackages([]);
    
    try {
      const content = await invoke<string>("read_file_content", { path: `${config.path}/${config.file_type}`, root: currentProject });
      let pkgs: PackageItem[] = [];

      if (config.manager === "npm") {
        const json = JSON.parse(content);
        const deps = { ...json.dependencies, ...json.devDependencies };
        
        // Fetch outdated via npm outdated --json
        let outdatedData: Record<string, OutdatedPackage> = {};
        try {
          const outdatedStr = await invoke<string>("get_outdated_npm", { cwd: config.path });
          if (outdatedStr) outdatedData = JSON.parse(outdatedStr);
        } catch (e) {
          // If npm outdated returns error code but prints json, it's caught here
          if (typeof e === "string" && e.startsWith("{")) {
             try { outdatedData = JSON.parse(e); } catch {}
          }
        }

        pkgs = Object.entries(deps).map(([name, ver]) => {
          const installed = String(ver);
          const out = outdatedData[name];
          let status: PackageItem["status"] = "up-to-date";
          let latest = installed;

          if (out) {
            latest = out.latest;
            const curParts = out.current ? out.current.split('.') : [];
            const latParts = out.latest ? out.latest.split('.') : [];
            if (curParts[0] !== latParts[0]) status = "major";
            else if (curParts[1] !== latParts[1]) status = "minor";
            else status = "patch";
          }

          return { name, installed, latest, status, manager: "npm" };
        });

      } else if (config.manager === "cargo") {
        // Simple TOML parsing for Cargo
        const lines = content.split('\n');
        let inDeps = false;
        for (const line of lines) {
          if (line.trim().startsWith('[dependencies]') || line.trim().startsWith('[dev-dependencies]')) {
            inDeps = true;
            continue;
          } else if (line.trim().startsWith('[')) {
            inDeps = false;
          }

          if (inDeps && line.includes('=')) {
            const parts = line.split('=');
            if (parts.length >= 2) {
              const name = parts[0].trim();
              const version = parts[1].split('#')[0].trim().replace(/['"{}]/g, ''); // Crude parsing
              if (name) {
                pkgs.push({ name, installed: version, status: "unknown", manager: "cargo" });
              }
            }
          }
        }
      } else if (config.manager === "pip") {
        // requirements.txt
        const lines = content.split('\n');
        for (const line of lines) {
          const clean = line.split('#')[0].trim();
          if (clean) {
            const parts = clean.split(/==|>=|<=|~/);
            const name = parts[0];
            const version = parts.length > 1 ? parts[1] : "latest";
            if (name) pkgs.push({ name, installed: version, status: "unknown", manager: "pip" });
          }
        }
      }

      setPackages(pkgs);
    } catch (err) {
      console.error(err);
      setError("Failed to load dependencies");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (pkgName: string) => {
    if (!activeConfig) return;
    const nextUpdating = new Set(updating);
    nextUpdating.add(pkgName);
    setUpdating(nextUpdating);

    try {
      await invoke("run_package_update", {
        cwd: activeConfig.path,
        manager: activeConfig.manager,
        package: pkgName
      });
      // Refresh
      await fetchPackages(activeConfig);
    } catch (e) {
      console.error(e);
      alert(`Update failed: ${e}`);
    } finally {
      const next = new Set(updating);
      next.delete(pkgName);
      setUpdating(next);
    }
  };

  const handleUpdateAll = async () => {
    if (!activeConfig) return;
    const toUpdate = packages.filter(p => p.status === "minor" || p.status === "patch" || p.status === "major");
    for (const p of toUpdate) {
      await handleUpdate(p.name);
    }
  };

  if (!isOpen) return null;

  const filteredPkgs = packages.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const updatesAvailable = packages.filter(p => p.status === "minor" || p.status === "patch" || p.status === "major").length;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/75 z-[100] animate-in fade-in duration-300" 
        onClick={onClose}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4 pointer-events-none">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl h-[800px] flex flex-col pointer-events-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/15 shrink-0 flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex items-center gap-3 w-[280px] shrink-0">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 shrink-0">
                  <Package size={20} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight truncate">Visual Package Manager</h3>
              </div>
              
              <div className="h-6 w-px bg-zinc-800 mx-4 shrink-0" />

              <div className="shrink-0">
                <Select 
                  value={activeConfig ? String(configs.findIndex(c => c.path === activeConfig.path && c.manager === activeConfig.manager)) : ""} 
                  onValueChange={v => {
                    const cfg = configs[parseInt(v)];
                    if (cfg) setActiveConfig(cfg);
                  }}
                >
                  <SelectTrigger className="w-[200px] bg-zinc-900 border-zinc-800 text-xs font-bold text-blue-400 focus:ring-1 focus:ring-blue-500/50 shadow-inner h-9">
                    <SelectValue placeholder="Select Workspace..." />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="bg-zinc-950 border-zinc-800 z-[200]">
                    {configs.map((cfg, idx) => (
                      <SelectItem key={idx} value={String(idx)} className="text-xs font-medium focus:bg-zinc-900 focus:text-white cursor-pointer">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase px-1 border-zinc-800 text-zinc-500">{cfg.manager}</Badge>
                          <span className="truncate max-w-[120px]">{cfg.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => activeConfig && fetchPackages(activeConfig)}
                disabled={loading}
                className="h-9 border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 animate-none"
              >
                <RefreshCw size={14} className={cn("mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              
              {updatesAvailable > 0 && (
                <Button 
                  onClick={handleUpdateAll}
                  className="h-9 bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  Update All ({updatesAvailable})
                </Button>
              )}
              
              <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg">
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex items-center justify-between shrink-0 relative overflow-hidden">
            {loading && <Progress value={scanProgress} className="absolute bottom-0 left-0 w-full h-[2px] rounded-none bg-transparent [&>div]:bg-blue-500 transition-all duration-300" />}
            <div className="relative w-80 group z-10">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text"
                placeholder="Filter packages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-xs font-medium text-white placeholder:text-zinc-650 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all shadow-inner"
              />
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-zinc-950">
            {loading && packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
                <Loader2 size={32} className="animate-spin text-blue-500/50" />
                <p className="text-sm font-medium">Scanning dependencies... ({scanProgress}%)</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-red-400/80 space-y-2">
                <AlertTriangle size={32} />
                <p className="text-sm font-medium">{error}</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-zinc-900/80 sticky top-0 z-10">
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-[300px] text-xs font-bold text-zinc-400">Package</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-400">Installed</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-400">Latest</TableHead>
                    <TableHead className="text-xs font-bold text-zinc-400">Status</TableHead>
                    <TableHead className="text-right text-xs font-bold text-zinc-400">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPkgs.map((pkg) => {
                    const isUpToDate = pkg.status === "up-to-date" || pkg.status === "unknown";
                    const isUpdating = updating.has(pkg.name);
                    
                    return (
                      <TableRow key={pkg.name} className="border-zinc-900 hover:bg-zinc-900/35 transition-colors group">
                        <TableCell className="font-mono text-xs font-medium text-blue-400">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[250px]">{pkg.name}</span>
                            <a href={`https://www.npmjs.com/package/${pkg.name}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-all">
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-zinc-400">{pkg.installed}</TableCell>
                        <TableCell className="font-mono text-[11px] text-emerald-400">{pkg.latest || "-"}</TableCell>
                        <TableCell>
                          {pkg.status === "major" && <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] uppercase font-bold tracking-wider">Major</Badge>}
                          {pkg.status === "minor" && <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">Minor</Badge>}
                          {pkg.status === "patch" && <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] uppercase font-bold tracking-wider">Patch</Badge>}
                          {isUpToDate && <ShieldCheck size={16} className="text-emerald-500/50" />}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant={isUpToDate ? "ghost" : "default"}
                            size="sm"
                            disabled={isUpToDate || isUpdating}
                            onClick={() => handleUpdate(pkg.name)}
                            className={cn(
                              "h-7 px-4 text-[11px] font-bold transition-all",
                              isUpToDate ? "text-zinc-600 border border-transparent" : "bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            )}
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : (isUpToDate ? "Latest" : "Update")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredPkgs.length === 0 && (
                    <TableRow className="hover:bg-transparent border-0">
                      <TableCell colSpan={5} className="h-32 text-center text-zinc-500 text-sm">
                        No packages match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
            
          {/* Footer Status */}
          <div className="p-3 border-t border-zinc-800 bg-[#09090b] text-[10px] text-zinc-500 font-medium flex justify-between items-center shrink-0">
            <span>Showing {filteredPkgs.length} packages</span>
            {updatesAvailable > 0 && <span className="text-amber-400">{updatesAvailable} updates available</span>}
          </div>
        </div>
      </div>
    </>
  );
}