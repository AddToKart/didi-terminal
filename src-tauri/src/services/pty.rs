use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use portable_pty::{Child, CommandBuilder, NativePtySystem, PtySize, PtySystem};
use tauri::{AppHandle, Emitter, Manager, State};

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::AppState;

const PTY_READ_BUFFER_SIZE: usize = 16 * 1024;
const PTY_SCROLLBACK_LIMIT: usize = 4 * 1024 * 1024;

pub struct PtyProcess {
    pub child: Box<dyn Child + Send + Sync>,
    pub pid: Option<u32>,
}

#[derive(serde::Serialize, Clone)]
struct PtyPayload {
    agent: String,
    workspace: String,
    data: String,
    bytes: String,
}

#[derive(serde::Serialize)]
pub struct PtyScrollback {
    data: String,
    bytes: String,
}

pub fn normalize_agent(agent: &str) -> String {
    agent.trim().to_lowercase()
}

fn agent_event_key(agent: &str) -> String {
    agent
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect()
}

fn emit_pty_output(app_handle: &AppHandle, agent: &str, chunk: Vec<u8>) {
    let mut workspace = "Default".to_string();
    if let Some(state) = app_handle.try_state::<AppState>() {
        if let Ok(mut scrollbacks) = state.pty_scrollbacks.lock() {
            if let Some(sb) = scrollbacks.get_mut(agent) {
                sb.extend_from_slice(&chunk);
                if sb.len() > PTY_SCROLLBACK_LIMIT {
                    let excess = sb.len() - PTY_SCROLLBACK_LIMIT;
                    sb.drain(0..excess);
                }
            }
        }
        if let Ok(workspaces) = state.pty_workspaces.lock() {
            if let Some(ws) = workspaces.get(agent) {
                workspace = ws.clone();
            }
        }
    }

    let data = String::from_utf8_lossy(&chunk).into_owned();
    let payload = PtyPayload {
        agent: agent.to_string(),
        workspace,
        data,
        bytes: BASE64.encode(&chunk),
    };
    
    // Global event for external listeners
    let _ = app_handle.emit("pty-output", payload.clone());
    
    // Targeted event for the specific terminal instance (faster)
    let output_event = format!("pty-output-agent-{}", agent_event_key(agent));
    let _ = app_handle.emit(output_event.as_str(), payload);
}

pub fn cleanup_pty(agent: &str, state: &State<'_, AppState>) {
    let agent_key = normalize_agent(agent);
    state.pty_writers.lock().unwrap().remove(&agent_key);
    state.pty_resizers.lock().unwrap().remove(&agent_key);
    state.pty_scrollbacks.lock().unwrap().remove(&agent_key);
    state.pty_workspaces.lock().unwrap().remove(&agent_key);

    if let Some(mut process) = state.pty_processes.lock().unwrap().remove(&agent_key) {
        let _ = process.child.kill();
    }
}

pub fn configure_workspace(
    cmd: &mut CommandBuilder,
    shell: &str,
    cwd: Option<String>,
) -> Result<(), String> {
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("FORCE_COLOR", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.env("LANG", "en_US.UTF-8");
    cmd.env("LC_ALL", "en_US.UTF-8");

    let workspace_string = if let Some(raw_cwd) = cwd {
        let workspace = PathBuf::from(raw_cwd);
        if !workspace.is_dir() {
            return Err(format!(
                "Workspace does not exist or is not a directory: {}",
                workspace.display()
            ));
        }

        let workspace = if workspace.is_absolute() {
            workspace
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(workspace)
        };
        let workspace_string = workspace.to_string_lossy().to_string();
        cmd.cwd(&workspace_string);
        cmd.env("DIDI_WORKSPACE", &workspace_string);
        cmd.env("DIDI_AGENT_ROOT", &workspace_string);
        cmd.env("PROJECT_ROOT", &workspace_string);
        cmd.env("INIT_CWD", &workspace_string);
        cmd.env("PWD", &workspace_string);
        Some(workspace_string)
    } else {
        None
    };

    let shell_name = Path::new(shell)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(shell)
        .to_lowercase();

    if shell_name == "pwsh.exe"
        || shell_name == "pwsh"
        || shell_name == "powershell.exe"
        || shell_name == "powershell"
    {
        let command = if workspace_string.is_some() {
            "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; Set-Location -LiteralPath $env:DIDI_WORKSPACE"
        } else {
            "[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding"
        };
        cmd.args(["-NoLogo", "-NoExit", "-Command", command]);
    } else if shell_name == "cmd.exe" || shell_name == "cmd" {
        let command = if workspace_string.is_some() {
            "chcp 65001 >nul & cd /d \"%DIDI_WORKSPACE%\""
        } else {
            "chcp 65001 >nul"
        };
        cmd.args(["/K", command]);
    }

    Ok(())
}

#[tauri::command]
pub fn spawn_pty(
    agent: String,
    cwd: Option<String>,
    workspace_name: Option<String>,
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<PtyScrollback, String> {
    let agent = normalize_agent(&agent);

    // Associate agent with workspace if provided
    if let Some(ws) = workspace_name {
        state
            .pty_workspaces
            .lock()
            .unwrap()
            .insert(agent.clone(), ws);
    } else {
        // Fallback to "Default" or based on CWD if possible
        let ws_name = cwd
            .as_ref()
            .and_then(|p| Path::new(p).file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("Default")
            .to_string();
        state
            .pty_workspaces
            .lock()
            .unwrap()
            .insert(agent.clone(), ws_name);
    }

    // Check if the process already exists, returning its scrollback if so.
    if state.pty_processes.lock().unwrap().contains_key(&agent) {
        let scrollbacks = state.pty_scrollbacks.lock().unwrap();
        if let Some(sb) = scrollbacks.get(&agent) {
            return Ok(PtyScrollback {
                data: String::from_utf8_lossy(sb).into_owned(),
                bytes: BASE64.encode(sb),
            });
        }
        return Ok(PtyScrollback {
            data: String::new(),
            bytes: String::new(),
        });
    }

    cleanup_pty(&agent, &state);

    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("{:?}", e))?;

    let shell = state.config.lock().unwrap().shell.clone();
    let mut cmd = CommandBuilder::new(&shell);
    configure_workspace(&mut cmd, &shell, cwd)?;
    cmd.env("AGENT_NAME", agent.clone());
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("{:?}", e))?;
    let pid = child.process_id();

    let master = pair.master;
    let writer = master.take_writer().map_err(|e| format!("{:?}", e))?;
    let mut reader = master.try_clone_reader().map_err(|e| format!("{:?}", e))?;

    state
        .pty_writers
        .lock()
        .unwrap()
        .insert(agent.clone(), writer);
    state
        .pty_resizers
        .lock()
        .unwrap()
        .insert(agent.clone(), master);
    state
        .pty_processes
        .lock()
        .unwrap()
        .insert(agent.clone(), PtyProcess { child, pid });
    state
        .pty_scrollbacks
        .lock()
        .unwrap()
        .insert(agent.clone(), Vec::new());

    let agent_clone = agent.clone();
    std::thread::spawn(move || {
        let mut buf = [0; PTY_READ_BUFFER_SIZE];
        let mut pending = Vec::new();
        while let Ok(n) = reader.read(&mut buf) {
            if n == 0 {
                break;
            }
            pending.extend_from_slice(&buf[..n]);

            let mut process_len = pending.len();
            match std::str::from_utf8(&pending) {
                Ok(_) => {}
                Err(e) => {
                    if e.error_len().is_none() {
                        // Incomplete multi-byte character at the end. 
                        // Wait for more data.
                        process_len = e.valid_up_to();
                    } else {
                        // Invalid sequence in the middle. 
                        // We emit up to the error, skip the bad byte(s) and continue.
                        process_len = e.valid_up_to();
                    }
                }
            }

            if process_len > 0 {
                let chunk: Vec<u8> = pending.drain(..process_len).collect();
                emit_pty_output(&app_handle, &agent_clone, chunk);
            }
        }

        if !pending.is_empty() {
            emit_pty_output(&app_handle, &agent_clone, pending);
        }

        if let Some(state) = app_handle.try_state::<AppState>() {
            if let Ok(mut writers) = state.pty_writers.lock() {
                writers.remove(&agent_clone);
            }
            if let Ok(mut resizers) = state.pty_resizers.lock() {
                resizers.remove(&agent_clone);
            }
            if let Ok(mut processes) = state.pty_processes.lock() {
                processes.remove(&agent_clone);
            }
            if let Ok(mut workspaces) = state.pty_workspaces.lock() {
                workspaces.remove(&agent_clone);
            }
        }

        #[derive(serde::Serialize, Clone)]
        struct PtyExitPayload {
            agent: String,
        }
        let payload = PtyExitPayload {
            agent: agent_clone.clone(),
        };
        let _ = app_handle.emit("pty-exit", payload.clone());
        let exit_event = format!("pty-exit-agent-{}", agent_event_key(&agent_clone));
        let _ = app_handle.emit(exit_event.as_str(), payload);
    });

    Ok(PtyScrollback {
        data: String::new(),
        bytes: String::new(),
    })
}

#[tauri::command]
pub fn write_pty(agent: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    if let Some(writer) = state.pty_writers.lock().unwrap().get_mut(&agent) {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_pty(agent: String, state: State<'_, AppState>) -> Result<(), String> {
    cleanup_pty(&agent, &state);
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    agent: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    if let Some(master) = state.pty_resizers.lock().unwrap().get_mut(&agent) {
        let _ = master.resize(PtySize {
            cols,
            rows,
            pixel_width: 0,
            pixel_height: 0,
        });
    }
    Ok(())
}

#[tauri::command]
pub fn get_process_stats(agent: String, state: State<'_, AppState>) -> Result<(f32, u64), String> {
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
pub fn get_project_context(cwd: Option<String>) -> Result<String, String> {
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
