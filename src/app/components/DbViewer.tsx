import { useState } from 'react';
import { 
  Database as DbIcon, 
  Search, 
  X, 
  Table as TableIcon, 
  ChevronRight, 
  RefreshCw,
  FileSearch,
  Database,
  Globe,
  Link2,
  Server
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import SqlDatabase from "@tauri-apps/plugin-sql";

interface DbViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DbViewer({ isOpen, onClose }: DbViewerProps) {
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [dbType, setDbType] = useState<"sqlite" | "postgres" | "mysql">("sqlite");
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [connDetails, setConnDetails] = useState({
    host: "localhost",
    port: "5432",
    username: "postgres",
    password: "",
    database: "postgres"
  });

  const handleSelectDb = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
      });
      if (selected && typeof selected === 'string') {
        setDbPath(selected);
        setSelectedTable(null);
        setData([]);
        setColumns([]);
        loadTables(selected);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleConnectRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let url = remoteUrl;
      if (!useConnectionString) {
        const { host, port, username, password, database } = connDetails;
        const protocol = dbType === "mysql" ? "mysql" : "postgres";
        url = `${protocol}://${username}:${password}@${host}:${port}/${database}`;
      }

      if (url.startsWith("postgres://")) setDbType("postgres");
      else if (url.startsWith("mysql://")) setDbType("mysql");
      else throw new Error("URL must start with postgres:// or mysql://");
      
      setDbPath(url);
      setSelectedTable(null);
      setData([]);
      setColumns([]);
      setShowRemoteForm(false);
      await loadTables(url);
    } catch (err) {
      setError(String(err));
    }
  };

  const loadTables = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const db = await SqlDatabase.load(path.startsWith("sqlite:") ? path : (path.includes("://") ? path : `sqlite:${path}`));
      
      let query = "";
      if (path.startsWith("postgres://")) {
        query = "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public'";
      } else if (path.startsWith("mysql://")) {
        query = "SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE()";
      } else {
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
      }

      const result = await db.select<{ name: string }[]>(query);
      setTables(result.map(r => r.name));
    } catch (err) {
      setError(`Failed to load tables: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTableData = async (table: string) => {
    if (!dbPath) return;
    setIsLoading(true);
    setError(null);
    setSelectedTable(table);
    try {
      const connectionStr = dbPath.startsWith("sqlite:") ? dbPath : (dbPath.includes("://") ? dbPath : `sqlite:${dbPath}`);
      const db = await SqlDatabase.load(connectionStr);
      
      // Handle quoting differences
      const quote = dbPath.startsWith("postgres://") ? '"' : (dbPath.startsWith("mysql://") ? '`' : '"');
      const result = await db.select<any[]>(`SELECT * FROM ${quote}${table}${quote} LIMIT 100`);
      
      setData(result);
      if (result.length > 0) {
        setColumns(Object.keys(result[0]));
      } else {
        // Fallback column fetching if table is empty
        if (dbPath.startsWith("postgres://")) {
          const cols = await db.select<{ column_name: string }[]>(`SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`);
          setColumns(cols.map(c => c.column_name));
        } else if (dbPath.startsWith("mysql://")) {
          const cols = await db.select<{ COLUMN_NAME: string }[]>(`SELECT COLUMN_NAME FROM information_schema.columns WHERE table_name = '${table}' AND table_schema = DATABASE()`);
          setColumns(cols.map(c => c.COLUMN_NAME));
        } else {
          const cols = await db.select<{ name: string }[]>(`PRAGMA table_info("${table}")`);
          setColumns(cols.map(c => c.name));
        }
      }
    } catch (err) {
      setError(`Failed to load data: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter(row => 
    Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-6xl h-[80vh] bg-zinc-900/90 border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Database size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Database Viewer</h2>
              <p className="text-xs text-zinc-500 font-medium">
                {dbPath 
                  ? (dbPath.includes("://") ? dbPath.split('@').pop() : dbPath.split(/[\\/]/).pop()) 
                  : 'No database selected'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {dbPath && (
              <button 
                onClick={() => loadTables(dbPath)}
                className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                title="Refresh Tables"
              >
                <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* Sidebar - Tables List */}
          <div className="w-64 border-r border-white/5 bg-black/20 flex flex-col">
            <div className="p-4 space-y-2">
              <button 
                onClick={handleSelectDb}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-lg text-xs font-bold transition-all"
              >
                <FileSearch size={14} />
                LOCAL SQLITE
              </button>
              <button 
                onClick={() => setShowRemoteForm(!showRemoteForm)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-xs font-bold transition-all ${
                  showRemoteForm ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-300'
                }`}
              >
                <Globe size={14} />
                REMOTE SERVER
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {tables.length > 0 ? (
                <div className="space-y-1">
                  <p className="px-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Tables</p>
                  {tables.map(table => (
                    <button
                      key={table}
                      onClick={() => loadTableData(table)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all group ${
                        selectedTable === table 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <TableIcon size={14} className={selectedTable === table ? 'text-amber-500' : 'text-zinc-600'} />
                        <span className="truncate">{table}</span>
                      </div>
                      <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${selectedTable === table ? 'opacity-100' : ''}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full opacity-30 px-6 text-center">
                  <DbIcon size={32} className="mb-2" />
                  <p className="text-xs">Select a database to view tables</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Table Data */}
          <div className="flex-1 flex flex-col min-w-0 bg-black/10 relative">
            {showRemoteForm ? (
              <div className="absolute inset-0 z-20 bg-zinc-900/95 backdrop-blur flex items-center justify-center p-8 animate-in fade-in duration-200 overflow-y-auto">
                <form onSubmit={handleConnectRemote} className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-xl p-8 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Server size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Connect to Server</h3>
                        <p className="text-xs text-zinc-500 font-medium">PostgreSQL or MySQL/MariaDB</p>
                      </div>
                    </div>
                    
                    <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
                      <button 
                        type="button"
                        onClick={() => {
                          setDbType("postgres");
                          setConnDetails(prev => ({ ...prev, port: "5432" }));
                        }}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${dbType === "postgres" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                      >
                        PostgreSQL
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setDbType("mysql");
                          setConnDetails(prev => ({ ...prev, port: "3306" }));
                        }}
                        className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${dbType === "mysql" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
                      >
                        MySQL
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-5">
                    {useConnectionString ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Connection String</label>
                        <input 
                          type="text"
                          value={remoteUrl}
                          onChange={(e) => setRemoteUrl(e.target.value)}
                          placeholder={dbType === "mysql" ? "mysql://user:pass@localhost:3306/db" : "postgres://user:pass@localhost:5432/db"}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="col-span-8 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Host</label>
                          <input 
                            type="text"
                            value={connDetails.host}
                            onChange={(e) => setConnDetails(prev => ({ ...prev, host: e.target.value }))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="col-span-4 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Port</label>
                          <input 
                            type="text"
                            value={connDetails.port}
                            onChange={(e) => setConnDetails(prev => ({ ...prev, port: e.target.value }))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="col-span-6 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Username</label>
                          <input 
                            type="text"
                            value={connDetails.username}
                            onChange={(e) => setConnDetails(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="col-span-6 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Password</label>
                          <input 
                            type="password"
                            value={connDetails.password}
                            onChange={(e) => setConnDetails(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div className="col-span-12 space-y-2">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Database</label>
                          <input 
                            type="text"
                            value={connDetails.database}
                            onChange={(e) => setConnDetails(prev => ({ ...prev, database: e.target.value }))}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={useConnectionString}
                            onChange={() => setUseConnectionString(!useConnectionString)}
                          />
                          <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-white"></div>
                        </label>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Use Connection String</span>
                      </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowRemoteForm(false)}
                        className="flex-1 px-6 py-3 rounded-xl font-bold text-xs bg-white/5 hover:bg-white/10 text-zinc-300 transition-all border border-white/5"
                      >
                        CANCEL
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-6 py-3 rounded-xl font-bold text-xs bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <Link2 size={16} /> CONNECT
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            ) : null}

            {selectedTable ? (
              <>
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <TableIcon size={16} />
                    <span className="font-bold text-sm tracking-tight">{selectedTable}</span>
                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500">{data.length} rows</span>
                  </div>
                  
                  <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search in results..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  {error && !showRemoteForm ? (
                    <div className="p-6 text-red-400 bg-red-400/5 border border-red-400/10 m-6 rounded-lg text-sm flex items-center gap-3">
                      <X className="shrink-0" size={16} />
                      {error}
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-zinc-900 z-10">
                        <tr>
                          {columns.map(col => (
                            <th key={col} className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {filteredData.map((row, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                            {columns.map(col => (
                              <td key={col} className="px-4 py-2.5 text-xs text-zinc-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-xs group-hover:text-zinc-200">
                                {String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
                <div className="p-6 rounded-full bg-white/[0.02] border border-white/5">
                  <Database size={48} className="opacity-20" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-400">Select a table to browse its data</p>
                  <p className="text-xs opacity-50 mt-1">Supports SQLite, PostgreSQL, and MySQL</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span className="uppercase text-zinc-500">{dbType} Database</span>
            {selectedTable && <span>Active Table: {selectedTable}</span>}
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-amber-500/80 animate-pulse">
              <RefreshCw size={10} className="animate-spin" />
              Executing Query...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
