mod services;
mod scripts;

use tauri::Manager;
use std::collections::HashMap;
use std::sync::Mutex;
use std::io::Write;

use services::config::{AppConfig, load_config};
use services::pty::PtyProcess;
use services::bus::start_agent_bus;
use scripts::templates;

use tauri_plugin_sql::{Migration, MigrationKind};

struct AppState {
    pty_writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    pty_resizers: Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>,
    pty_processes: Mutex<HashMap<String, PtyProcess>>,
    sys: Mutex<sysinfo::System>,
    config: Mutex<AppConfig>,
    browser_views: Mutex<HashMap<String, tauri::Webview>>,
}

#[tauri::command]
fn initialize_project(cwd: String) -> Result<(), String> {
    let path = std::path::Path::new(&cwd);
    let didi_dir = path.join(".didi");
    std::fs::create_dir_all(&didi_dir).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("delegate.ps1"), templates::delegate_ps1()).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("delegate.cmd"), templates::delegate_cmd()).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.ps1"),  templates::context_ps1()).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.cmd"),  templates::context_cmd()).map_err(|e| e.to_string())?;
    std::fs::write(path.join("AGENTS.md"),         templates::agents_md()).map_err(|e| e.to_string())?;
    let plan_path = path.join("MASTER_PLAN.md");
    if !plan_path.exists() {
        std::fs::write(&plan_path, templates::master_plan_md()).map_err(|e| e.to_string())?;
    } else if std::fs::read_to_string(&plan_path)
        .map(|c| c.trim() == templates::legacy_master_plan_md().trim())
        .unwrap_or(false)
    {
        std::fs::write(&plan_path, templates::master_plan_md()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_browser_view(
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    id: String,
    url: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    {
        let mut views = state.browser_views.lock().unwrap();
        if let Some(existing) = views.remove(&id) {
            let _ = existing.close();
        }
    }

    let webview_url = if url.is_empty() {
        tauri::WebviewUrl::External("about:blank".parse().unwrap())
    } else {
        tauri::WebviewUrl::External(url::Url::parse(&url).map_err(|e| e.to_string())?)
    };

    let builder = tauri::WebviewBuilder::new(format!("browser-{}", id), webview_url)
        .transparent(false);
    let view = window.add_child(
        builder,
        tauri::LogicalPosition::new(x, y),
        tauri::LogicalSize::new(w, h),
    ).map_err(|e: tauri::Error| e.to_string())?;

    state.browser_views.lock().unwrap().insert(id, view);
    Ok(())
}

#[tauri::command]
async fn update_browser_bounds(
    state: tauri::State<'_, AppState>,
    id: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Result<(), String> {
    let views = state.browser_views.lock().unwrap();
    if let Some(view) = views.get(&id) {
        view.set_position(tauri::LogicalPosition::new(x, y))
            .map_err(|e: tauri::Error| e.to_string())?;
        view.set_size(tauri::LogicalSize::new(w, h))
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn navigate_browser_view(
    state: tauri::State<'_, AppState>,
    id: String,
    url: String,
) -> Result<(), String> {
    let views = state.browser_views.lock().unwrap();
    if let Some(view) = views.get(&id) {
        let parsed = url::Url::parse(&url).map_err(|e| e.to_string())?;
        view.navigate(parsed).map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn close_browser_view(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut views = state.browser_views.lock().unwrap();
    if let Some(view) = views.remove(&id) {
        view.close().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
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
            ",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:didi.db", migrations)
                .build()
        )
        .invoke_handler(tauri::generate_handler![
            services::pty::spawn_pty,
            services::pty::write_pty,
            services::pty::close_pty,
            services::pty::resize_pty,
            services::pty::get_process_stats,
            services::pty::get_project_context,
            services::config::get_config,
            services::config::set_config,
            services::llm::get_sidecar_status,
            services::llm::ask_llm,
            services::git::create_git_snapshot,
            services::git::list_git_snapshots,
            services::git::rewind_git_snapshot,
            services::git::get_git_diff,
            services::master_plan::append_master_plan_entry,
            services::master_plan::read_master_plan,
            services::master_plan::set_master_plan_task_status,
            services::master_plan::set_master_plan_task_status_by_text,
            services::master_plan::append_master_plan_task,
            initialize_project,
            open_browser_view,
            update_browser_bounds,
            navigate_browser_view,
            close_browser_view,
        ])
        .setup(|app| {
            start_agent_bus(app.handle().clone());
            app.manage(AppState {
                pty_writers: Mutex::new(HashMap::new()),
                pty_resizers: Mutex::new(HashMap::new()),
                pty_processes: Mutex::new(HashMap::new()),
                sys: Mutex::new(sysinfo::System::new_all()),
                config: Mutex::new(load_config(app.handle())),
                browser_views: Mutex::new(HashMap::new()),
            });
            use tauri_plugin_shell::ShellExt;
            if let Ok(sidecar_command) = app.handle().shell().sidecar("llama-server") {
                let _ = sidecar_command.spawn();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
