use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: Option<String>,
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
