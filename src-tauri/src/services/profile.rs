use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

#[tauri::command]
pub async fn export_profile(
    app_handle: AppHandle,
    destination_path: String,
    local_storage_json: String,
) -> Result<(), String> {
    let dest_path = Path::new(&destination_path);
    let file = File::create(dest_path).map_err(|e| format!("Failed to create profile archive: {}", e))?;
    let mut zip = ZipWriter::new(file);

    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // 1. Write local_storage.json
    zip.start_file("local_storage.json", options.clone())
        .map_err(|e| format!("Failed to start zip file: {}", e))?;
    zip.write_all(local_storage_json.as_bytes())
        .map_err(|e| format!("Failed to write local storage: {}", e))?;

    // 2. Find and write didi.db
    let db_path = app_handle
        .path()
        .app_config_dir()
        .map(|p| p.join("didi.db"))
        .or_else(|_| app_handle.path().app_data_dir().map(|p| p.join("didi.db")))
        .map_err(|_| "Could not resolve app config/data directory".to_string())?;

    if db_path.exists() {
        zip.start_file("didi.db", options.clone())
            .map_err(|e| format!("Failed to start zip file: {}", e))?;
        let mut f = File::open(&db_path).map_err(|e| format!("Failed to open DB: {}", e))?;
        let mut buffer = Vec::new();
        f.read_to_end(&mut buffer).map_err(|e| format!("Failed to read DB: {}", e))?;
        zip.write_all(&buffer).map_err(|e| format!("Failed to write DB: {}", e))?;
    } else {
        eprintln!("Warning: didi.db not found at {:?}", db_path);
    }

    zip.finish().map_err(|e| format!("Failed to finish zip archive: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn import_profile(
    app_handle: AppHandle,
    source_path: String,
) -> Result<String, String> {
    let src_path = Path::new(&source_path);
    let file = File::open(src_path).map_err(|e| format!("Failed to open profile archive: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut local_storage_json = String::new();

    // 1. Read local_storage.json
    if let Ok(mut ls_file) = archive.by_name("local_storage.json") {
        ls_file.read_to_string(&mut local_storage_json).map_err(|e| format!("Failed to read local storage from zip: {}", e))?;
    } else {
        return Err("Profile archive is missing local_storage.json".to_string());
    }

    // 2. Extract didi.db
    if let Ok(mut db_file) = archive.by_name("didi.db") {
        let db_path = app_handle
            .path()
            .app_config_dir()
            .map(|p| p.join("didi.db"))
            .or_else(|_| app_handle.path().app_data_dir().map(|p| p.join("didi.db")))
            .map_err(|_| "Could not resolve app config/data directory".to_string())?;

        // Before replacing, we should ideally close any active SQLite connections,
        // but `tauri-plugin-sql` holds the connection. The easiest way for a desktop app
        // is to overwrite it and then force a reload or tell the user to restart.
        let mut out_f = File::create(&db_path).map_err(|e| format!("Failed to create DB file: {}", e))?;
        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer).map_err(|e| format!("Failed to read DB from zip: {}", e))?;
        out_f.write_all(&buffer).map_err(|e| format!("Failed to write DB to disk: {}", e))?;
    }

    Ok(local_storage_json)
}
