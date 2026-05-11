use totp_rs::{Algorithm, TOTP, Secret};
use tauri::{AppHandle, Manager};
use rusqlite::Connection;
use serde::Serialize;

#[derive(Serialize)]
pub struct TotpSetup {
    pub secret: String,
    pub qr_code: String,
}

fn get_db_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap().join("didi.db")
}

#[tauri::command]
pub async fn generate_2fa_setup(_app: AppHandle, workspace_name: String) -> Result<TotpSetup, String> {
    let secret_str = Secret::generate_secret().to_string();
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret_str.clone()).to_bytes().map_err(|e| e.to_string())?,
        Some("DidiTerminal".to_string()),
        workspace_name,
    ).map_err(|e| e.to_string())?;

    let qr_base64 = totp.get_qr_base64().map_err(|e| e.to_string())?;

    Ok(TotpSetup {
        secret: secret_str,
        qr_code: qr_base64,
    })
}

#[tauri::command]
pub async fn verify_and_enable_2fa(
    app: AppHandle,
    workspace_id: String,
    secret: String,
    code: String
) -> Result<(), String> {
    let totp = TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        Secret::Encoded(secret.clone()).to_bytes().map_err(|e| e.to_string())?,
        None,
        "".to_string(),
    ).map_err(|e| e.to_string())?;

    if !totp.check_current(&code).map_err(|e| e.to_string())? {
        return Err("Invalid 2FA code".to_string());
    }

    // Save to DB
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspaces SET totp_secret = ?1 WHERE id = ?2",
        [secret, workspace_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn verify_workspace_2fa(
    app: AppHandle,
    workspace_id: String,
    code: String
) -> Result<bool, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let secret: Option<String> = conn.query_row(
        "SELECT totp_secret FROM workspaces WHERE id = ?1",
        [workspace_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if let Some(secret_str) = secret {
        let totp = TOTP::new(
            Algorithm::SHA1,
            6,
            1,
            30,
            Secret::Encoded(secret_str).to_bytes().map_err(|e| e.to_string())?,
            None,
            "".to_string(),
        ).map_err(|e| e.to_string())?;

        Ok(totp.check_current(&code).map_err(|e| e.to_string())?)
    } else {
        // No 2FA enabled for this workspace
        Ok(true)
    }
}


#[tauri::command]
pub async fn is_2fa_enabled(app: AppHandle, workspace_id: String) -> Result<bool, String> {
    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    let secret: Option<String> = conn.query_row(
        "SELECT totp_secret FROM workspaces WHERE id = ?1",
        [workspace_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    Ok(secret.is_some())
}

#[tauri::command]
pub async fn disable_workspace_2fa(
    app: AppHandle,
    workspace_id: String,
    code: String
) -> Result<(), String> {
    let is_valid = verify_workspace_2fa(app.clone(), workspace_id.clone(), code).await?;
    if !is_valid {
        return Err("Invalid 2FA code".to_string());
    }

    let db_path = get_db_path(&app);
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspaces SET totp_secret = NULL WHERE id = ?1",
        [workspace_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
