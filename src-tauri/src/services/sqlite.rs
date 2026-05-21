use serde::{Deserialize, Serialize};
use serde_json::Value;
use rusqlite::{Connection, params};
use tauri::{AppHandle, Manager};
use base64::{prelude::BASE64_STANDARD, Engine};
use crate::services::db_client::{QueryResult, TableInfo};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentInstance {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalTab {
    pub id: String,
    pub name: String,
    pub agents: Vec<AgentInstance>,
    pub layout_orientation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SectionState {
    pub id: String,
    pub name: String,
    pub tabs: Vec<TerminalTab>,
    pub active_tab_id: Option<String>,
    pub merged_tab_pairs: Option<Vec<(String, String)>>,
    pub merged_tab_pair: Option<(String, String)>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceState {
    pub id: String,
    pub name: String,
    pub directory: Option<String>,
    pub sections: Vec<SectionState>,
    pub active_section_id: String,
    pub active_tab_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalTask {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub order_index: i32,
    pub created_at: i64,
}

fn get_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir()
        .map(|dir| dir.join("didi.db"))
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))
}

pub fn get_db_conn(app: &AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app)?;
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute("PRAGMA journal_mode = WAL;", []).ok();
    conn.execute("PRAGMA synchronous = NORMAL;", []).ok();
    conn.execute("PRAGMA foreign_keys = ON;", []).ok();
    Ok(conn)
}

pub fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tauri_migrations (
            version INTEGER PRIMARY KEY,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create migrations table: {}", e))?;

    let mut applied_versions = std::collections::HashSet::new();
    {
        let mut stmt = conn.prepare("SELECT version FROM tauri_migrations").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get::<_, i32>(0)).map_err(|e| e.to_string())?;
        for r in rows {
            applied_versions.insert(r.map_err(|e| e.to_string())?);
        }
    }

    let migrations = vec![
        (1, "create_initial_tables", "
            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                directory TEXT,
                activeTabId TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS tabs (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                layoutOrientation TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tab_id TEXT NOT NULL,
                name TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (tab_id) REFERENCES tabs(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS personal_tasks (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );
        "),
        (2, "add_totp_to_workspaces", "ALTER TABLE workspaces ADD COLUMN totp_secret TEXT;"),
        (3, "add_sections_table", "
            CREATE TABLE IF NOT EXISTS sections (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            );
            ALTER TABLE tabs ADD COLUMN section_id TEXT;
        "),
        (4, "add_active_section_id", "ALTER TABLE workspaces ADD COLUMN activeSectionId TEXT DEFAULT '';"),
        (5, "add_agent_uuid", "ALTER TABLE agents ADD COLUMN agent_uuid TEXT;"),
        (6, "add_performance_indexes", "
            CREATE INDEX IF NOT EXISTS idx_workspaces_order ON workspaces(order_index);
            CREATE INDEX IF NOT EXISTS idx_sections_ws ON sections(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_tabs_sec ON tabs(section_id);
            CREATE INDEX IF NOT EXISTS idx_agents_tab ON agents(tab_id);
            CREATE INDEX IF NOT EXISTS idx_personal_tasks_ws ON personal_tasks(workspace_id);
        "),
        (7, "add_section_merged_tab_pair", "ALTER TABLE sections ADD COLUMN mergedTabPair TEXT;"),
        (8, "add_code_review_comments", "
            CREATE TABLE IF NOT EXISTS code_review_comments (
                id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                old_line INTEGER,
                new_line INTEGER,
                comment_text TEXT NOT NULL,
                author TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_cr_comments_file ON code_review_comments(project_path, file_path);
        "),
    ];

    for (version, desc, sql) in migrations {
        if !applied_versions.contains(&version) {
            let tx = conn.transaction().map_err(|e| e.to_string())?;
            tx.execute_batch(sql).map_err(|e| format!("Migration {} ({}) failed: {}", version, desc, e))?;
            tx.execute(
                "INSERT INTO tauri_migrations (version, description, applied_at) VALUES (?1, ?2, datetime('now'))",
                params![version, desc],
            ).map_err(|e| e.to_string())?;
            tx.commit().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

pub fn init_db(app: &AppHandle) -> Result<(), String> {
    let mut conn = get_db_conn(app)?;
    run_migrations(&mut conn)?;
    Ok(())
}

// ── WORKSPACES COMMANDS ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn load_workspaces(app: AppHandle) -> Result<Vec<WorkspaceState>, String> {
    let conn = get_db_conn(&app)?;

    let mut stmt = conn.prepare("SELECT id, name, directory, activeTabId, activeSectionId FROM workspaces ORDER BY order_index ASC")
        .map_err(|e| e.to_string())?;
    
    let ws_rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut workspaces = Vec::new();

    for r in ws_rows {
        let (ws_id, ws_name, ws_dir, active_tab_id, active_sec_id) = r.map_err(|e| e.to_string())?;
        
        let mut sections_stmt = conn.prepare("SELECT id, name, mergedTabPair FROM sections WHERE workspace_id = ?1 ORDER BY order_index ASC")
            .map_err(|e| e.to_string())?;
        
        let sec_rows = sections_stmt.query_map([&ws_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        }).map_err(|e| e.to_string())?;

        let mut sections = Vec::new();
        for sr in sec_rows {
            let (sec_id, sec_name, merged_pair_raw) = sr.map_err(|e| e.to_string())?;
            
            let mut tabs_stmt = conn.prepare("SELECT id, name, layoutOrientation FROM tabs WHERE section_id = ?1 ORDER BY order_index ASC")
                .map_err(|e| e.to_string())?;
            
            let tab_rows = tabs_stmt.query_map([&sec_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            }).map_err(|e| e.to_string())?;

            let mut tabs = Vec::new();
            for tr in tab_rows {
                let (tab_id, tab_name, layout_orientation) = tr.map_err(|e| e.to_string())?;
                
                let mut agents_stmt = conn.prepare("SELECT name, agent_uuid FROM agents WHERE tab_id = ?1 ORDER BY order_index ASC")
                    .map_err(|e| e.to_string())?;
                
                let agent_rows = agents_stmt.query_map([&tab_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                    ))
                }).map_err(|e| e.to_string())?;

                let mut agents = Vec::new();
                for ar in agent_rows {
                    let (name, agent_uuid) = ar.map_err(|e| e.to_string())?;
                    agents.push(AgentInstance {
                        id: agent_uuid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                        name,
                    });
                }

                tabs.push(TerminalTab {
                    id: tab_id,
                    name: tab_name,
                    agents,
                    layout_orientation,
                });
            }

            // Parse merged tab pair
            let mut merged_tab_pairs = None;
            let mut merged_tab_pair = None;
            if let Some(ref json_str) = merged_pair_raw {
                if let Ok(parsed_pairs) = serde_json::from_str::<Vec<(String, String)>>(json_str) {
                    if !parsed_pairs.is_empty() {
                        merged_tab_pair = Some(parsed_pairs[0].clone());
                        merged_tab_pairs = Some(parsed_pairs);
                    }
                } else if let Ok(parsed_pair) = serde_json::from_str::<(String, String)>(json_str) {
                    merged_tab_pair = Some(parsed_pair.clone());
                    merged_tab_pairs = Some(vec![parsed_pair]);
                }
            }

            sections.push(SectionState {
                id: sec_id,
                name: sec_name,
                tabs,
                active_tab_id: None,
                merged_tab_pairs,
                merged_tab_pair,
            });
        }

        // Backward compatibility fallback for legacy databases with no sections
        if sections.is_empty() {
            let sec_id = uuid::Uuid::new_v4().to_string();
            let mut legacy_tabs_stmt = conn.prepare("SELECT id, name, layoutOrientation FROM tabs WHERE workspace_id = ?1 ORDER BY order_index ASC")
                .map_err(|e| e.to_string())?;
            let tab_rows = legacy_tabs_stmt.query_map([&ws_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            }).map_err(|e| e.to_string())?;

            let mut tabs = Vec::new();
            for tr in tab_rows {
                let (tab_id, tab_name, layout_orientation) = tr.map_err(|e| e.to_string())?;
                
                let mut agents_stmt = conn.prepare("SELECT name, agent_uuid FROM agents WHERE tab_id = ?1 ORDER BY order_index ASC")
                    .map_err(|e| e.to_string())?;
                
                let agent_rows = agents_stmt.query_map([&tab_id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, Option<String>>(1)?,
                    ))
                }).map_err(|e| e.to_string())?;

                let mut agents = Vec::new();
                for ar in agent_rows {
                    let (name, agent_uuid) = ar.map_err(|e| e.to_string())?;
                    agents.push(AgentInstance {
                        id: agent_uuid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
                        name,
                    });
                }

                tabs.push(TerminalTab {
                    id: tab_id,
                    name: tab_name,
                    agents,
                    layout_orientation,
                });
            }

            sections.push(SectionState {
                id: sec_id,
                name: "Section 1".to_string(),
                tabs,
                active_tab_id: None,
                merged_tab_pairs: None,
                merged_tab_pair: None,
            });
        }

        let first_sec_id = sections[0].id.clone();
        workspaces.push(WorkspaceState {
            id: ws_id,
            name: ws_name,
            directory: ws_dir,
            sections,
            active_section_id: active_sec_id.unwrap_or(first_sec_id),
            active_tab_id: Some(active_tab_id),
        });
    }

    Ok(workspaces)
}

#[tauri::command]
pub async fn save_workspaces(app: AppHandle, workspaces: Vec<WorkspaceState>) -> Result<(), String> {
    let mut conn = get_db_conn(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM agents", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM tabs", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM sections", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM workspaces", []).map_err(|e| e.to_string())?;

    for (w_idx, ws) in workspaces.iter().enumerate() {
        tx.execute(
            "INSERT INTO workspaces (id, name, directory, activeTabId, activeSectionId, order_index) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![ws.id, ws.name, ws.directory, ws.active_tab_id.clone().unwrap_or_default(), ws.active_section_id, w_idx],
        ).map_err(|e| e.to_string())?;

        for (s_idx, section) in ws.sections.iter().enumerate() {
            let merged_pairs_str = if let Some(ref pairs) = section.merged_tab_pairs {
                if !pairs.is_empty() {
                    Some(serde_json::to_string(pairs).map_err(|e| e.to_string())?)
                } else {
                    None
                }
            } else if let Some(ref pair) = section.merged_tab_pair {
                Some(serde_json::to_string(&vec![pair]).map_err(|e| e.to_string())?)
            } else {
                None
            };

            tx.execute(
                "INSERT INTO sections (id, workspace_id, name, mergedTabPair, order_index) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![section.id, ws.id, section.name, merged_pairs_str, s_idx],
            ).map_err(|e| e.to_string())?;

            for (t_idx, tab) in section.tabs.iter().enumerate() {
                tx.execute(
                    "INSERT INTO tabs (id, workspace_id, section_id, name, layoutOrientation, order_index) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![tab.id, ws.id, section.id, tab.name, tab.layout_orientation, t_idx],
                ).map_err(|e| e.to_string())?;

                for (a_idx, agent) in tab.agents.iter().enumerate() {
                    tx.execute(
                        "INSERT INTO agents (tab_id, name, agent_uuid, order_index) \
                         VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![tab.id, agent.name, agent.id, a_idx],
                    ).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// ── SETTINGS COMMANDS ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_setting(app: AppHandle, key: String) -> Result<Option<String>, String> {
    let conn = get_db_conn(&app)?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn set_setting(app: AppHandle, key: String, value: String) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ── PERSONAL TASKS COMMANDS ───────────────────────────────────────────────────

#[tauri::command]
pub async fn load_personal_tasks(app: AppHandle, workspace_id: String) -> Result<Vec<PersonalTask>, String> {
    let conn = get_db_conn(&app)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, title, description, status, order_index, created_at \
         FROM personal_tasks WHERE workspace_id = ?1 ORDER BY order_index ASC, created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([workspace_id], |row| {
        Ok(PersonalTask {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            status: row.get(4)?,
            order_index: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for r in rows {
        tasks.push(r.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub async fn save_personal_task(app: AppHandle, task: PersonalTask) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute(
        "INSERT INTO personal_tasks (id, workspace_id, title, description, status, order_index, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) \
         ON CONFLICT(id) DO UPDATE SET \
          title = excluded.title, \
          description = excluded.description, \
          status = excluded.status, \
          order_index = excluded.order_index",
        rusqlite::params![
            task.id,
            task.workspace_id,
            task.title,
            task.description,
            task.status,
            task.order_index,
            task.created_at
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_personal_task_status(app: AppHandle, id: String, status: String) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute(
        "UPDATE personal_tasks SET status = ?1 WHERE id = ?2",
        rusqlite::params![status, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_personal_tasks_order(app: AppHandle, tasks: Vec<PersonalTask>) -> Result<(), String> {
    let mut conn = get_db_conn(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for (i, task) in tasks.iter().enumerate() {
        tx.execute(
            "UPDATE personal_tasks SET order_index = ?1, status = ?2 WHERE id = ?3",
            rusqlite::params![i as i32, task.status, task.id],
        ).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_personal_task(app: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute("DELETE FROM personal_tasks WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodeReviewComment {
    pub id: String,
    pub project_path: String,
    pub file_path: String,
    pub old_line: Option<i32>,
    pub new_line: Option<i32>,
    pub comment_text: String,
    pub author: String,
    pub created_at: i64,
}

// ── CODE REVIEW COMMENTS COMMANDS ──────────────────────────────────────────────

#[tauri::command]
pub async fn load_all_project_comments(app: AppHandle, project_path: String) -> Result<Vec<CodeReviewComment>, String> {
    let conn = get_db_conn(&app)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_path, file_path, old_line, new_line, comment_text, author, created_at \
         FROM code_review_comments WHERE project_path = ?1 ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([project_path], |row| {
        Ok(CodeReviewComment {
            id: row.get(0)?,
            project_path: row.get(1)?,
            file_path: row.get(2)?,
            old_line: row.get(3)?,
            new_line: row.get(4)?,
            comment_text: row.get(5)?,
            author: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut comments = Vec::new();
    for r in rows {
        comments.push(r.map_err(|e| e.to_string())?);
    }
    Ok(comments)
}

#[tauri::command]
pub async fn save_code_review_comment(app: AppHandle, comment: CodeReviewComment) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute(
        "INSERT INTO code_review_comments (id, project_path, file_path, old_line, new_line, comment_text, author, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
         ON CONFLICT(id) DO UPDATE SET \
          comment_text = excluded.comment_text, \
          author = excluded.author",
        rusqlite::params![
            comment.id,
            comment.project_path,
            comment.file_path,
            comment.old_line,
            comment.new_line,
            comment.comment_text,
            comment.author,
            comment.created_at
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_code_review_comment(app: AppHandle, id: String) -> Result<(), String> {
    let conn = get_db_conn(&app)?;
    conn.execute("DELETE FROM code_review_comments WHERE id = ?1", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ── DEVELOPER TOOLS GENERIC SQLITE COMMANDS ───────────────────────────────────

fn sqlite_value_to_json(val: rusqlite::types::ValueRef) -> Value {
    match val {
        rusqlite::types::ValueRef::Null => Value::Null,
        rusqlite::types::ValueRef::Integer(i) => Value::Number(i.into()),
        rusqlite::types::ValueRef::Real(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or_else(|| Value::String(f.to_string())),
        rusqlite::types::ValueRef::Text(bytes) => {
            let s = String::from_utf8_lossy(bytes).into_owned();
            Value::String(s)
        }
        rusqlite::types::ValueRef::Blob(bytes) => {
            let b64 = BASE64_STANDARD.encode(bytes);
            Value::String(format!("blob:{}", b64))
        }
    }
}

#[tauri::command]
pub async fn db_sqlite_load_tables(db_path: String) -> Result<Vec<TableInfo>, String> {
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let name: String = row.get(0)?;
        Ok(TableInfo {
            schema: "".to_string(),
            name,
        })
    }).map_err(|e| e.to_string())?;

    let mut tables = Vec::new();
    for r in rows {
        tables.push(r.map_err(|e| e.to_string())?);
    }
    Ok(tables)
}

#[tauri::command]
pub async fn db_sqlite_query(db_path: String, query: String) -> Result<QueryResult, String> {
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let column_names: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    let col_count = stmt.column_count();

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    let mut result_rows = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut r = Vec::new();
        for i in 0..col_count {
            let val = row.get_ref(i).map_err(|e| e.to_string())?;
            r.push(sqlite_value_to_json(val));
        }
        result_rows.push(r);
    }

    Ok(QueryResult {
        columns: column_names,
        rows: result_rows,
        rows_affected: None,
    })
}

#[tauri::command]
pub async fn db_sqlite_execute(db_path: String, query: String) -> Result<u64, String> {
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    let rows_affected = conn.execute(&query, []).map_err(|e| e.to_string())?;
    Ok(rows_affected as u64)
}
