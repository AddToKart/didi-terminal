import Database from "@tauri-apps/plugin-sql";
import type { MergedTabPair, TerminalTab, WorkspaceState, SectionState } from "../types/workspace";

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

const isMergedTabPair = (value: unknown): value is MergedTabPair => {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  );
};

const parseMergedTabPairs = (value: string | null): MergedTabPair[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (isMergedTabPair(parsed)) {
      return [parsed];
    }

    if (Array.isArray(parsed)) {
      return parsed.filter(isMergedTabPair);
    }
  } catch {
    return [];
  }

  return [];
};

const serializeMergedTabPairs = (value: readonly MergedTabPair[] | null | undefined) => {
  return value?.length ? JSON.stringify(value) : null;
};

export async function getDb(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = await Database.load("sqlite:didi.db");
    try {
      await dbInstance.execute("PRAGMA journal_mode = WAL;");
      await dbInstance.execute("PRAGMA synchronous = NORMAL;");
      await dbInstance.execute("PRAGMA foreign_keys = ON;");
    } catch (e) {
      console.warn("Failed to set SQLite PRAGMAs", e);
    }
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
    const sectionsRaw = await db.select<{ id: string; name: string; mergedTabPair: string | null; order_index: number }[]>(
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
          mergedTabPairs: parseMergedTabPairs(section.mergedTabPair),
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

let isSaving = false;
let pendingWorkspaces: WorkspaceState[] | null = null;

export async function saveWorkspaces(workspaces: WorkspaceState[]): Promise<void> {
  if (isSaving) {
    pendingWorkspaces = workspaces;
    return;
  }

  isSaving = true;
  let currentWorkspaces = workspaces;

  while (true) {
    const db = await getDb();
    try {
      // Clear existing relations (cascade deletes will handle children if PRAGMA foreign_keys = ON)
      // but we explicitly delete to be safe across SQLite versions
      await db.execute("DELETE FROM agents");
      await db.execute("DELETE FROM tabs");
      await db.execute("DELETE FROM sections");
      await db.execute("DELETE FROM workspaces");
      
      for (let wIndex = 0; wIndex < currentWorkspaces.length; wIndex++) {
        const ws = currentWorkspaces[wIndex];
        await db.execute(
          "INSERT INTO workspaces (id, name, directory, activeTabId, activeSectionId, order_index) VALUES ($1, $2, $3, $4, $5, $6)",
          [ws.id, ws.name, ws.directory, ws.activeTabId, ws.activeSectionId || "", wIndex]
        );
        
        for (let sIndex = 0; sIndex < ws.sections.length; sIndex++) {
          const section = ws.sections[sIndex];
          await db.execute(
            "INSERT INTO sections (id, workspace_id, name, mergedTabPair, order_index) VALUES ($1, $2, $3, $4, $5)",
            [section.id, ws.id, section.name, serializeMergedTabPairs(section.mergedTabPairs ?? (section.mergedTabPair ? [section.mergedTabPair] : [])), sIndex]
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

    } catch (error) {
      console.error("Failed to save workspaces to DB:", error);
    }

    if (pendingWorkspaces) {
      currentWorkspaces = pendingWorkspaces;
      pendingWorkspaces = null;
    } else {
      break;
    }
  }

  isSaving = false;
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
