use serde::{Deserialize, Serialize};
use std::process::Command;
use sysinfo::{Pid, System};

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
pub async fn kill_process(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
