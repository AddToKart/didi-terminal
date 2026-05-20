import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceState } from "../types/workspace";

export interface PersonalTask {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  order_index: number;
  created_at: number;
}

export async function loadWorkspaces(): Promise<WorkspaceState[]> {
  return await invoke<WorkspaceState[]>("load_workspaces");
}

let isSaving = false;
let pendingWorkspaces: WorkspaceState[] | null = null;

export async function saveWorkspaces(workspaces: WorkspaceState[]): Promise<void> {
  if (isSaving) {
    pendingWorkspaces = workspaces;
    return;
  }

  isSaving = true;
  let currentWorkspaces = workspaces;

  while (true) {
    try {
      await invoke("save_workspaces", { workspaces: currentWorkspaces });
    } catch (error) {
      console.error("Failed to save workspaces to DB:", error);
    }

    if (pendingWorkspaces) {
      currentWorkspaces = pendingWorkspaces;
      pendingWorkspaces = null;
    } else {
      break;
    }
  }

  isSaving = false;
}

export async function getSetting(key: string): Promise<string | null> {
  return await invoke<string | null>("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  await invoke("set_setting", { key, value });
}

export async function loadPersonalTasks(workspaceId: string): Promise<PersonalTask[]> {
  return await invoke<PersonalTask[]>("load_personal_tasks", { workspaceId });
}

export async function savePersonalTask(task: PersonalTask): Promise<void> {
  await invoke("save_personal_task", { task });
}

export async function updatePersonalTaskStatus(id: string, status: string): Promise<void> {
  await invoke("update_personal_task_status", { id, status });
}

export async function updatePersonalTasksOrder(tasks: PersonalTask[]): Promise<void> {
  await invoke("update_personal_tasks_order", { tasks });
}

export async function deletePersonalTask(id: string): Promise<void> {
  await invoke("delete_personal_task", { id });
}
