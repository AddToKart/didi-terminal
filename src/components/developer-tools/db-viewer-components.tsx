import {
  Database,
  Search,
  X,
  Table as TableIcon,
  ChevronRight,
  RefreshCw,
  FileSearch,
  Globe,
  Link2,
  Server,
  CheckCircle2,
  Terminal
} from 'lucide-react';

export interface TableInfo {
  schema?: string;
  name: string;
}

export interface QueryResult {
  columns: string[];
  rows: Array<Array<string | number | boolean | null>>;
  rows_affected: number | null;
}

export type DbMode = "sqlite" | "postgres" | "mysql";

interface DbViewerHeaderProps {
  connectionLabel: string | null;
  dbBadgeColor: string;
  isLoading: boolean;
  dbPath: string | null;
  onRefresh: () => void;
  onClose: () => void;
}

export function DbViewerHeader({ connectionLabel, dbBadgeColor, isLoading, dbPath, onRefresh, onClose }: DbViewerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/10">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Database size={20} className="text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Database Viewer</h2>
          <p className={`text-xs font-medium ${connectionLabel ? dbBadgeColor : 'text-zinc-500'}`}>
            {connectionLabel ?? 'No database selected'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {dbPath && (
          <button
            onClick={onRefresh}
            className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-900/60"
            title="Refresh Tables"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        )}
        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-900/60">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

interface DbSidebarProps {
  tables: TableInfo[];
  selectedTable: TableInfo | null;
  activeTab: "table" | "query";
  dbPath: string | null;
  showRemoteForm: boolean;
  onSelectDb: () => void;
  onDisconnect: () => void;
  onToggleRemoteForm: () => void;
  onSelectTable: (table: TableInfo) => void;
  onOpenQueryConsole: () => void;
}

export function DbSidebar({ tables, selectedTable, activeTab, dbPath, showRemoteForm, onSelectDb, onDisconnect, onToggleRemoteForm, onSelectTable, onOpenQueryConsole }: DbSidebarProps) {
  return (
    <div className="w-64 border-r border-zinc-800/80 bg-[#0a0a0c] flex flex-col">
      <div className="p-4 space-y-2">
        <button
          onClick={onSelectDb}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-lg text-xs font-bold transition-all"
        >
          <FileSearch size={14} />
          LOCAL SQLITE
        </button>
        <button
          onClick={dbPath ? onDisconnect : onToggleRemoteForm}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-xs font-bold transition-all ${
            dbPath
              ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-500'
              : showRemoteForm ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          }`}
        >
          {dbPath ? <X size={14} /> : <Globe size={14} />}
          {dbPath ? 'DISCONNECT' : 'REMOTE SERVER'}
        </button>
        <button
          onClick={onOpenQueryConsole}
          disabled={!dbPath}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-xs font-bold transition-all ${
            activeTab === "query" ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
          } ${!dbPath ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Terminal size={14} />
          SQL CONSOLE
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {tables.length > 0 ? (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">
              Tables ({tables.length})
            </p>
            {tables.map(table => {
              const fullTableName = table.schema ? `${table.schema}.${table.name}` : table.name;
              const isSelected = selectedTable?.name === table.name && selectedTable?.schema === table.schema;
              return (
              <button
                key={fullTableName}
                onClick={() => onSelectTable(table)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all group ${
                  isSelected
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <TableIcon size={14} className={isSelected ? 'text-amber-500' : 'text-zinc-600'} />
                  <span className="truncate text-left" title={fullTableName}>
                    {table.schema && <span className="text-zinc-500 mr-1">{table.schema}.</span>}
                    {table.name}
                  </span>
                </div>
                <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`} />
              </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-30 px-6 text-center">
            <Database size={32} className="mb-2" />
            <p className="text-xs">Select a database to view tables</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface RemoteConnectionFormProps {
  dbMode: DbMode;
  connDetails: { host: string; port: string; username: string; password: string; database: string };
  useConnectionString: boolean;
  remoteUrl: string;
  error: string | null;
  isLoading: boolean;
  onModeChange: (mode: DbMode) => void;
  onConnDetailChange: (field: string, value: string) => void;
  onUseConnectionStringChange: (value: boolean) => void;
  onRemoteUrlChange: (url: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function RemoteConnectionForm({ dbMode, connDetails, useConnectionString, remoteUrl, error, isLoading, onModeChange, onConnDetailChange, onUseConnectionStringChange, onRemoteUrlChange, onSubmit, onCancel }: RemoteConnectionFormProps) {
  return (
    <div className="absolute inset-0 z-20 bg-zinc-950 flex items-center justify-center p-8 animate-in fade-in duration-200 overflow-y-auto">
      <form onSubmit={onSubmit} className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Server size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Connect to Server</h3>
              <p className="text-xs text-zinc-500 font-medium">PostgreSQL or MySQL/MariaDB</p>
            </div>
          </div>
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => onModeChange("postgres")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${dbMode === "postgres" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              PostgreSQL
            </button>
            <button
              type="button"
              onClick={() => onModeChange("mysql")}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${dbMode === "mysql" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              MySQL
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-400/5 border border-red-400/20 rounded-xl flex items-center gap-3 text-red-400 text-[11px]">
            <X size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-5">
          {useConnectionString ? (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Connection String</label>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => onRemoteUrlChange(e.target.value)}
                placeholder={dbMode === "mysql" ? "mysql://user:pass@localhost:3306/db" : "postgres://user:pass@localhost:5432/db"}
                className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
              />
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Host</label>
                <input
                  type="text"
                  value={connDetails.host}
                  onChange={(e) => onConnDetailChange("host", e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="col-span-4 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Port</label>
                <input
                  type="text"
                  value={connDetails.port}
                  onChange={(e) => onConnDetailChange("port", e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="col-span-6 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Username</label>
                <input
                  type="text"
                  value={connDetails.username}
                  onChange={(e) => onConnDetailChange("username", e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="col-span-6 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Password</label>
                <input
                  type="password"
                  value={connDetails.password}
                  onChange={(e) => onConnDetailChange("password", e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="col-span-12 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Database</label>
                <input
                  type="text"
                  value={connDetails.database}
                  onChange={(e) => onConnDetailChange("database", e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between py-2 border-t border-zinc-800/80">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={useConnectionString}
                  onChange={() => onUseConnectionStringChange(!useConnectionString)}
                />
                <div className="w-9 h-5 bg-zinc-800/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500 peer-checked:after:bg-white"></div>
              </label>
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Use Connection String</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-xs bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-300 transition-all border border-zinc-800/80"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Link2 size={16} />}
              {isLoading ? 'CONNECTING...' : 'CONNECT'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

interface TableViewProps {
  columns: string[];
  data: any[];
  filteredData: any[];
  error: string | null;
  selectedTable: TableInfo | null;
  editingCell: { rowIndex: number; colName: string } | null;
  editValue: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCellEdit: (rowIndex: number, colName: string, value: any) => void;
  onEditValueChange: (value: string) => void;
  onCellSave: () => void;
  onEditCancel: () => void;
}

export function TableView({ columns, data, filteredData, error, selectedTable, editingCell, editValue, searchQuery, onSearchChange, onCellEdit, onEditValueChange, onCellSave, onEditCancel }: TableViewProps) {
  return (
    <>
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-zinc-300">
          <TableIcon size={16} />
          <span className="font-bold text-sm tracking-tight">
            {selectedTable?.schema ? `${selectedTable.schema}.${selectedTable.name}` : selectedTable?.name}
          </span>
          <span className="text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-800">{data.length} rows</span>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search in results..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-6 text-red-400 bg-red-400/5 border border-red-400/10 m-6 rounded-lg text-sm flex items-center gap-3">
            <X className="shrink-0" size={16} />
            {error}
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-zinc-950 z-10">
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 bg-zinc-950">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-zinc-900/40 transition-colors group">
                  {columns.map(col => {
                    const isEditing = editingCell?.rowIndex === i && editingCell?.colName === col;
                    return (
                      <td
                        key={col}
                        onDoubleClick={() => onCellEdit(i, col, row[col])}
                        className="px-4 py-2.5 text-xs text-zinc-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-xs group-hover:text-zinc-200"
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => onEditValueChange(e.target.value)}
                            onBlur={onCellSave}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onCellSave();
                              if (e.key === 'Escape') onEditCancel();
                            }}
                            className="w-full bg-zinc-950 text-white border border-blue-500/50 rounded px-2 py-1 outline-none shadow-inner"
                          />
                        ) : (
                          row[col] === null ? <span className="text-zinc-600 italic select-none">null</span> : String(row[col])
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

interface QueryConsoleProps {
  customQuery: string;
  queryResult: QueryResult | null;
  queryError: string | null;
  isLoading: boolean;
  onQueryChange: (query: string) => void;
  onRunQuery: () => void;
}

export function QueryConsole({ customQuery, queryResult, queryError, isLoading, onQueryChange, onRunQuery }: QueryConsoleProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50">
        <textarea
          value={customQuery}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Enter SQL query here... (e.g. SELECT * FROM users)"
          className="w-full h-28 bg-black/50 border border-zinc-800 rounded-xl p-4 text-sm font-mono text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none shadow-inner"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={onRunQuery}
            disabled={isLoading || !customQuery.trim()}
            className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-500/20 transition-colors flex items-center gap-2"
          >
            {isLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
            RUN QUERY
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-[#0a0a0c] p-4">
        {queryError && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono animate-in fade-in">
            {queryError}
          </div>
        )}
        {queryResult && (
          queryResult.rows_affected !== null ? (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-bold flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 size={18} />
              Query executed successfully. {queryResult.rows_affected} rows affected.
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden animate-in fade-in">
              <table className="w-full border-collapse text-left">
                <thead className="bg-zinc-900">
                  <tr>
                    {queryResult.columns.map((col, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800/80">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {queryResult.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-900/20">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2 text-xs text-zinc-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">{cell === null ? <span className="italic opacity-50">null</span> : String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {queryResult.rows.length === 0 && (
                <div className="p-8 text-center text-sm text-zinc-500">No rows returned.</div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface WelcomeScreenProps {
  dbPath: string | null;
  showRemoteForm: boolean;
}

export function WelcomeScreen({ dbPath, showRemoteForm }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-4">
      {dbPath && !showRemoteForm ? (
        <>
          <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-300">Connected!</p>
            <p className="text-xs text-zinc-500 mt-1">Select a table from the sidebar to browse its data</p>
          </div>
        </>
      ) : (
        <>
          <div className="p-6 rounded-full bg-zinc-900/20 border border-zinc-800/80">
            <Database size={48} className="opacity-20" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-400">Select a database to get started</p>
            <p className="text-xs opacity-50 mt-1">Supports SQLite, PostgreSQL, and MySQL</p>
          </div>
        </>
      )}
    </div>
  );
}

interface DbFooterProps {
  dbBadgeColor: string;
  dbMode: DbMode;
  selectedTable: TableInfo | null;
  activeTab: "table" | "query";
  isLoading: boolean;
}

export function DbFooter({ dbBadgeColor, dbMode, selectedTable, activeTab, isLoading }: DbFooterProps) {
  return (
    <div className="px-6 py-2 border-t border-zinc-800 bg-[#09090b] flex items-center justify-between text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
      <div className="flex items-center gap-4">
        <span className={`uppercase ${dbBadgeColor}`}>{dbMode} driver</span>
        {selectedTable && activeTab === "table" && <span>Table: {selectedTable.schema ? `${selectedTable.schema}.${selectedTable.name}` : selectedTable.name}</span>}
        {activeTab === "query" && <span className="text-indigo-400">SQL CONSOLE</span>}
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-amber-500/80 animate-pulse">
          <RefreshCw size={10} className="animate-spin" />
          Executing...
        </div>
      )}
    </div>
  );
}
