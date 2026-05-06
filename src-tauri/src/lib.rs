use tauri::{AppHandle, Emitter, Manager, State};
use portable_pty::{Child, CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::sync::Mutex;
use std::io::{Read, Write};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

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
    pty_processes: Mutex<HashMap<String, PtyProcess>>,
    sys: Mutex<sysinfo::System>,
    config: Mutex<AppConfig>,
}

struct PtyProcess {
    child: Box<dyn Child + Send + Sync>,
    pid: Option<u32>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GitSnapshot {
    id: String,
    commit: String,
    cwd: String,
    task_id: String,
    label: String,
    agent: String,
    created_at: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct HandoffMessage {
    target: String,
    payload: String,
    #[serde(default = "default_handoff_kind")]
    kind: String,
    #[serde(default)]
    sender: String,
    #[serde(default)]
    task_id: String,
    #[serde(default)]
    parent_task_id: String,
}

fn default_handoff_kind() -> String {
    "task".to_string()
}

fn normalize_agent(agent: &str) -> String {
    agent.trim().to_lowercase()
}

fn workspace_hash(cwd: &str) -> String {
    let mut hasher = DefaultHasher::new();
    cwd.to_lowercase().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn snapshots_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data_dir.join("snapshots");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn snapshots_file(app_handle: &AppHandle, cwd: &str) -> Result<PathBuf, String> {
    Ok(snapshots_dir(app_handle)?.join(format!("{}.json", workspace_hash(cwd))))
}

fn read_snapshots(app_handle: &AppHandle, cwd: &str) -> Vec<GitSnapshot> {
    let Ok(path) = snapshots_file(app_handle, cwd) else {
        return Vec::new();
    };

    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

fn write_snapshots(app_handle: &AppHandle, cwd: &str, snapshots: &[GitSnapshot]) -> Result<(), String> {
    let path = snapshots_file(app_handle, cwd)?;
    let json = serde_json::to_string_pretty(snapshots).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

fn run_git(cwd: &Path, args: &[&str], index_file: Option<&Path>) -> Result<String, String> {
    let mut command = Command::new("git");
    command.current_dir(cwd).args(args);

    if let Some(index_file) = index_file {
        command.env("GIT_INDEX_FILE", index_file);
    }

    let output = command.output().map_err(|e| e.to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err(format!("git {:?} failed", args))
    } else {
        Err(stderr)
    }
}

fn ensure_git_repo(cwd: &Path) -> Result<(), String> {
    run_git(cwd, &["rev-parse", "--is-inside-work-tree"], None)
        .and_then(|value| {
            if value == "true" {
                Ok(())
            } else {
                Err("Selected workspace is not inside a Git work tree.".to_string())
            }
        })
}

fn cleanup_pty(agent: &str, state: &State<'_, AppState>) {
    let agent_key = normalize_agent(agent);
    state.pty_writers.lock().unwrap().remove(&agent_key);
    state.pty_resizers.lock().unwrap().remove(&agent_key);

    if let Some(mut process) = state.pty_processes.lock().unwrap().remove(&agent_key) {
        let _ = process.child.kill();
    }
}

fn configure_workspace(cmd: &mut CommandBuilder, shell: &str, cwd: Option<String>) -> Result<(), String> {
    let Some(raw_cwd) = cwd else {
        return Ok(());
    };

    let workspace = PathBuf::from(raw_cwd);
    if !workspace.is_dir() {
        return Err(format!("Workspace does not exist or is not a directory: {}", workspace.display()));
    }

    let workspace = if workspace.is_absolute() {
        workspace
    } else {
        std::env::current_dir().map_err(|e| e.to_string())?.join(workspace)
    };
    let workspace_string = workspace.to_string_lossy().to_string();
    cmd.cwd(&workspace_string);
    cmd.env("DIDI_WORKSPACE", &workspace_string);
    cmd.env("DIDI_AGENT_ROOT", &workspace_string);
    cmd.env("PROJECT_ROOT", &workspace_string);
    cmd.env("INIT_CWD", &workspace_string);
    cmd.env("PWD", &workspace_string);

    let shell_name = Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(shell)
        .to_lowercase();

    if shell_name == "pwsh.exe" || shell_name == "pwsh" || shell_name == "powershell.exe" || shell_name == "powershell" {
        cmd.args(["-NoExit", "-Command", "Set-Location -LiteralPath $env:DIDI_WORKSPACE"]);
    } else if shell_name == "cmd.exe" || shell_name == "cmd" {
        cmd.args(["/K", "cd /d \"%DIDI_WORKSPACE%\""]);
    }

    Ok(())
}

#[tauri::command]
fn spawn_pty(agent: String, cwd: Option<String>, app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    cleanup_pty(&agent, &state);

    let pty_system = NativePtySystem::default();
    
    let pair = pty_system.openpty(PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| format!("{:?}", e))?;

    let shell = state.config.lock().unwrap().shell.clone();
    let mut cmd = CommandBuilder::new(&shell);
    configure_workspace(&mut cmd, &shell, cwd)?;
    cmd.env("AGENT_NAME", agent.clone());
    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("{:?}", e))?;
    let pid = child.process_id();

    let master = pair.master;
    let writer = master.take_writer().map_err(|e| format!("{:?}", e))?;
    let mut reader = master.try_clone_reader().map_err(|e| format!("{:?}", e))?;
    
    state.pty_writers.lock().unwrap().insert(agent.clone(), writer);
    state.pty_resizers.lock().unwrap().insert(agent.clone(), master);
    state.pty_processes.lock().unwrap().insert(agent.clone(), PtyProcess { child, pid });

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

        #[derive(serde::Serialize, Clone)]
        struct PtyExitPayload {
            agent: String,
        }
        let _ = app_handle.emit("pty-exit", PtyExitPayload { agent: agent_clone });
    });

    Ok(())
}

#[tauri::command]
fn write_pty(agent: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    if let Some(writer) = state.pty_writers.lock().unwrap().get_mut(&agent) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn close_pty(agent: String, state: State<'_, AppState>) -> Result<(), String> {
    cleanup_pty(&agent, &state);
    Ok(())
}

#[tauri::command]
fn get_process_stats(agent: String, state: State<'_, AppState>) -> Result<(f32, u64), String> {
    let agent = normalize_agent(&agent);
    let pid = {
        let mut processes = state.pty_processes.lock().unwrap();
        let Some(process) = processes.get_mut(&agent) else {
            return Ok((0.0, 0));
        };

        if let Ok(Some(_)) = process.child.try_wait() {
            processes.remove(&agent);
            return Ok((0.0, 0));
        }

        process.pid
    };

    let Some(pid) = pid else {
        return Ok((0.0, 0));
    };

    let mut sys = state.sys.lock().unwrap();
    let pid = sysinfo::Pid::from_u32(pid);
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[pid]), true);
    if let Some(process) = sys.process(pid) {
        return Ok((process.cpu_usage(), process.memory()));
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
    let agent = normalize_agent(&agent);
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
fn create_git_snapshot(
    cwd: String,
    task_id: String,
    label: String,
    agent: String,
    app_handle: AppHandle,
) -> Result<GitSnapshot, String> {
    let cwd_path = Path::new(&cwd);
    ensure_git_repo(cwd_path)?;
    let repo_root = run_git(cwd_path, &["rev-parse", "--show-toplevel"], None)?;
    let repo_path = PathBuf::from(repo_root);

    let snapshot_dir = snapshots_dir(&app_handle)?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let id = format!("{}-{}", now, task_id.chars().take(10).collect::<String>());
    let index_file = snapshot_dir.join(format!("{}.index", id));
    let git_dir = run_git(&repo_path, &["rev-parse", "--git-dir"], None)?;
    let existing_index = repo_path.join(git_dir).join("index");

    if existing_index.exists() {
        std::fs::copy(existing_index, &index_file).map_err(|e| e.to_string())?;
    }

    run_git(&repo_path, &["add", "-A"], Some(&index_file))?;
    let tree = run_git(&repo_path, &["write-tree"], Some(&index_file))?;
    let parent = run_git(&repo_path, &["rev-parse", "--verify", "HEAD"], None).ok();

    let message = format!(
        "didi hidden snapshot\n\nTask: {}\nAgent: {}\nTask-ID: {}",
        label, agent, task_id
    );
    let commit = if let Some(parent) = parent {
        run_git(&repo_path, &["commit-tree", &tree, "-p", &parent, "-m", &message], Some(&index_file))?
    } else {
        run_git(&repo_path, &["commit-tree", &tree, "-m", &message], Some(&index_file))?
    };

    let _ = std::fs::remove_file(&index_file);

    let snapshot = GitSnapshot {
        id,
        commit,
        cwd: cwd.clone(),
        task_id,
        label,
        agent,
        created_at: now,
    };

    let mut snapshots = read_snapshots(&app_handle, &cwd);
    snapshots.insert(0, snapshot.clone());
    snapshots.truncate(40);
    write_snapshots(&app_handle, &cwd, &snapshots)?;

    Ok(snapshot)
}

#[tauri::command]
fn list_git_snapshots(cwd: String, app_handle: AppHandle) -> Result<Vec<GitSnapshot>, String> {
    Ok(read_snapshots(&app_handle, &cwd))
}

#[tauri::command]
fn rewind_git_snapshot(cwd: String, commit: String) -> Result<String, String> {
    let cwd_path = Path::new(&cwd);
    ensure_git_repo(cwd_path)?;
    let repo_root = run_git(cwd_path, &["rev-parse", "--show-toplevel"], None)?;
    let repo_path = PathBuf::from(repo_root);

    run_git(&repo_path, &["cat-file", "-e", &format!("{}^{{commit}}", commit)], None)?;
    run_git(&repo_path, &["read-tree", "--reset", "-u", &commit], None)?;
    run_git(&repo_path, &["clean", "-fd"], None)?;

    Ok(format!("Workspace restored to snapshot {}", commit))
}

#[tauri::command]
fn append_master_plan_entry(cwd: String, title: String, body: String) -> Result<(), String> {
    let plan_path = Path::new(&cwd).join("MASTER_PLAN.md");
    let heading = title.trim();
    let content = body.trim();

    let entry = if content.is_empty() {
        format!("\n\n## {}\n", heading)
    } else {
        format!("\n\n## {}\n{}\n", heading, content)
    };

    if plan_path.exists() {
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(plan_path)
            .map_err(|e| e.to_string())?;
        file.write_all(entry.as_bytes()).map_err(|e| e.to_string())?;
    } else {
        std::fs::write(plan_path, format!("# Project Master Plan{}", entry)).map_err(|e| e.to_string())?;
    }

    Ok(())
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

$workspace = Split-Path -Parent $PSScriptRoot
$env:DIDI_WORKSPACE = $workspace
Set-Location -LiteralPath $workspace

$sender = $env:AGENT_NAME
if ([string]::IsNullOrEmpty($sender)) { $sender = "Main" }

$isCompletion = $Task -match '^\s*(Task complete|Done|Completed|Finished|Status|FYI|Ack|Acknowledged)\b'
$isCompletion = $isCompletion -or ($Task -match 'completion callback')
$taskId = [guid]::NewGuid().ToString("N")

if ($isCompletion) {
    $kind = "completion"
    $payload = "[$sender COMPLETED TASK]: $Task`n[SYSTEM RULE: This is a terminal status update. Do not acknowledge it, do not report back, and do not delegate a response unless this message explicitly assigns a new task.]"
} else {
    $kind = "task"
    $payload = "[$sender DELEGATED A TASK]: $Task`n[SYSTEM RULE: Do this task exactly once. When finished, report back exactly once by running: .didi\delegate $sender `"Task complete: <summary>`". After sending that completion callback, stop; do not send acknowledgements or confirmations.]"
}

$msgObj = @{
    target = $Target
    payload = $payload
    kind = $kind
    sender = $sender
    taskId = $taskId
    parentTaskId = ""
}
$msg = $msgObj | ConvertTo-Json -Compress

try {
    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "agentbus", [System.IO.Pipes.PipeDirection]::Out)
    $pipe.Connect(2000)
    $writer = New-Object System.IO.StreamWriter($pipe)
    $writer.Write($msg)
    $writer.Dispose()
    $pipe.Dispose()
    if ($kind -eq "completion") {
        Write-Host "Sent completion update to '$Target'. No response is expected." -ForegroundColor Green
    } else {
        Write-Host "Delegated task to '$Target' successfully. Waiting for one completion callback." -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to delegate task to $Target. Error: $_"
}
"#;

    let delegate_cmd = r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0delegate.ps1" %*
"#;

    let master_plan_md = r#"# Project Master Plan

## Current Phase: Planning

### Tasks
- [ ] Define architecture and state logic.
- [ ] Implement backend components.
- [ ] Implement frontend components.
- [ ] Testing and finalization.
"#;

    let agents_md = r#"# DidiTerminal - Autonomous Collaboration Protocol

You are an AI Agent running inside the DidiTerminal Orchestrator.
You are part of a multi-agent team. Communicate through the local `.didi\delegate` command.
CRITICAL: To conserve tokens and maintain context, YOU MUST NOT SEND CODE IN YOUR MESSAGES.
The selected workspace root is exposed as `$env:DIDI_WORKSPACE`. Treat that path as the boundary for all file reads and writes.

## Rule 1: The Global Brain (MASTER_PLAN.md)
This workspace contains a `MASTER_PLAN.md`. This is your shared state.
1. When starting a task, update `MASTER_PLAN.md`.
2. When you finish a step, check it off in `MASTER_PLAN.md`.
3. When delegating, tell the target agent: "I finished step 2. Proceed with step 3 in the MASTER_PLAN."
DidiTerminal creates hidden git snapshots around delegated plan work so the human can rewind a bad change without disturbing normal terminal handoffs.

## Rule 2: Delegate Real Work Only
Use delegation only when assigning a new task that requires action.
**Usage:** `.didi\delegate <AgentName> "<Short message pointing to MASTER_PLAN>"`

Do not delegate acknowledgements, thanks, status chatter, or confirmations.

## Rule 3: Complete Each Delegated Task Once
When you receive a delegated task, do the work. When finished, send ONE completion callback:
**Usage:** `.didi\delegate <SenderName> "Task complete. Check MASTER_PLAN."`

After sending the completion callback, stop. 

## Rule 4: Context Gathering
If you lose track of what the team is doing, or where files are, DO NOT guess or ask the human. 
Run `.didi\context` to instantly get a token-efficient snapshot of the directory tree, git status, and the MASTER_PLAN.

## Rule 5: Sentinel Recovery
If the terminal warns that you are repeating the same failed command, stop the loop, choose a different approach, or ask for help. Do not retry the same command again without changing the plan.
"#;

    let context_ps1 = r#"
$workspace = Split-Path -Parent $PSScriptRoot
$env:DIDI_WORKSPACE = $workspace
Set-Location -LiteralPath $workspace

Write-Host "--- DIDI CONTEXT SNAPSHOT ---" -ForegroundColor Cyan
Write-Host "`n[0] WORKSPACE ROOT: $workspace" -ForegroundColor Yellow

Write-Host "`n[1] PROJECT STRUCTURE (Max depth 2):" -ForegroundColor Yellow
if (Get-Command tree -ErrorAction SilentlyContinue) {
    tree /F /A | Select-String -NotMatch "node_modules|target|\.git" | Select-Object -First 30
} else {
    Get-ChildItem -Depth 2 -Exclude "node_modules","target",".git" | Select-Object FullName
}

Write-Host "`n[2] GIT STATUS:" -ForegroundColor Yellow
if (Test-Path ".git") {
    git status -s
} else {
    Write-Host "Not a git repository."
}

Write-Host "`n[3] MASTER PLAN PENDING TASKS:" -ForegroundColor Yellow
if (Test-Path "MASTER_PLAN.md") {
    Get-Content "MASTER_PLAN.md" | Select-String -Pattern "- \[ \]" | Select-Object -First 5
} else {
    Write-Host "No MASTER_PLAN.md found."
}

Write-Host "`n--- END OF SNAPSHOT ---" -ForegroundColor Cyan
"#;

    let context_cmd = r#"@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0context.ps1"
"#;

    std::fs::write(didi_dir.join("delegate.ps1"), delegate_ps1).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("delegate.cmd"), delegate_cmd).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.ps1"), context_ps1).map_err(|e| e.to_string())?;
    std::fs::write(didi_dir.join("context.cmd"), context_cmd).map_err(|e| e.to_string())?;
    std::fs::write(path.join("AGENTS.md"), agents_md).map_err(|e| e.to_string())?;
    
    // Only write MASTER_PLAN if it doesn't already exist so we don't overwrite user progress
    let plan_path = path.join("MASTER_PLAN.md");
    if !plan_path.exists() {
        std::fs::write(plan_path, master_plan_md).map_err(|e| e.to_string())?;
    }

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
                                if let Ok(message) = serde_json::from_value::<HandoffMessage>(json) {
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
            pty_processes: Mutex::new(HashMap::new()),
            sys: Mutex::new(sysinfo::System::new_all()),
            config: Mutex::new(AppConfig::default()),
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, close_pty, resize_pty, initialize_project, get_process_stats,
            get_project_context, get_config, set_config, get_sidecar_status, ask_llm,
            create_git_snapshot, list_git_snapshots, rewind_git_snapshot, append_master_plan_entry
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
