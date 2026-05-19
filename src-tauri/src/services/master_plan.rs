use std::io::Write;
use std::path::Path;
use tauri::AppHandle;

use super::events;

fn strip_didi_status_marker(value: &str) -> String {
    let Some(start) = value.find("<!--") else {
        return value.trim_end().to_string();
    };
    let Some(end_offset) = value[start..].find("-->") else {
        return value.trim_end().to_string();
    };

    let marker = &value[start..start + end_offset + 3];
    if !marker.contains("didi:status=") {
        return value.trim_end().to_string();
    }

    format!("{}{}", &value[..start], &value[start + end_offset + 3..])
        .trim_end()
        .to_string()
}

#[tauri::command]
pub fn append_master_plan_entry(cwd: String, title: String, body: String, app: AppHandle) -> Result<(), String> {
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

    events::emit_master_plan_changed(&app, &cwd);
    Ok(())
}

#[tauri::command]
pub fn read_master_plan(cwd: String) -> Result<String, String> {
    let plan_path = Path::new(&cwd).join("MASTER_PLAN.md");
    if !plan_path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(plan_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_master_plan_task_status(cwd: String, line: usize, status: String, app: AppHandle) -> Result<String, String> {
    let plan_path = Path::new(&cwd).join("MASTER_PLAN.md");
    let contents = if plan_path.exists() {
        std::fs::read_to_string(&plan_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };

    let mut lines: Vec<String> = contents.lines().map(|item| item.to_string()).collect();
    if line >= lines.len() {
        return Err("Task line no longer exists in MASTER_PLAN.md.".to_string());
    }

    let current_line = &lines[line];
    let Some(box_start) = current_line.find("- [") else {
        return Err("Selected line is not a markdown task.".to_string());
    };
    let box_char = box_start + 3;
    if current_line.as_bytes().get(box_char + 1) != Some(&b']') {
        return Err("Selected line is not a markdown task.".to_string());
    }

    let mut next_line = current_line.clone();
    let checkbox = if status == "done" { "x" } else { " " };
    next_line.replace_range(box_char..box_char + 1, checkbox);
    next_line = strip_didi_status_marker(&next_line);
    if status == "in_progress" {
        next_line.push_str(" <!-- didi:status=in_progress -->");
    }

    lines[line] = next_line;
    let updated = lines.join("\n");
    std::fs::write(&plan_path, &updated).map_err(|e| e.to_string())?;
    events::emit_master_plan_changed(&app, &cwd);
    Ok(updated)
}

#[tauri::command]
pub fn set_master_plan_task_status_by_text(cwd: String, text: String, status: String, app: AppHandle) -> Result<String, String> {
    let plan_path = Path::new(&cwd).join("MASTER_PLAN.md");
    let contents = if plan_path.exists() {
        std::fs::read_to_string(&plan_path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };
    let clean_text = text.trim();
    let Some(line) = contents
        .lines()
        .position(|item| item.contains("- [") && strip_didi_status_marker(item).contains(clean_text))
    else {
        return Err("Could not find matching task in MASTER_PLAN.md.".to_string());
    };

    set_master_plan_task_status(cwd, line, status, app)
}

#[tauri::command]
pub fn append_master_plan_task(cwd: String, text: String, status: String, app: AppHandle) -> Result<String, String> {
    let plan_path = Path::new(&cwd).join("MASTER_PLAN.md");
    let clean_text = text.trim();
    if clean_text.is_empty() {
        return Err("Task text cannot be empty.".to_string());
    }

    let mut contents = if plan_path.exists() {
        std::fs::read_to_string(&plan_path).map_err(|e| e.to_string())?
    } else {
        "# Project Master Plan\n\n### Tasks\n".to_string()
    };

    if !contents.contains("### Tasks") && !contents.contains("## Tasks") {
        if !contents.ends_with('\n') {
            contents.push('\n');
        }
        contents.push_str("\n### Tasks\n");
    }

    let checkbox = if status == "done" { "x" } else { " " };
    let marker = if status == "in_progress" {
        " <!-- didi:status=in_progress -->"
    } else {
        ""
    };
    let task_line = format!("- [{}] {}{}", checkbox, clean_text, marker);

    let lines: Vec<&str> = contents.lines().collect();
    let mut insert_at = lines.len();
    if let Some(tasks_index) = lines.iter().position(|line| {
        let trimmed = line.trim();
        trimmed == "### Tasks" || trimmed == "## Tasks"
    }) {
        insert_at = tasks_index + 1;
        while insert_at < lines.len() && !lines[insert_at].trim_start().starts_with('#') {
            insert_at += 1;
        }
    }

    let mut updated_lines: Vec<String> = lines.iter().map(|line| line.to_string()).collect();
    updated_lines.insert(insert_at, task_line);
    let updated = updated_lines.join("\n");
    std::fs::write(&plan_path, &updated).map_err(|e| e.to_string())?;
    events::emit_master_plan_changed(&app, &cwd);
    Ok(updated)
}
