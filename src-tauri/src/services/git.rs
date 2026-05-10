use tauri::AppHandle;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use std::hash::{DefaultHasher, Hash, Hasher};

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitSnapshot {
    pub id: String,
    pub commit: String,
    pub cwd: String,
    pub task_id: String,
    pub label: String,
    pub agent: String,
    pub created_at: u64,
}

pub fn workspace_hash(cwd: &str) -> String {
    let mut hasher = DefaultHasher::new();
    cwd.to_lowercase().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

pub fn snapshots_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let app_data_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data_dir.join("snapshots");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

pub fn snapshots_file(app_handle: &AppHandle, cwd: &str) -> Result<PathBuf, String> {
    Ok(snapshots_dir(app_handle)?.join(format!("{}.json", workspace_hash(cwd))))
}

pub fn read_snapshots(app_handle: &AppHandle, cwd: &str) -> Vec<GitSnapshot> {
    let Ok(path) = snapshots_file(app_handle, cwd) else {
        return Vec::new();
    };

    std::fs::read_to_string(path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default()
}

pub fn write_snapshots(app_handle: &AppHandle, cwd: &str, snapshots: &[GitSnapshot]) -> Result<(), String> {
    let path = snapshots_file(app_handle, cwd)?;
    let json = serde_json::to_string_pretty(snapshots).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

pub fn run_git(cwd: &Path, args: &[&str], index_file: Option<&Path>) -> Result<String, String> {
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

pub fn ensure_git_repo(cwd: &Path) -> Result<(), String> {
    run_git(cwd, &["rev-parse", "--is-inside-work-tree"], None)
        .and_then(|value| {
            if value == "true" {
                Ok(())
            } else {
                Err("Selected workspace is not inside a Git work tree.".to_string())
            }
        })
}

#[tauri::command]
pub fn create_git_snapshot(
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

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileDiff {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    pub patch: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResponse {
    pub branch: String,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub files: Vec<GitFileDiff>,
}

#[tauri::command]
pub fn get_git_diff(cwd: String) -> Result<String, String> {
    let cwd_path = Path::new(&cwd);
    ensure_git_repo(cwd_path)?;
    
    let status = run_git(cwd_path, &["status", "--short"], None)?;
    let diff = run_git(cwd_path, &["diff", "HEAD"], None)?;
    
    let mut result = String::new();
    if !status.is_empty() {
        result.push_str("### STATUS ###\n");
        result.push_str(&status);
        result.push_str("\n\n");
    }
    if !diff.is_empty() {
        result.push_str("### DIFF ###\n");
        result.push_str(&diff);
    }
    
    if result.is_empty() {
        Ok("No changes detected.".to_string())
    } else {
        Ok(result)
    }
}

#[tauri::command]
pub fn get_git_branch(cwd: String) -> Result<String, String> {
    let cwd_path = Path::new(&cwd);
    match run_git(cwd_path, &["branch", "--show-current"], None) {
        Ok(branch) if !branch.trim().is_empty() => Ok(branch.trim().to_string()),
        _ => Err("Not a git repository or no branch".into()),
    }
}

#[tauri::command]
pub fn get_git_status_structured(cwd: String) -> Result<GitStatusResponse, String> {
    let cwd_path = Path::new(&cwd);
    ensure_git_repo(cwd_path)?;

    let status_out = run_git(cwd_path, &["status", "--porcelain"], None)?;
    let numstat_out = run_git(cwd_path, &["diff", "HEAD", "--numstat"], None).unwrap_or_default();
    
    let branch = run_git(cwd_path, &["branch", "--show-current"], None).unwrap_or_else(|_| "main".to_string());
    
    let mut files = Vec::new();
    let mut total_additions = 0;
    let mut total_deletions = 0;

    // Parse status
    let mut file_statuses = std::collections::HashMap::new();
    for line in status_out.lines() {
        if line.len() > 3 {
            let status = line[0..2].trim().to_string();
            let path = line[3..].trim().to_string();
            file_statuses.insert(path, status);
        }
    }

    // Parse numstat
    let mut file_stats = std::collections::HashMap::new();
    for line in numstat_out.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let add = parts[0].parse::<usize>().unwrap_or(0);
            let del = parts[1].parse::<usize>().unwrap_or(0);
            let path = parts[2..].join(" ");
            file_stats.insert(path, (add, del));
        }
    }

    // Fetch patches
    for (path, status) in file_statuses {
        let (mut additions, deletions) = file_stats.get(&path).cloned().unwrap_or((0, 0));

        // For untracked files or deleted files, diff HEAD might not work or give full context.
        // We'll try to get the diff for the specific file.
        // If it's untracked (??), diff won't show it unless we add it to index, or we just read it.
        let patch = if status == "??" {
            let full_path = cwd_path.join(&path);
            if let Ok(content) = std::fs::read_to_string(&full_path) {
                // Mock a diff patch for untracked files
                let lines = content.lines().count();
                additions = lines;
                let mut mock_patch = format!("--- /dev/null\n+++ b/{}\n@@ -0,0 +1,{} @@\n", path, lines);
                for line in content.lines() {
                    mock_patch.push_str("+");
                    mock_patch.push_str(line);
                    mock_patch.push('\n');
                }
                mock_patch
            } else {
                "Binary file or unreadable".to_string()
            }
        } else {
            run_git(cwd_path, &["diff", "HEAD", "--", &path], None).unwrap_or_default()
        };

        total_additions += additions;
        total_deletions += deletions;

        files.push(GitFileDiff {
            path,
            status,
            additions,
            deletions,
            patch,
        });
    }

    // Sort files alphabetically
    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(GitStatusResponse {
        branch,
        total_additions,
        total_deletions,
        files,
    })
}

#[tauri::command]
pub fn list_git_snapshots(cwd: String, app_handle: AppHandle) -> Result<Vec<GitSnapshot>, String> {
    Ok(read_snapshots(&app_handle, &cwd))
}

#[tauri::command]
pub fn rewind_git_snapshot(cwd: String, commit: String) -> Result<String, String> {
    let cwd_path = Path::new(&cwd);
    ensure_git_repo(cwd_path)?;
    let repo_root = run_git(cwd_path, &["rev-parse", "--show-toplevel"], None)?;
    let repo_path = PathBuf::from(repo_root);

    run_git(&repo_path, &["cat-file", "-e", &format!("{}^{{commit}}", commit)], None)?;
    run_git(&repo_path, &["read-tree", "--reset", "-u", &commit], None)?;
    run_git(&repo_path, &["clean", "-fd"], None)?;

    Ok(format!("Workspace restored to snapshot {}", commit))
}
