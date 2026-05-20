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
pub async fn read_file_content(path: String, root: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path).canonicalize().map_err(|e| e.to_string())?;
        let r = Path::new(&root).canonicalize().map_err(|e| e.to_string())?;
        if !p.starts_with(&r) {
            return Err("Path traversal attempt blocked".to_string());
        }
        fs::read_to_string(&p).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn write_file_content(path: String, root: String, content: String) -> Result<(), String> {
    // We allow writing to paths that might not exist yet, so we canonicalize the parent
    let p = Path::new(&path);
    let parent = p.parent().ok_or("No parent directory")?;
    let canon_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let r = Path::new(&root).canonicalize().map_err(|e| e.to_string())?;
    
    if !canon_parent.starts_with(&r) {
        return Err("Path traversal attempt blocked".to_string());
    }
    fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_directory(path: String, root: String) -> Result<Vec<FileEntry>, String> {
    tokio::task::spawn_blocking(move || {
        let p = Path::new(&path).canonicalize().map_err(|e| e.to_string())?;
        let r = Path::new(&root).canonicalize().map_err(|e| e.to_string())?;
        if !p.starts_with(&r) {
            return Err("Path traversal attempt blocked".to_string());
        }

        if !p.is_dir() {
            return Err("Path is not a directory".to_string());
        }

        let mut entries = Vec::new();
        if let Ok(read_dir) = fs::read_dir(p) {
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
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn search_project_files(cwd: String) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let root = Path::new(&cwd);
        if !root.exists() || !root.is_dir() {
            return Err("Invalid directory".to_string());
        }

        let mut files = Vec::new();
        // WalkBuilder automatically respects .gitignore, hidden files (like .git), and skips large binaries efficiently
        let walker = ignore::WalkBuilder::new(root)
            .hidden(false) // we might want to see .env, so we let ignore handle .git explicitly or by default
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                name != ".git" && name != "node_modules" && name != "target" && name != "dist" && name != "build"
            })
            .build();

        for result in walker {
            if let Ok(entry) = result {
                if entry.file_type().map_or(false, |ft| ft.is_file()) {
                    if let Ok(rel_path) = entry.path().strip_prefix(root) {
                        files.push(rel_path.to_string_lossy().replace('\\', "/"));
                    }
                }
            }
        }

        files.sort();
        Ok(files)
    })
    .await
    .map_err(|e| e.to_string())?
}
