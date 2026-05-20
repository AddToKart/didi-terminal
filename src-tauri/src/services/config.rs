use tauri::{AppHandle, Manager, State};
use std::path::PathBuf;

use crate::AppState;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(default)]
pub struct AppConfig {
    pub shell: String,
    pub llm_endpoint: String,
    pub llm_model: String,
    pub llm_api_key: String,
    pub theme_cyan: String,
    pub theme_amber: String,
    pub theme_mode: String,
    pub glassmorphism: bool,
    pub github_pat: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            shell: "pwsh.exe".to_string(),
            llm_endpoint: "http://localhost:8080/v1".to_string(),
            llm_model: "local-model".to_string(),
            llm_api_key: String::new(),
            theme_cyan: "#00f0ff".to_string(),
            theme_amber: "#ffb000".to_string(),
            theme_mode: "dark".to_string(),
            glassmorphism: false,
            github_pat: String::new(),
        }
    }
}

pub fn config_file(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(app_data_dir.join("config.json"))
}

pub fn load_config(app_handle: &AppHandle) -> AppConfig {
    config_file(app_handle)
        .ok()
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

pub fn save_config(app_handle: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_file(app_handle)?;
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    Ok(state.config.lock().unwrap().clone())
}

#[tauri::command]
pub fn set_config(new_config: AppConfig, app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    save_config(&app_handle, &new_config)?;
    *state.config.lock().unwrap() = new_config;
    Ok(())
}
