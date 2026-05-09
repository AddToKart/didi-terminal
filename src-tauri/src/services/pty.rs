use tauri::{AppHandle, Emitter, State};
use portable_pty::{Child, CommandBuilder, NativePtySystem, PtySize, PtySystem};

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::AppState;

pub struct PtyProcess {
    pub child: Box<dyn Child + Send + Sync>,
    pub pid: Option<u32>,
}

pub fn normalize_agent(agent: &str) -> String {
    agent.trim().to_lowercase()
}

pub fn cleanup_pty(agent: &str, state: &State<'_, AppState>) {
    let agent_key = normalize_agent(agent);
    state.pty_writers.lock().unwrap().remove(&agent_key);
    state.pty_resizers.lock().unwrap().remove(&agent_key);

    if let Some(mut process) = state.pty_processes.lock().unwrap().remove(&agent_key) {
        let _ = process.child.kill();
    }
}

pub fn configure_workspace(cmd: &mut CommandBuilder, shell: &str, cwd: Option<String>) -> Result<(), String> {
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
pub fn spawn_pty(agent: String, cwd: Option<String>, app_handle: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
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
pub fn write_pty(agent: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    if let Some(writer) = state.pty_writers.lock().unwrap().get_mut(&agent) {
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
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
pub fn resize_pty(agent: String, cols: u16, rows: u16, state: State<'_, AppState>) -> Result<(), String> {
    let agent = normalize_agent(&agent);
    if let Some(master) = state.pty_resizers.lock().unwrap().get_mut(&agent) {
        let _ = master.resize(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 });
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
