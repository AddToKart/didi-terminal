import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import SqlDatabase from "@tauri-apps/plugin-sql";
import { TableInfo, QueryResult, DbMode, DbViewerHeader, DbSidebar, RemoteConnectionForm, TableView, QueryConsole, WelcomeScreen, DbFooter } from "@/components/developer-tools/db-viewer-components";

interface DbViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DbViewer({ isOpen, onClose }: DbViewerProps) {
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showRemoteForm, setShowRemoteForm] = useState(false);
  const [dbMode, setDbMode] = useState<DbMode>("sqlite");
  const [useConnectionString, setUseConnectionString] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [connDetails, setConnDetails] = useState({
    host: "localhost",
    port: "5432",
    username: "postgres",
    password: "",
    database: "postgres"
  });
  const [connectionLabel, setConnectionLabel] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"table" | "query">("table");
  const [customQuery, setCustomQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // ── SQLite (local file) ──────────────────────────────────────────
  const handleSelectDb = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }]
      });
      if (selected && typeof selected === 'string') {
        setDbPath(selected);
        setDbMode("sqlite");
        setSelectedTable(null);
        setData([]);
        setColumns([]);
        setConnectionLabel(selected.split(/[/\\]/).pop() ?? selected);
        await loadSqliteTables(selected);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const loadSqliteTables = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const db = await SqlDatabase.load(`sqlite:${path}`);
      const result = await db.select<{ name: string }[]>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      setTables(result.map(r => ({ name: r.name })));
    } catch (err) {
      setError(`Failed to load tables: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Remote (Postgres / MySQL) via Rust backend ───────────────────
  const buildConnectionString = (): string => {
    if (useConnectionString) return remoteUrl;
    const { host, port, username, password, database } = connDetails;
    const proto = dbMode === "mysql" ? "mysql" : "postgres";
    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    return `${proto}://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
  };

  const handleConnectRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const url = buildConnectionString();
      const isPostgres = url.startsWith("postgres://") || url.startsWith("postgresql://");
      const isMysql   = url.startsWith("mysql://");

      if (!isPostgres && !isMysql) {
        throw new Error("URL must start with postgres:// or mysql://");
      }

      const mode: DbMode = isPostgres ? "postgres" : "mysql";

      // Use our custom Rust commands — bypass the plugin allowlist entirely
      const tables = isPostgres
        ? await invoke<TableInfo[]>("db_get_postgres_tables", { connectionString: url })
        : await invoke<TableInfo[]>("db_get_mysql_tables",   { connectionString: url });

      setDbPath(url);
      setDbMode(mode);
      setTables(tables);
      setSelectedTable(null);
      setData([]);
      setColumns([]);
      setShowRemoteForm(false);

      const hostLabel = url.split("@").pop()?.split("/").slice(0, 2).join("/") ?? url;
      setConnectionLabel(hostLabel);
    } catch (err) {
      setError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Load table data ───────────────────────────────────────────────
  const loadTableData = async (tableInfo: TableInfo) => {
    if (!dbPath) return;
    setIsLoading(true);
    setError(null);
    setSelectedTable(tableInfo);
    setActiveTab("table");

    const tableIdent = tableInfo.schema ? `"${tableInfo.schema}"."${tableInfo.name}"` : `"${tableInfo.name}"`;
    const tableIdentMysql = tableInfo.schema ? `\`${tableInfo.schema}\`.\`${tableInfo.name}\`` : `\`${tableInfo.name}\``;

    try {
      if (dbMode === "sqlite") {
        const db = await SqlDatabase.load(`sqlite:${dbPath}`);
        const result = await db.select<any[]>(`SELECT * FROM "${tableInfo.name}" LIMIT 100`);
        setData(result);
        if (result.length > 0) {
          setColumns(Object.keys(result[0]));
        } else {
          const cols = await db.select<{ name: string }[]>(`PRAGMA table_info("${tableInfo.name}")`);
          setColumns(cols.map(c => c.name));
        }
      } else if (dbMode === "postgres") {
        const result = await invoke<QueryResult>("db_query_postgres", {
          connectionString: dbPath,
          query: `SELECT * FROM ${tableIdent} LIMIT 100`
        });
        setColumns(result.columns);
        setData(result.rows.map(row =>
          Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
        ));
      } else {
        const result = await invoke<QueryResult>("db_query_mysql", {
          connectionString: dbPath,
          query: `SELECT * FROM ${tableIdentMysql} LIMIT 100`
        });
        setColumns(result.columns);
        setData(result.rows.map(row =>
          Object.fromEntries(result.columns.map((col, i) => [col, row[i]]))
        ));
      }
    } catch (err) {
      setError(`Failed to load data: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runCustomQuery = async () => {
    if (!dbPath || !customQuery.trim()) return;
    setIsLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      if (dbMode === "sqlite") {
        const db = await SqlDatabase.load(`sqlite:${dbPath}`);
        const isSelect = customQuery.trim().toUpperCase().startsWith("SELECT") || customQuery.trim().toUpperCase().startsWith("PRAGMA") || customQuery.trim().toUpperCase().startsWith("WITH");
        if (isSelect) {
          const result = await db.select<any[]>(customQuery);
          if (result.length > 0) {
            setQueryResult({ columns: Object.keys(result[0]), rows: result.map(r => Object.values(r)), rows_affected: null });
          } else {
            setQueryResult({ columns: [], rows: [], rows_affected: null });
          }
        } else {
          const result = await db.execute(customQuery);
          setQueryResult({ columns: [], rows: [], rows_affected: result.rowsAffected });
        }
      } else if (dbMode === "postgres") {
        const result = await invoke<QueryResult>("db_query_postgres", { connectionString: dbPath, query: customQuery });
        setQueryResult(result);
      } else {
        const result = await invoke<QueryResult>("db_query_mysql", { connectionString: dbPath, query: customQuery });
        setQueryResult(result);
      }
    } catch (err) {
      setQueryError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTables = async () => {
    if (!dbPath) return;
    if (dbMode === "sqlite") {
      await loadSqliteTables(dbPath);
    } else if (dbMode === "postgres") {
      setIsLoading(true);
      setError(null);
      try {
        const t = await invoke<TableInfo[]>("db_get_postgres_tables", { connectionString: dbPath });
        setTables(t);
      } catch (err) { setError(String(err)); } finally { setIsLoading(false); }
    } else {
      setIsLoading(true);
      setError(null);
      try {
        const t = await invoke<TableInfo[]>("db_get_mysql_tables", { connectionString: dbPath });
        setTables(t);
      } catch (err) { setError(String(err)); } finally { setIsLoading(false); }
    }
  };

  const handleCellEdit = (rowIndex: number, colName: string, value: any) => {
    setEditingCell({ rowIndex, colName });
    setEditValue(value === null ? "" : String(value));
  };

  const handleCellSave = async () => {
    if (!editingCell || !selectedTable || !dbPath) return;
    const { rowIndex, colName } = editingCell;
    const row = filteredData[rowIndex];
    const oldVal = row[colName];
    if (String(oldVal) === editValue || (oldVal === null && editValue === "")) {
      setEditingCell(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const tableIdent = selectedTable.schema ? `"${selectedTable.schema}"."${selectedTable.name}"` : `"${selectedTable.name}"`;
      const tableIdentMysql = selectedTable.schema ? `\`${selectedTable.schema}\`.\`${selectedTable.name}\`` : `\`${selectedTable.name}\``;

      const formatVal = (val: any) => {
        if (val === null || val === "") return "NULL";
        if (typeof val === "number" && !isNaN(val)) return val;
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const setClause = dbMode === "mysql" ? `\`${colName}\` = ${formatVal(editValue)}` : `"${colName}" = ${formatVal(editValue)}`;

      const whereClauses = columns.map(col => {
        const val = row[col];
        const colIdent = dbMode === "mysql" ? `\`${col}\`` : `"${col}"`;
        if (val === null || val === "") return `${colIdent} IS NULL`;
        return `${colIdent} = ${formatVal(val)}`;
      }).join(" AND ");

      const query = `UPDATE ${dbMode === "mysql" ? tableIdentMysql : tableIdent} SET ${setClause} WHERE ${whereClauses}`;

      if (dbMode === "sqlite") {
        const db = await SqlDatabase.load(`sqlite:${dbPath}`);
        await db.execute(query);
      } else if (dbMode === "postgres") {
        await invoke("db_query_postgres", { connectionString: dbPath, query });
      } else {
        await invoke("db_query_mysql", { connectionString: dbPath, query });
      }

      const newData = [...data];
      const actualIndex = data.findIndex(r => r === row);
      if (actualIndex !== -1) {
        newData[actualIndex] = { ...row, [colName]: editValue === "" ? null : editValue };
        setData(newData);
      }
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setIsLoading(false);
      setEditingCell(null);
    }
  };

  const handleDisconnect = () => {
    setDbPath(null);
    setTables([]);
    setSelectedTable(null);
    setData([]);
    setColumns([]);
    setConnectionLabel(null);
    setActiveTab("table");
    setError(null);
    setShowRemoteForm(false);
  };

  const filteredData = data.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (!isOpen) return null;

  const dbBadgeColor = dbMode === "postgres" ? "text-blue-400" : dbMode === "mysql" ? "text-orange-400" : "text-amber-400";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      <div className="relative w-full max-w-6xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <DbViewerHeader
          connectionLabel={connectionLabel}
          dbBadgeColor={dbBadgeColor}
          isLoading={isLoading}
          dbPath={dbPath}
          onRefresh={refreshTables}
          onClose={onClose}
        />

        <div className="flex-1 flex min-h-0">
          <DbSidebar
            tables={tables}
            selectedTable={selectedTable}
            activeTab={activeTab}
            dbPath={dbPath}
            showRemoteForm={showRemoteForm}
            onSelectDb={handleSelectDb}
            onDisconnect={handleDisconnect}
            onToggleRemoteForm={() => { setShowRemoteForm(!showRemoteForm); setError(null); }}
            onSelectTable={loadTableData}
            onOpenQueryConsole={() => { setActiveTab("query"); setSelectedTable(null); }}
          />

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-black/10 relative">
            {showRemoteForm && (
              <RemoteConnectionForm
                dbMode={dbMode}
                connDetails={connDetails}
                useConnectionString={useConnectionString}
                remoteUrl={remoteUrl}
                error={error}
                isLoading={isLoading}
                onModeChange={(mode) => { setDbMode(mode); setConnDetails(prev => ({ ...prev, port: mode === "mysql" ? "3306" : "5432" })); }}
                onConnDetailChange={(field, value) => setConnDetails(prev => ({ ...prev, [field]: value }))}
                onUseConnectionStringChange={setUseConnectionString}
                onRemoteUrlChange={setRemoteUrl}
                onSubmit={handleConnectRemote}
                onCancel={() => { setShowRemoteForm(false); setError(null); }}
              />
            )}

            {selectedTable ? (
              <TableView
                columns={columns}
                data={data}
                filteredData={filteredData}
                error={error}
                selectedTable={selectedTable}
                editingCell={editingCell}
                editValue={editValue}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCellEdit={handleCellEdit}
                onEditValueChange={setEditValue}
                onCellSave={handleCellSave}
                onEditCancel={() => setEditingCell(null)}
              />
            ) : activeTab === "query" ? (
              <QueryConsole
                customQuery={customQuery}
                queryResult={queryResult}
                queryError={queryError}
                isLoading={isLoading}
                onQueryChange={setCustomQuery}
                onRunQuery={runCustomQuery}
              />
            ) : (
              <WelcomeScreen dbPath={dbPath} showRemoteForm={showRemoteForm} />
            )}
          </div>
        </div>

        <DbFooter
          dbBadgeColor={dbBadgeColor}
          dbMode={dbMode}
          selectedTable={selectedTable}
          activeTab={activeTab}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
