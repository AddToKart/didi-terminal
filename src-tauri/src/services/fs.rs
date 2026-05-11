use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EnvConfig {
    pub path: String,
    pub name: String,
}

#[tauri::command]
pub fn scan_env_files(cwd: String) -> Result<Vec<EnvConfig>, String> {
    let mut configs = Vec::new();
    let root = Path::new(&cwd);
    
    if !root.exists() {
        return Err("Directory does not exist".to_string());
    }

    scan_env_recursive(root, root, 0, &mut configs);

    Ok(configs)
}

fn scan_env_recursive(dir: &Path, root: &Path, depth: u8, configs: &mut Vec<EnvConfig>) {
    if depth > 3 {
        return;
    }

    if dir.join(".env").exists() {
        let name = if dir == root {
            "root".to_string()
        } else {
            dir.strip_prefix(root)
                .unwrap_or(dir)
                .to_string_lossy()
                .replace('\\', "/")
        };
        
        configs.push(EnvConfig {
            path: dir.join(".env").to_string_lossy().to_string(),
            name,
        });
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                if name != "node_modules" && name != "target" && name != "dist" && name != "build" && !name.starts_with('.') {
                    scan_env_recursive(&path, root, depth + 1, configs);
                }
            }
        }
    }
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: Option<String>,
}

#[tauri::command]
pub fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file_content(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(&path);
    if !dir_path.exists() {
        return Err("Path does not exist".to_string());
    }
    if !dir_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(dir_path) {
        for entry in read_dir.flatten() {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let path_buf = entry.path();
            let name = path_buf.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            
            let is_dir = metadata.is_dir();
            let size = metadata.len();
            let extension = path_buf.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_string());

            entries.push(FileEntry {
                name,
                path: path_buf.to_str().unwrap_or("").to_string(),
                is_dir,
                size,
                extension,
            });
        }
    }

    // Sort: Directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.is_dir && !b.is_dir {
            std::cmp::Ordering::Less
        } else if !a.is_dir && b.is_dir {
            std::cmp::Ordering::Greater
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}
