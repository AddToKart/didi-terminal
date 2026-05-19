use tauri::{Emitter, AppHandle};

pub fn emit_event<T: serde::Serialize>(app: &AppHandle, event: &str, payload: &T) {
    let _ = app.emit(event, payload);
}

pub fn emit_git_status_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "git-status-changed", &Payload { cwd });
}

pub fn emit_git_branch_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "git-branch-changed", &Payload { cwd });
}

pub fn emit_git_log_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "git-log-changed", &Payload { cwd });
}

pub fn emit_master_plan_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "master-plan-changed", &Payload { cwd });
}

pub fn emit_ports_changed(app: &AppHandle) {
    #[derive(serde::Serialize)]
    struct Payload;
    emit_event(app, "ports-changed", &Payload);
}

pub fn emit_code_review_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "code-review-changed", &Payload { cwd });
}

pub fn emit_env_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "env-changed", &Payload { cwd });
}

pub fn emit_file_system_changed(app: &AppHandle, cwd: &str) {
    #[derive(serde::Serialize)]
    struct Payload<'a> {
        cwd: &'a str,
    }
    emit_event(app, "file-system-changed", &Payload { cwd });
}
