use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub state: String,
    pub status: String,
    pub image: String,
    pub ports: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContainerStats {
    pub id: String,
    pub cpu_perc: String,
    pub mem_usage: String,
    pub mem_perc: String,
}

#[tauri::command]
pub async fn get_docker_containers() -> Result<Vec<ContainerInfo>, String> {
    let mut cmd = Command::new("docker");
    cmd.args(["ps", "-a", "--format", "{{.ID}}::{{.Names}}::{{.State}}::{{.Status}}::{{.Image}}::{{.Ports}}"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute docker: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut containers = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split("::").collect();
        if parts.len() >= 5 {
            let id = parts[0].to_string();
            let name = parts[1].to_string();
            let state = parts[2].to_string();
            let status = parts[3].to_string();
            let image = parts[4].to_string();
            let ports = if parts.len() >= 6 { parts[5].to_string() } else { "".to_string() };

            containers.push(ContainerInfo {
                id,
                name,
                state,
                status,
                image,
                ports,
            });
        }
    }

    Ok(containers)
}

#[tauri::command]
pub async fn get_docker_stats() -> Result<Vec<ContainerStats>, String> {
    let mut cmd = Command::new("docker");
    cmd.args(["stats", "--no-stream", "--format", "{{.ID}}::{{.CPUPerc}}::{{.MemUsage}}::{{.MemPerc}}"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute docker: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker stats error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut stats = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split("::").collect();
        if parts.len() >= 4 {
            let id = parts[0].to_string();
            let cpu_perc = parts[1].to_string();
            let mem_usage = parts[2].to_string();
            let mem_perc = parts[3].to_string();

            stats.push(ContainerStats {
                id,
                cpu_perc,
                mem_usage,
                mem_perc,
            });
        }
    }

    Ok(stats)
}

#[tauri::command]
pub async fn control_container(id: String, action: String) -> Result<(), String> {
    let mut cmd = Command::new("docker");
    
    match action.as_str() {
        "start" => { cmd.args(["start", &id]); }
        "stop" => { cmd.args(["stop", &id]); }
        "restart" => { cmd.args(["restart", &id]); }
        "pause" => { cmd.args(["pause", &id]); }
        "unpause" => { cmd.args(["unpause", &id]); }
        "remove" => { cmd.args(["rm", "-f", &id]); }
        _ => return Err(format!("Unknown container action: {}", action)),
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute docker: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Docker action error: {}", stderr.trim()));
    }

    Ok(())
}
