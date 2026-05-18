use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HandoffMessage {
    pub target: String,
    pub payload: String,
    #[serde(default = "default_handoff_kind")]
    pub kind: String,
    #[serde(default)]
    pub sender: String,
    #[serde(default)]
    pub task_id: String,
    #[serde(default)]
    pub parent_task_id: String,
    #[serde(default)]
    pub auth_token: String,
}

fn default_handoff_kind() -> String {
    "task".to_string()
}

pub fn start_agent_bus(app_handle: AppHandle) {
    #[cfg(windows)]
    tauri::async_runtime::spawn(async move {
        use tokio::net::windows::named_pipe::ServerOptions;
        use tokio::io::AsyncReadExt;
        
        let pipe_name = r"\\.\pipe\agentbus";
        loop {
            let server = match ServerOptions::new().first_pipe_instance(true).create(pipe_name) {
                Ok(s) => s,
                Err(_) => {
                    match ServerOptions::new().create(pipe_name) {
                        Ok(s) => s,
                        Err(e) => {
                            eprintln!("Failed to create named pipe: {}", e);
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            continue;
                        }
                    }
                }
            };

            if server.connect().await.is_ok() {
                let mut buf = Vec::new();
                // Security check: limit payload size to 2MB to prevent OOM
                if server.take(2 * 1024 * 1024).read_to_end(&mut buf).await.is_ok() {
                    if !buf.is_empty() {
                        let msg = String::from_utf8_lossy(&buf).to_string();
                        match serde_json::from_str::<serde_json::Value>(&msg) {
                            Ok(json) => {
                                if let Ok(mut message) = serde_json::from_value::<HandoffMessage>(json) {
                                    // Security check: validate session token
                                    let is_valid = if let Some(state) = app_handle.try_state::<crate::AppState>() {
                                        message.auth_token == state.session_token
                                    } else {
                                        false
                                    };

                                    if !is_valid {
                                        eprintln!("Unauthorized handoff attempt from sender: {}", message.sender);
                                        continue;
                                    }

                                    // Auto-scope targets to the sender's workspace if not fully qualified
                                    if message.sender.contains("::") && !message.target.contains("::") {
                                        if let Some(ws_id) = message.sender.split("::").next() {
                                            message.target = format!("{}::{}", ws_id, message.target);
                                        }
                                    }

                                    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                                        let context_dir = app_data_dir.join("context");
                                        let _ = std::fs::create_dir_all(&context_dir);
                                        let session_file = context_dir.join("session.json");

                                        let mut session_data: Vec<serde_json::Value> = std::fs::read_to_string(&session_file)
                                            .ok()
                                            .and_then(|s| serde_json::from_str(&s).ok())
                                            .unwrap_or_else(Vec::new);

                                        session_data.push(serde_json::json!({
                                            "target": message.target,
                                            "task": message.payload,
                                            "kind": message.kind,
                                            "sender": message.sender,
                                            "taskId": message.task_id,
                                            "parentTaskId": message.parent_task_id,
                                            "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
                                        }));

                                        if let Ok(json_str) = serde_json::to_string_pretty(&session_data) {
                                            let _ = std::fs::write(session_file, json_str);
                                        }
                                    }

                                    let _ = app_handle.emit("agent-handoff", message);
                                }
                            }
                            Err(e) => {
                                eprintln!("Failed to parse handoff JSON: {}. Raw message: {}", e, msg);
                            }
                        }
                    }
                }
            }
        }
    });
}
