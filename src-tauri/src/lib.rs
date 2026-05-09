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

// ── Shared application state ──────────────────────────────────────────────────

struct AppState {
    pty_writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    pty_resizers: Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>,
    pty_processes: Mutex<HashMap<String, PtyProcess>>,
    sys: Mutex<sysinfo::System>,
    config: Mutex<AppConfig>,
}

// ── initialize_project (kept here; delegates to scripts::templates) ────────────

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

    // Only write MASTER_PLAN if it doesn't already exist. Replace the old bootstrap
    // placeholder only when it is still untouched so real user progress is preserved.
    let plan_path = path.join("MASTER_PLAN.md");
    if !plan_path.exists() {
        std::fs::write(&plan_path, templates::master_plan_md()).map_err(|e| e.to_string())?;
    } else if std::fs::read_to_string(&plan_path)
        .map(|contents| contents.trim() == templates::legacy_master_plan_md().trim())
        .unwrap_or(false)
    {
        std::fs::write(&plan_path, templates::master_plan_md()).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Tauri entry point ─────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
        ])
        .setup(|app| {
            start_agent_bus(app.handle().clone());
            app.manage(AppState {
                pty_writers: Mutex::new(HashMap::new()),
                pty_resizers: Mutex::new(HashMap::new()),
                pty_processes: Mutex::new(HashMap::new()),
                sys: Mutex::new(sysinfo::System::new_all()),
                config: Mutex::new(load_config(app.handle())),
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
