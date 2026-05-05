use tauri::{AppHandle, Emitter, Manager, State};
use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::sync::Mutex;
use std::io::{Read, Write};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct AppConfig {
    pub shell: String,
    pub llm_endpoint: String,
    pub theme_cyan: String,
    pub theme_amber: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            shell: "pwsh.exe".to_string(),
            llm_endpoint: "http://localhost:8080/v1".to_string(),
            theme_cyan: "#00f0ff".to_string(),
            theme_amber: "#ffb000".to_string(),
        }
    }
}

struct AppState {
    pty_writers: Mutex<HashMap<String, Box<dyn Write + Send>>>,
    pty_resizers: Mutex<HashMap<String, Box<dyn portable_pty::MasterPty + Send>>>,
    sys: Mutex<sysinfo::System>,
    config: Mutex<AppConfig>,
}

#[tauri::command]
fn spawn_pty(agent: String, cwd: Option<String>, app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let pty_system = NativePtySystem::default();
    
    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| format!("{:?}", e))?;

    let mut cmd = CommandBuilder::new("pwsh.exe");
    if let Some(path) = cwd {
        cmd.cwd(path);
    }
    cmd.env("AGENT_NAME", agent.clone());
    let _child = pair.slave.spawn_command(cmd).map_err(|e| format!("{:?}", e))?;

    let master = pair.master;
    let writer = master.take_writer().map_err(|e| format!("{:?}", e))?;
    let mut reader = master.try_clone_reader().map_err(|e| format!("{:?}", e))?;
    
    state.pty_writers.lock().unwrap().insert(agent.clone(), writer);
    state.pty_resizers.lock().unwrap().insert(agent.clone(), master);

    let agent_clone = agent.clone();
    std::thread::spawn(move || {
        let mut buf = [0; 1024];
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 { break; }
            let data = String::from_utf8_lossy(&buf[..n]).to_string();
            #[derive(serde::Serialize, Clone)]
            struct PtyPayload {
                agent: String,
                data: String,
            }
            let _ = app_handle.emit("pty-output", PtyPayload {
                agent: agent_clone.clone(),
                data,
            });
        }
    });

    Ok(())
}

#[tauri::command]
fn write_pty(agent: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(writer) = state.pty_writers.lock().unwrap().get_mut(&agent) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_process_stats(agent: String, state: State<'_, AppState>) -> Result<(f32, u64), String> {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name == "pwsh.exe" || name == "pwsh" {
            for env in process.environ() {
                let env_str = env.to_string_lossy();
                if env_str.starts_with("AGENT_NAME=") {
                    let parts: Vec<&str> = env_str.splitn(2, '=').collect();
                    if parts.len() == 2 && parts[1] == agent {
                        return Ok((process.cpu_usage(), process.memory()));
                    }
                }
            }
        }
    }
    Ok((0.0, 0))
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    Ok(state.config.lock().unwrap().clone())
}

#[tauri::command]
fn set_config(new_config: AppConfig, state: State<'_, AppState>) -> Result<(), String> {
    *state.config.lock().unwrap() = new_config;
    Ok(())
}

#[tauri::command]
fn get_sidecar_status(state: State<'_, AppState>) -> Result<String, String> {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("llama-server") {
            return Ok("Running".to_string());
        }
    }
    Ok("Stopped".to_string())
}

#[tauri::command]
fn resize_pty(agent: String, cols: u16, rows: u16, state: State<'_, AppState>) -> Result<(), String> {
    if let Some(master) = state.pty_resizers.lock().unwrap().get_mut(&agent) {
        let _ = master.resize(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 });
    }
    Ok(())
}

#[tauri::command]
fn get_project_context(cwd: Option<String>) -> Result<String, String> {
    if let Some(path) = cwd {
        let walker = ignore::WalkBuilder::new(&path)
            .hidden(true)
            .git_ignore(true)
            .build();
            
        let mut files = Vec::new();
        // Take at most 150 files to prevent blowing up the LLM context window
        for result in walker.filter_map(|e| e.ok()).take(150) {
            if let Some(file_type) = result.file_type() {
                if file_type.is_file() {
                    if let Ok(rel_path) = result.path().strip_prefix(&path) {
                        files.push(rel_path.to_string_lossy().to_string());
                    }
                }
            }
        }
        Ok(format!("WORKSPACE_FILES:\n{}", files.join("\n")))
    } else {
        Ok("NO_WORKSPACE".to_string())
    }
}

#[tauri::command]
async fn ask_llm(prompt: String, system: String, state: State<'_, AppState>) -> Result<String, String> {
    let endpoint = state.config.lock().unwrap().llm_endpoint.clone();
    
    let client = reqwest::Client::new();
    let payload = serde_json::json!({
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    });

    let res = client.post(format!("{}/chat/completions", endpoint))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Reqwest error: {}", e))?;

    let json: serde_json::Value = res.json().await.map_err(|e| format!("JSON error: {}", e))?;
    
    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        Ok(content.to_string())
    } else {
        Err("Failed to parse response".to_string())
    }
}

#[tauri::command]
fn initialize_project(cwd: String) -> Result<(), String> {
    let path = std::path::Path::new(&cwd);
    
    let didi_dir = path.join(".didi");
    std::fs::create_dir_all(&didi_dir).map_err(|e| e.to_string())?;

    let delegate_ps1 = r#"param (
    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$Task
)

$sender = $env:AGENT_NAME
if ([string]::IsNullOrEmpty($sender)) { $sender = "Main" }

# Append autonomous callback instructions so the receiving agent knows who to report back to
$enrichedTask = "[$sender DELEGATED A TASK]: $Task`n[SYSTEM RULE: When you finish this task, you MUST report back to $sender by running: .didi\delegate $sender `"Task complete: <summary>`"]"

$msgObj = @{
    target = $Target
    payload = $enrichedTask
}
$msg = $msgObj | ConvertTo-Json -Compress

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe)
    $writer.Write($msg)
    $writer.Dispose()
    $pipe.Dispose()
    Write-Host "Delegated task to '$Target' successfully. Now waiting for them to report back." -ForegroundColor Green
} catch {
    Write-Error "Failed to delegate task to $Target. Error: $_"
}
"#;

    let delegate_cmd = r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0delegate.ps1" %*
"#;

    let agents_md = r#"# DidiTerminal - Autonomous Collaboration Protocol

You are an AI Agent running inside the DidiTerminal Orchestrator. 
You are part of a multi-agent team. You must communicate and collaborate autonomously without waiting for the human to intervene.

## Rule 1: The `delegate` Command
If you need another agent to do something (e.g., "Builder" to write code, "Documentation" to write docs), you MUST use the terminal to delegate it.
**Usage:** `.didi\delegate <AgentName> "<Task Description>"`

## Rule 2: Autonomous Callbacks (Reporting Back)
When you receive a delegated task, it will say `[<SenderName> DELEGATED A TASK]`.
You MUST do the work, and when you are finished, you MUST use the delegate command to tell the sender you are done!
**Usage:** `.didi\delegate <SenderName> "I have finished the task. The results are..."`

## Rule 3: Do Not Ask The Human
Do not stop and ask the human to pass messages for you. If you need to talk to Builder, use `.didi\delegate Builder "..."`. If you need to tell Main you are done, use `.didi\delegate Main "Done."`.

## The `context` command
If you lose track of what the team is doing, run `.didi\context` to see the global history of all tasks passed between agents.
"#;

    let context_ps1 = r#"
$sessionFile = "$env:APPDATA\DidiTerminal\context\session.json"
if (Test-Path $sessionFile) {
    $data = Get-Content $sessionFile | ConvertFrom-Json
    Write-Host "--- DIDI GLOBAL SESSION HISTORY ---" -ForegroundColor Cyan
    foreach ($entry in $data) {
        Write-Host "[$($entry.timestamp)] $($entry.target): $($entry.payload)"
    }
} else {
    Write-Host "No global session history found yet." -ForegroundColor Gray
}
"#;

    let context_cmd = r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0context.ps1"
"#;

    std::fs::write(didi_dir.join("delegate.ps1"), delegate_ps1).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("delegate.cmd"), delegate_cmd).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.ps1"), context_ps1).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.cmd"), context_cmd).map_err(|e| e.to_string())?;
    std::fs::write(path.join("AGENTS.md"), agents_md).map_err(|e| e.to_string())?;

    Ok(())
}

fn start_agent_bus(app_handle: AppHandle) {
    #[cfg(windows)]
    tauri::async_runtime::spawn(async move {
        use tokio::net::windows::named_pipe::ServerOptions;
        use tokio::io::AsyncReadExt;
        
        let pipe_name = r"\\.\pipe\agentbus";
        loop {
            let mut server = match ServerOptions::new().first_pipe_instance(true).create(pipe_name) {
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
                let mut buf = vec![0; 4096];
                if let Ok(n) = server.read(&mut buf).await {
                    if n > 0 {
                        let msg = String::from_utf8_lossy(&buf[..n]).to_string();
                        match serde_json::from_str::<serde_json::Value>(&msg) {
                            Ok(json) => {
                                #[derive(serde::Serialize, Clone)]
                                struct HandoffPayload {
                                    target: String,
                                    payload: String,
                                }
                                if let (Some(target), Some(payload)) = (json["target"].as_str(), json["payload"].as_str()) {
                                    if let Ok(app_data_dir) = app_handle.path().app_data_dir() {
                                        let context_dir = app_data_dir.join("context");
                                        let _ = std::fs::create_dir_all(&context_dir);
                                        let session_file = context_dir.join("session.json");

                                        let mut session_data: Vec<serde_json::Value> = std::fs::read_to_string(&session_file)
                                            .ok()
                                            .and_then(|s| serde_json::from_str(&s).ok())
                                            .unwrap_or_else(Vec::new);

                                        session_data.push(serde_json::json!({
                                            "target": target,
                                            "task": payload,
                                            "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()
                                        }));

                                        if let Ok(json_str) = serde_json::to_string_pretty(&session_data) {
                                            let _ = std::fs::write(session_file, json_str);
                                        }
                                    }

                                    let _ = app_handle.emit("agent-handoff", HandoffPayload {
                                        target: target.to_string(),
                                        payload: payload.to_string(),
                                    });
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            pty_writers: Mutex::new(HashMap::new()),
            pty_resizers: Mutex::new(HashMap::new()),
            sys: Mutex::new(sysinfo::System::new_all()),
            config: Mutex::new(AppConfig::default()),
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, resize_pty, initialize_project, get_process_stats,
            get_config, set_config, get_sidecar_status, ask_llm
        ])
        .setup(|app| {
            start_agent_bus(app.handle().clone());
            
            use tauri_plugin_shell::ShellExt;
            if let Ok(sidecar_command) = app.handle().shell().sidecar("llama-server") {
                let _ = sidecar_command.spawn();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}