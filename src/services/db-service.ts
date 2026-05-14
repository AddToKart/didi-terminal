import Database from "@tauri-apps/plugin-sql";
import type { TerminalTab, WorkspaceState, SectionState } from "../types/workspace";

export interface PersonalTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  order_index: number;
  created_at: number;
}

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
  
  const workspacesRaw = await db.select<{ id: string; name: string; directory: string | null; activeTabId: string; activeSectionId: string; order_index: number }[]>(
    "SELECT * FROM workspaces ORDER BY order_index ASC"
  );
  
  const workspaces: WorkspaceState[] = [];
  
  for (const ws of workspacesRaw) {
    const sectionsRaw = await db.select<{ id: string; name: string; order_index: number }[]>(
      "SELECT * FROM sections WHERE workspace_id = $1 ORDER BY order_index ASC",
      [ws.id]
    );

    const sections: SectionState[] = [];

    // Backward compatibility: If no sections exist, create a default one and load legacy tabs
    if (sectionsRaw.length === 0) {
      const defaultSection: SectionState = {
        id: crypto.randomUUID(),
        name: "Section 1",
        tabs: [],
      };
      
      const tabsRaw = await db.select<{ id: string; name: string; layoutOrientation: string; order_index: number }[]>(
        "SELECT * FROM tabs WHERE workspace_id = $1 ORDER BY order_index ASC",
        [ws.id]
      );
      
      for (const tab of tabsRaw) {
        const agentsRaw = await db.select<{ name: string; agent_uuid: string }[]>(
          "SELECT name, agent_uuid FROM agents WHERE tab_id = $1 ORDER BY order_index ASC",
          [tab.id]
        );
        defaultSection.tabs.push({
          id: tab.id,
          name: tab.name,
          agents: agentsRaw.map(a => ({ id: a.agent_uuid || crypto.randomUUID(), name: a.name })),
          layoutOrientation: tab.layoutOrientation as any,
        });
      }
      sections.push(defaultSection);
    } else {
      for (const section of sectionsRaw) {
        const tabsRaw = await db.select<{ id: string; name: string; layoutOrientation: string; order_index: number }[]>(
          "SELECT * FROM tabs WHERE section_id = $1 ORDER BY order_index ASC",
          [section.id]
        );
        
        const tabs: TerminalTab[] = [];
        for (const tab of tabsRaw) {
          const agentsRaw = await db.select<{ name: string; agent_uuid: string }[]>(
            "SELECT name, agent_uuid FROM agents WHERE tab_id = $1 ORDER BY order_index ASC",
            [tab.id]
          );
          
          tabs.push({
            id: tab.id,
            name: tab.name,
            agents: agentsRaw.map(a => ({ id: a.agent_uuid || crypto.randomUUID(), name: a.name })),
            layoutOrientation: tab.layoutOrientation as any,
          });
        }
        
        sections.push({
          id: section.id,
          name: section.name,
          tabs,
        });
      }
    }
    
    workspaces.push({
      id: ws.id,
      name: ws.name,
      directory: ws.directory,
      sections,
      activeTabId: ws.activeTabId,
      activeSectionId: ws.activeSectionId || sections[0]?.id || "",
    });
  }
  
  return workspaces;
}

export async function saveWorkspaces(workspaces: WorkspaceState[]): Promise<void> {
  const db = await getDb();
  
  try {
    // Start atomic transaction
    await db.execute("BEGIN TRANSACTION");

    // Clear existing relations to ensure clean state within the transaction
    // (Still using delete but inside a transaction it's atomic)
    await db.execute("DELETE FROM agents");
    await db.execute("DELETE FROM tabs");
    await db.execute("DELETE FROM sections");
    await db.execute("DELETE FROM workspaces");
    
    for (let wIndex = 0; wIndex < workspaces.length; wIndex++) {
      const ws = workspaces[wIndex];
      await db.execute(
        "INSERT INTO workspaces (id, name, directory, activeTabId, activeSectionId, order_index) VALUES ($1, $2, $3, $4, $5, $6)",
        [ws.id, ws.name, ws.directory, ws.activeTabId, ws.activeSectionId || "", wIndex]
      );
      
      for (let sIndex = 0; sIndex < ws.sections.length; sIndex++) {
        const section = ws.sections[sIndex];
        await db.execute(
          "INSERT INTO sections (id, workspace_id, name, order_index) VALUES ($1, $2, $3, $4)",
          [section.id, ws.id, section.name, sIndex]
        );

        for (let tIndex = 0; tIndex < section.tabs.length; tIndex++) {
          const tab = section.tabs[tIndex];
          await db.execute(
            "INSERT INTO tabs (id, workspace_id, section_id, name, layoutOrientation, order_index) VALUES ($1, $2, $3, $4, $5, $6)",
            [tab.id, ws.id, section.id, tab.name, tab.layoutOrientation, tIndex]
          );
          
          for (let aIndex = 0; aIndex < tab.agents.length; aIndex++) {
            const agent = tab.agents[aIndex];
            await db.execute(
              "INSERT INTO agents (tab_id, name, agent_uuid, order_index) VALUES ($1, $2, $3, $4)",
              [tab.id, agent.name, agent.id, aIndex]
            );
          }
        }
      }
    }

    // Commit all changes atomically
    await db.execute("COMMIT");
  } catch (error) {
    // Rollback on any failure to prevent partial state corruption
    try {
      await db.execute("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
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

export async function loadPersonalTasks(workspaceId: string): Promise<PersonalTask[]> {
  const db = await getDb();
  return await db.select<PersonalTask[]>(
    "SELECT * FROM personal_tasks WHERE workspace_id = $1 ORDER BY order_index ASC, created_at DESC",
    [workspaceId]
  );
}

export async function savePersonalTask(task: PersonalTask): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO personal_tasks (id, workspace_id, title, description, status, order_index, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT(id) DO UPDATE SET 
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      order_index = excluded.order_index`,
    [task.id, task.workspace_id, task.title, task.description, task.status, task.order_index, task.created_at]
  );
}

export async function updatePersonalTaskStatus(id: string, status: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE personal_tasks SET status = $1 WHERE id = $2", [status, id]);
}

export async function updatePersonalTasksOrder(tasks: PersonalTask[]): Promise<void> {
  const db = await getDb();
  // Simple approach: run individual updates (fine for small lists)
  for (let i = 0; i < tasks.length; i++) {
    await db.execute("UPDATE personal_tasks SET order_index = $1, status = $2 WHERE id = $3", 
      [i, tasks[i].status, tasks[i].id]);
  }
}

export async function deletePersonalTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM personal_tasks WHERE id = $1", [id]);
}
