use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::{AppHandle, Manager};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce
};
use base64::{prelude::BASE64_STANDARD, Engine};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultVar {
    pub id: String,
    pub env_key: String,
    pub env_value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultVarInput {
    pub id: Option<String>,
    pub env_key: String,
    pub env_value: String,
}

fn get_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_data_dir()
        .map(|dir| dir.join("didi.db"))
        .map_err(|e| format!("Failed to resolve app data directory: {}", e))
}

pub fn init_vault_db(app: &AppHandle) -> Result<(), String> {
    let db_path = get_db_path(app)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspace_env_vault (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            env_key TEXT NOT NULL,
            encrypted_value TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

fn derive_key(workspace_id: &str) -> [u8; 32] {
    let username = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "didi_default_user".to_string());
    let compname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "didi_default_host".to_string());
    let system_secret = format!("{}-{}", username, compname);

    let salt = workspace_id.as_bytes();
    let mut derived_key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(system_secret.as_bytes(), salt, 1000, &mut derived_key);
    derived_key
}

fn encrypt_value(plain_text: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new(key.into());
    let mut nonce_bytes = [0u8; 12];
    rand_core::RngCore::fill_bytes(&mut rand_core::OsRng, &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plain_text.as_bytes())
        .map_err(|e| format!("Encryption error: {}", e))?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64_STANDARD.encode(combined))
}

fn decrypt_value(encrypted_base64: &str, key: &[u8; 32]) -> Result<String, String> {
    let cipher = Aes256Gcm::new(key.into());
    let data = BASE64_STANDARD.decode(encrypted_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    if data.len() < 12 {
        return Err("Encrypted data is too short".to_string());
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let decrypted_bytes = cipher.decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption error: {}", e))?;

    String::from_utf8(decrypted_bytes)
        .map_err(|e| format!("UTF-8 decoding error: {}", e))
}

#[tauri::command]
pub async fn get_vault_vars(
    app: AppHandle,
    workspace_id: String
) -> Result<Vec<VaultVar>, String> {
    let db_path = get_db_path(&app)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, env_key, encrypted_value FROM workspace_env_vault WHERE workspace_id = ?1 ORDER BY env_key ASC"
    ).map_err(|e| e.to_string())?;

    let key = derive_key(&workspace_id);

    let rows = stmt.query_map([&workspace_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut vars = Vec::new();
    for r in rows {
        let (id, env_key, encrypted_value) = r.map_err(|e| e.to_string())?;
        let env_value = decrypt_value(&encrypted_value, &key)?;
        vars.push(VaultVar {
            id,
            env_key,
            env_value,
        });
    }

    Ok(vars)
}

#[tauri::command]
pub async fn save_vault_vars(
    app: AppHandle,
    workspace_id: String,
    vars: Vec<VaultVarInput>
) -> Result<(), String> {
    let db_path = get_db_path(&app)?;
    let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    let key = derive_key(&workspace_id);
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut kept_ids = Vec::new();

    for var in vars {
        let env_key = var.env_key.trim();
        if env_key.is_empty() {
            continue;
        }

        let encrypted_value = encrypt_value(&var.env_value, &key)?;
        let id = match var.id {
            Some(existing_id) if !existing_id.is_empty() => {
                tx.execute(
                    "INSERT OR REPLACE INTO workspace_env_vault (id, workspace_id, env_key, encrypted_value, created_at) \
                     VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))",
                    [&existing_id, &workspace_id, env_key, &encrypted_value],
                ).map_err(|e| e.to_string())?;
                existing_id
            }
            _ => {
                let new_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO workspace_env_vault (id, workspace_id, env_key, encrypted_value, created_at) \
                     VALUES (?1, ?2, ?3, ?4, strftime('%s', 'now'))",
                    [&new_id, &workspace_id, env_key, &encrypted_value],
                ).map_err(|e| e.to_string())?;
                new_id
            }
        };
        kept_ids.push(id);
    }

    if kept_ids.is_empty() {
        tx.execute(
            "DELETE FROM workspace_env_vault WHERE workspace_id = ?1",
            [&workspace_id],
        ).map_err(|e| e.to_string())?;
    } else {
        let placeholders = kept_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let query = format!(
            "DELETE FROM workspace_env_vault WHERE workspace_id = ?1 AND id NOT IN ({})",
            placeholders
        );

        let mut params: Vec<&dyn rusqlite::ToSql> = vec![&workspace_id];
        for id in &kept_ids {
            params.push(id);
        }

        tx.execute(&query, rusqlite::params_from_iter(params)).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
