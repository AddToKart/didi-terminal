use tauri::{AppHandle, Manager};
use rusqlite::Connection;
use rand_core::OsRng;
use argon2::{
    password_hash::{
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString
    },
    Argon2
};

fn get_db_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap().join("didi.db")
}

#[tauri::command]
pub async fn set_workspace_pin(
    app: AppHandle,
    workspace_id: String,
    pin: String
) -> Result<(), String> {
    if pin.len() < 4 {
        return Err("PIN must be at least 4 characters".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(pin.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();

    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspaces SET totp_secret = ?1 WHERE id = ?2",
        [password_hash, workspace_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn verify_workspace_pin(
    app: AppHandle,
    workspace_id: String,
    pin: String
) -> Result<bool, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let hash: Option<String> = conn.query_row(
        "SELECT totp_secret FROM workspaces WHERE id = ?1",
        [workspace_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if let Some(hash_str) = hash {
        let parsed_hash = PasswordHash::new(&hash_str).map_err(|e| e.to_string())?;
        Ok(Argon2::default().verify_password(pin.as_bytes(), &parsed_hash).is_ok())
    } else {
        // No PIN enabled for this workspace
        Ok(true)
    }
}

#[tauri::command]
pub async fn is_pin_enabled(app: AppHandle, workspace_id: String) -> Result<bool, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let hash: Option<String> = conn.query_row(
        "SELECT totp_secret FROM workspaces WHERE id = ?1",
        [workspace_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(hash.is_some())
}

#[tauri::command]
pub async fn disable_workspace_pin(
    app: AppHandle,
    workspace_id: String,
    pin: String
) -> Result<(), String> {
    let is_valid = verify_workspace_pin(app.clone(), workspace_id.clone(), pin).await?;
    if !is_valid {
        return Err("Invalid PIN".to_string());
    }

    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspaces SET totp_secret = NULL WHERE id = ?1",
        [workspace_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
