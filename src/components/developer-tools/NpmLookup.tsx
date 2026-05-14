import { useState } from "react";
import { X, Search, Package, Copy, Check, Loader2, Download, Users, Hash } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface NpmLookupProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NpmPackage {
  name: string;
  description: string;
  version: string;
  license: string;
  homepage?: string;
  repository?: { url: string };
  author?: { name: string };
  maintainers?: { name: string }[];
  keywords?: string[];
}

export function NpmLookup({ isOpen, onClose }: NpmLookupProps) {
  const [query, setQuery] = useState("");
  const [pkg, setPkg] = useState<NpmPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSearch = async () => {
    const name = query.trim().toLowerCase();
    if (!name) return;
    setLoading(true);
    setError(null);
    setPkg(null);
    try {
      const res = await invoke<any>("make_http_request", {
        params: { method: "GET", url: `https://registry.npmjs.org/${encodeURIComponent(name)}`, headers: {}, body: null }
      });
      if (res.status >= 400) {
        setError(`Package "${name}" not found (HTTP ${res.status})`);
        return;
      }
      const data = JSON.parse(res.body);
      setPkg({
        name: data.name,
        description: data.description || "No description",
        version: data["dist-tags"]?.latest || "?",
        license: data.license || "Unknown",
        homepage: data.homepage,
        repository: data.repository,
        author: data.author,
        maintainers: data.maintainers,
        keywords: data.keywords,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2000); } catch { }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-0 sm:p-3">
        <div className="bg-[#0b0b0d]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col w-full max-w-lg h-auto max-h-[80vh] sm:rounded-xl">

          <div className="px-5 pt-5 pb-3 border-b border-white/5 bg-zinc-900/40 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-xl text-red-400 border border-red-500/20"><Package size={18} /></div>
                <div><h3 className="text-sm font-bold text-white">npm Lookup</h3><p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Package registry search</p></div>
              </div>
              <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-all"><X size={14} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
              <div className="relative flex-1 group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-400" />
                <input type="text" placeholder="Search npm packages..." value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40" />
              </div>
              <button type="submit" disabled={loading || !query.trim()}
                className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 disabled:opacity-50 transition-all flex items-center gap-1.5">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                Search
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
            {error && <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-xs text-red-400">{error}</div>}

            {loading && <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-zinc-500" /></div>}

            {pkg && !loading && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20"><Package size={22} className="text-red-400" /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-bold text-white truncate">{pkg.name}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">{pkg.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => handleCopy(pkg.version, "ver")} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-left group">
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 uppercase tracking-wider"><Download size={10} /> Latest</div>
                    <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">{pkg.version}</div>
                    {copied === "ver" && <Check size={10} className="text-emerald-400 mt-0.5" />}
                  </button>
                  <button onClick={() => handleCopy(pkg.license, "lic")} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-left group">
                    <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 uppercase tracking-wider"><Hash size={10} /> License</div>
                    <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">{pkg.license}</div>
                    {copied === "lic" && <Check size={10} className="text-emerald-400 mt-0.5" />}
                  </button>
                </div>

                <button onClick={() => handleCopy(`npm install ${pkg.name}`, "install")}
                  className="w-full px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold font-mono hover:bg-blue-500/20 transition-all flex items-center justify-between group">
                  <span>{`npm install ${pkg.name}`}</span>
                  {copied === "install" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>

                {pkg.keywords && pkg.keywords.length > 0 && (
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Keywords</div>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.keywords.map(k => <span key={k} className="px-2 py-0.5 rounded-full text-[9px] bg-white/5 border border-white/5 text-zinc-500">{k}</span>)}
                    </div>
                  </div>
                )}

                {pkg.maintainers && pkg.maintainers.length > 0 && (
                  <div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users size={10} /> Maintainers</div>
                    <div className="text-xs text-zinc-400">{pkg.maintainers.map(m => m.name).join(", ")}</div>
                  </div>
                )}
              </div>
            )}

            {!pkg && !loading && !error && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600 gap-2">
                <Package size={32} className="opacity-10" />
                <p className="text-xs">Search for an npm package</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
