use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::{Pid, System};
use tauri::AppHandle;
use std::sync::{OnceLock, Mutex};
use std::collections::HashMap;
use tokio::process::Child;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::time::{timeout, Duration};
use tokio::process::Command as TokioCommand;

use super::events;

static ACTIVE_TUNNELS: OnceLock<Mutex<HashMap<u16, (Child, String)>>> = OnceLock::new();

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortInfo {
    pub port: u16,
    pub pid: u32,
    pub process_name: String,
    pub state: String,
}

#[tauri::command]
pub async fn get_active_ports() -> Result<Vec<PortInfo>, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    // On Windows, use netstat -ano to get port-to-pid mapping
    let output = Command::new("netstat")
        .args(["-ano", "-p", "tcp"])
        .output()
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut ports = Vec::new();

    // Skip header lines
    for line in stdout.lines().skip(4) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 5 {
            let local_addr = parts[1];
            let state = parts[3];
            let pid_str = parts[4];

            // Only care about LISTENING ports
            if state != "LISTENING" {
                continue;
            }

            // Parse port from local_addr (e.g., 0.0.0.0:3000 or [::]:3000)
            if let Some(port_idx) = local_addr.rfind(':') {
                if let Ok(port) = local_addr[port_idx + 1..].parse::<u16>() {
                    if let Ok(pid_val) = pid_str.parse::<u32>() {
                        // Find process name using sysinfo
                        let process_name = sys.process(Pid::from(pid_val as usize))
                            .map(|p| p.name().to_string_lossy().into_owned())
                            .unwrap_or_else(|| "Unknown".to_string());

                        ports.push(PortInfo {
                            port,
                            pid: pid_val,
                            process_name,
                            state: state.to_string(),
                        });
                    }
                }
            }
        }
    }

    // Sort by port number
    ports.sort_by_key(|p| p.port);
    
    // De-duplicate (sometimes netstat shows 0.0.0.0 and [::] for same port)
    ports.dedup_by_key(|p| p.port);

    Ok(ports)
}

#[tauri::command]
pub async fn kill_process(pid: u32, app: AppHandle) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        events::emit_ports_changed(&app);
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn start_port_tunnel(port: u16, app: AppHandle) -> Result<String, String> {
    // If already running, kill the old one
    let old_child = {
        let mut tunnels = ACTIVE_TUNNELS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap();
        tunnels.remove(&port).map(|(child, _)| child)
    };
    if let Some(mut child) = old_child {
        let _ = child.kill().await;
    }

    #[cfg(target_os = "windows")]
    let mut child = TokioCommand::new("cmd")
        .args(["/C", "npx", "-y", "localtunnel", "--port", &port.to_string()])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn localtunnel: {}", e))?;

    #[cfg(not(target_os = "windows"))]
    let mut child = TokioCommand::new("npx")
        .args(["-y", "localtunnel", "--port", &port.to_string()])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn localtunnel: {}", e))?;

    let stdout = child.stdout.take().ok_or_else(|| "Failed to capture stdout".to_string())?;
    let mut reader = BufReader::new(stdout);

    // Read lines for up to 10 seconds to locate the URL
    let read_future = async {
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.starts_with("your url is:") {
                        let parts: Vec<&str> = trimmed.split("your url is:").collect();
                        if parts.len() > 1 {
                            return Ok(parts[1].trim().to_string());
                        }
                    }
                }
                Err(e) => return Err(e.to_string()),
            }
        }
        Err("localtunnel exited before URL was generated".to_string())
    };

    match timeout(Duration::from_secs(10), read_future).await {
        Ok(result) => {
            let extracted_url = result?;
            // Now store child and url in map
            let mut tunnels = ACTIVE_TUNNELS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap();
            tunnels.insert(port, (child, extracted_url.clone()));
            events::emit_ports_changed(&app);
            Ok(extracted_url)
        }
        Err(_) => {
            // Timeout! Kill the process
            let _ = child.kill().await;
            Err("Timed out waiting for localtunnel public URL".to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_port_tunnel(port: u16, app: AppHandle) -> Result<(), String> {
    let old_child = {
        let mut tunnels = ACTIVE_TUNNELS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap();
        tunnels.remove(&port).map(|(child, _)| child)
    };
    if let Some(mut child) = old_child {
        let _ = child.kill().await;
    }
    events::emit_ports_changed(&app);
    Ok(())
}

#[tauri::command]
pub async fn get_active_tunnels() -> Result<HashMap<u16, String>, String> {
    let mut tunnels = ACTIVE_TUNNELS.get_or_init(|| Mutex::new(HashMap::new())).lock().unwrap();
    let mut inactive = Vec::new();
    for (port, (child, _)) in tunnels.iter_mut() {
        match child.try_wait() {
            Ok(Some(_status)) => {
                inactive.push(*port);
            }
            Ok(None) => {}
            Err(_) => {
                inactive.push(*port);
            }
        }
    }
    for port in inactive {
        tunnels.remove(&port);
    }
    
    let mut active_map = HashMap::new();
    for (port, (_, url)) in tunnels.iter() {
        active_map.insert(*port, url.clone());
    }
    Ok(active_map)
}

