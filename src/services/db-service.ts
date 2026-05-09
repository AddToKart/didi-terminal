import Database from "@tauri-apps/plugin-sql";
import type { TerminalTab, WorkspaceState } from "../App";

let dbInstance: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:didi.db");
  }
  return dbInstance;
}

// Ensure workspaces have their relations joined
export async function loadWorkspaces(): Promise<WorkspaceState[]> {
  const db = await getDb();
  
  const workspacesRaw = await db.select<{ id: string; name: string; directory: string | null; activeTabId: string; order_index: number }[]>(
    "SELECT * FROM workspaces ORDER BY order_index ASC"
  );
  
  const workspaces: WorkspaceState[] = [];
  
  for (const ws of workspacesRaw) {
    const tabsRaw = await db.select<{ id: string; name: string; layoutOrientation: string; order_index: number }[]>(
      "SELECT * FROM tabs WHERE workspace_id = $1 ORDER BY order_index ASC",
      [ws.id]
    );
    
    const tabs: TerminalTab[] = [];
    for (const tab of tabsRaw) {
      const agentsRaw = await db.select<{ name: string }[]>(
        "SELECT name FROM agents WHERE tab_id = $1 ORDER BY order_index ASC",
        [tab.id]
      );
      
      tabs.push({
        id: tab.id,
        name: tab.name,
        agents: agentsRaw.map(a => a.name),
        layoutOrientation: tab.layoutOrientation as "horizontal" | "vertical" | "grid",
      });
    }
    
    workspaces.push({
      id: ws.id,
      name: ws.name,
      directory: ws.directory,
      activeTabId: ws.activeTabId,
      tabs,
    });
  }
  
  return workspaces;
}

export async function saveWorkspaces(workspaces: WorkspaceState[]): Promise<void> {
  const db = await getDb();
  
  try {
    // Clear existing explicitly to avoid foreign key issues since SQLite FKs are disabled by default
    await db.execute("DELETE FROM agents");
    await db.execute("DELETE FROM tabs");
    await db.execute("DELETE FROM workspaces");
    
    for (let wIndex = 0; wIndex < workspaces.length; wIndex++) {
      const ws = workspaces[wIndex];
      await db.execute(
        "INSERT INTO workspaces (id, name, directory, activeTabId, order_index) VALUES ($1, $2, $3, $4, $5)",
        [ws.id, ws.name, ws.directory, ws.activeTabId, wIndex]
      );
      
      for (let tIndex = 0; tIndex < ws.tabs.length; tIndex++) {
        const tab = ws.tabs[tIndex];
        await db.execute(
          "INSERT INTO tabs (id, workspace_id, name, layoutOrientation, order_index) VALUES ($1, $2, $3, $4, $5)",
          [tab.id, ws.id, tab.name, tab.layoutOrientation, tIndex]
        );
        
        for (let aIndex = 0; aIndex < tab.agents.length; aIndex++) {
          const agentName = tab.agents[aIndex];
          await db.execute(
            "INSERT INTO agents (tab_id, name, order_index) VALUES ($1, $2, $3)",
            [tab.id, agentName, aIndex]
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to save workspaces to DB:", error);
    throw error;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const result = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = $1", [key]);
  if (result.length > 0) {
    return result[0].value;
  }
  return null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}
