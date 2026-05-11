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
    pty_scrollbacks: Mutex<HashMap<String, Vec<u8>>>,
    pty_workspaces: Mutex<HashMap<String, String>>,
    sys: Mutex<sysinfo::System>,

    config: Mutex<AppConfig>,
    browser_views: Mutex<HashMap<String, tauri::Webview>>,
}

#[tauri::command]
fn get_local_ip() -> String {
    if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in ifaces {
            if !ip.is_loopback() && ip.is_ipv4() {
                return ip.to_string();
            }
        }
    }
    "127.0.0.1".to_string()
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

#[tauri::command]
fn update_vibrancy(window: tauri::Window, enable: bool, theme: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if enable {
            let is_dark = theme == "dark";
            let _ = window_vibrancy::apply_acrylic(&window, Some((18, 18, 18, if is_dark { 125 } else { 50 })));
            // Optionally try mica: let _ = window_vibrancy::apply_mica(&window, Some(is_dark));
        } else {
            let _ = window_vibrancy::clear_acrylic(&window);
            let _ = window_vibrancy::clear_mica(&window);
        }
    }
    #[cfg(target_os = "macos")]
    {
        if enable {
            let _ = window_vibrancy::apply_vibrancy(&window, window_vibrancy::NSVisualEffectMaterial::HudWindow, None, None);
        } else {
            // macOS clear vibrancy might require different handling, or there's clear_vibrancy
            // let _ = window_vibrancy::clear_vibrancy(&window);
        }
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
                CREATE TABLE IF NOT EXISTS personal_tasks (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT NOT NULL,
                    order_index INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL
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
            services::git::get_git_branch,
            services::git::get_git_status_structured,
            services::git::git_panel_get_status,
            services::git::git_panel_stage,
            services::git::git_panel_stage_all,
            services::git::git_panel_unstage,
            services::git::git_panel_discard,
            services::git::git_panel_commit,
            services::git::git_panel_pull,
            services::git::git_panel_push,
            services::git::git_panel_get_log,
            services::git::git_panel_get_branches,
            services::git::git_panel_switch_branch,
            services::git::git_panel_create_branch,
            services::git::git_panel_delete_branch,
            services::git::git_panel_merge_branch,
            services::master_plan::append_master_plan_entry,
            services::master_plan::read_master_plan,
            services::master_plan::set_master_plan_task_status,
            services::master_plan::set_master_plan_task_status_by_text,
            services::master_plan::append_master_plan_task,
            services::fs::list_directory,
            services::fs::read_file_content,
            services::fs::write_file_content,
            services::fs::scan_env_files,
            services::http::make_http_request,
            services::packages::scan_project_configs,
            services::packages::get_outdated_npm,
            services::packages::run_package_update,
            services::ports::get_active_ports,
            services::ports::kill_process,
            initialize_project,
            open_browser_view,
            update_browser_bounds,
            navigate_browser_view,
            close_browser_view,
            update_vibrancy,
            get_local_ip,
        ])
        .setup(|app| {
            let loaded_config = load_config(app.handle());
            
            // Apply initial vibrancy based on config
            if let Some(window) = app.get_window("main") {
                let _ = update_vibrancy(window, loaded_config.glassmorphism, loaded_config.theme_mode.clone());
            }

            start_agent_bus(app.handle().clone());
            services::dashboard::start_dashboard_server(app.handle().clone());
            app.manage(AppState {
                pty_writers: Mutex::new(HashMap::new()),
                pty_resizers: Mutex::new(HashMap::new()),
                pty_processes: Mutex::new(HashMap::new()),
                pty_scrollbacks: Mutex::new(HashMap::new()),
                pty_workspaces: Mutex::new(HashMap::new()),
                sys: Mutex::new(sysinfo::System::new_all()),

                config: Mutex::new(loaded_config),
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
