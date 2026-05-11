use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tokio::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectConfig {
    pub path: String,
    pub name: String,
    pub manager: String,
    pub file_type: String,
}

#[tauri::command]
pub fn scan_project_configs(cwd: String) -> Result<Vec<ProjectConfig>, String> {
    let mut configs = Vec::new();
    let root = Path::new(&cwd);
    
    if !root.exists() {
        return Err("Directory does not exist".to_string());
    }

    scan_packages_recursive(root, root, 0, &mut configs);

    Ok(configs)
}

fn scan_packages_recursive(dir: &Path, root: &Path, depth: u8, configs: &mut Vec<ProjectConfig>) {
    if depth > 3 {
        return;
    }

    let name = if dir == root {
        "root".to_string()
    } else {
        dir.strip_prefix(root)
            .unwrap_or(dir)
            .to_string_lossy()
            .replace('\\', "/")
    };

    if dir.join("package.json").exists() {
        configs.push(ProjectConfig {
            path: dir.to_string_lossy().to_string(),
            name: name.clone(),
            manager: "npm".to_string(),
            file_type: "package.json".to_string(),
        });
    }
    if dir.join("Cargo.toml").exists() {
        configs.push(ProjectConfig {
            path: dir.to_string_lossy().to_string(),
            name: name.clone(),
            manager: "cargo".to_string(),
            file_type: "Cargo.toml".to_string(),
        });
    }
    if dir.join("requirements.txt").exists() || dir.join("pyproject.toml").exists() {
        configs.push(ProjectConfig {
            path: dir.to_string_lossy().to_string(),
            name: name.clone(),
            manager: "pip".to_string(),
            file_type: if dir.join("pyproject.toml").exists() { "pyproject.toml".to_string() } else { "requirements.txt".to_string() },
        });
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dname = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if dname != "node_modules" && dname != "target" && dname != "dist" && dname != "build" && !dname.starts_with('.') {
                    scan_packages_recursive(&path, root, depth + 1, configs);
                }
            }
        }
    }
}

#[tauri::command]
pub async fn get_outdated_npm(cwd: String) -> Result<String, String> {
    let output = Command::new(if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" })
        .current_dir(&cwd)
        .arg("outdated")
        .arg("--json")
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout)
}

#[tauri::command]
pub async fn run_package_update(cwd: String, manager: String, package: String) -> Result<String, String> {
    let output = match manager.as_str() {
        "npm" => {
            Command::new(if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" })
                .current_dir(&cwd)
                .arg("install")
                .arg(format!("{}@latest", package))
                .output()
                .await
        },
        "cargo" => {
            Command::new("cargo")
                .current_dir(&cwd)
                .arg("update")
                .arg("-p")
                .arg(&package)
                .output()
                .await
        },
        "pip" => {
            Command::new("pip")
                .current_dir(&cwd)
                .arg("install")
                .arg("--upgrade")
                .arg(&package)
                .output()
                .await
        },
        _ => return Err("Unsupported package manager".to_string()),
    }.map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}