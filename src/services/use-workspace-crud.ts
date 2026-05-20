import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { GitSnapshotRecord } from "../components/panels/SnapshotPanel";
import type { SectionState, TerminalTab, WorkspaceState } from "../types/workspace";
import { useWorkspaceStore } from "./stores/workspace-store";
import { useGitStore } from "./stores/git-store";
import { useUIStore } from "./stores/ui-store";

export type AddLogFn = (message: string, type?: "system" | "handoff") => void;

export function useWorkspaceCrud(addLog: AddLogFn) {
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore(s => s.activeWorkspaceId);
  const setWorkspaces = useWorkspaceStore(s => s.setWorkspaces);
  const setActiveWorkspaceId = useWorkspaceStore(s => s.setActiveWorkspaceId);
  const setPendingWorkspaceId = useUIStore(s => s.setPendingWorkspaceId);
  const setSnapshots = useGitStore(s => s.setSnapshots);
  const setSnapshotBusy = useGitStore(s => s.setSnapshotBusy);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const currentProject = activeWorkspace?.directory || null;
  const activeSection = activeWorkspace?.sections.find(s => s.id === activeWorkspace.activeSectionId) || activeWorkspace?.sections[0];
  const tabs = activeSection?.tabs || [];
  const activeTabId = activeSection?.activeTabId || activeWorkspace?.activeTabId || "";

  const setTabs = (val: TerminalTab[] | ((prev: TerminalTab[]) => TerminalTab[])) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const targetSectionId = w.activeSectionId || w.sections[0]?.id;
      const currentTabs = w.sections.find(s => s.id === targetSectionId)?.tabs || [];
      const nextTabs = typeof val === "function" ? val(currentTabs) : val;
      const sections = w.sections.map(s => s.id === targetSectionId ? { ...s, tabs: nextTabs } : s);
      if (sections.length === 0) {
        sections.push({ id: crypto.randomUUID(), name: "Section 1", tabs: nextTabs });
      }
      return { ...w, sections };
    }));
  };

  const setActiveTabIdLocal = (val: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== activeWorkspaceId) return w;
      const targetSectionId = w.activeSectionId || w.sections[0]?.id;
      const sections = w.sections.map(s => s.id === targetSectionId ? { ...s, activeTabId: val } : s);
      return { ...w, sections, activeTabId: val };
    }));
  };

  const refreshSnapshots = useCallback(async (project = currentProject) => {
    if (!project) {
      setSnapshots([]);
      return;
    }
    try {
      const records = await invoke<GitSnapshotRecord[]>("list_git_snapshots", { cwd: project });
      setSnapshots(records);
    } catch {
      setSnapshots([]);
    }
  }, [currentProject, setSnapshots]);

  const handleWorkspaceSelect = async (id: string) => {
    if (id === activeWorkspaceId) return;
    try {
      const isLocked = await invoke<boolean>("is_pin_enabled", { workspaceId: id });
      if (isLocked) {
        setPendingWorkspaceId(id);
      } else {
        setActiveWorkspaceId(id);
      }
    } catch {
      setActiveWorkspaceId(id);
    }
  };

  const handleWorkspaceReorder = (dragIndex: number, dropIndex: number) => {
    setWorkspaces(prev => {
      const next = [...prev];
      const [draggedWs] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, draggedWs);
      return next;
    });
  };

  const handleWorkspaceRename = (id: string, newName: string) => {
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: newName } : w));
  };

  const handleWorkspaceDelete = (id: string) => {
    const newWs = workspaces.filter(w => w.id !== id);
    if (newWs.length === 0) {
      const defaultSectionId = crypto.randomUUID();
      const emptyWs: WorkspaceState = {
        id: crypto.randomUUID(),
        name: "Workspace 1",
        directory: null,
        sections: [],
        activeTabId: "",
        activeSectionId: defaultSectionId,
      };
      setWorkspaces([emptyWs]);
      setActiveWorkspaceId(emptyWs.id);
    } else {
      setWorkspaces(newWs);
      if (activeWorkspaceId === id) setActiveWorkspaceId(newWs[0].id);
    }
  };

  const handleCreateWorkspace = () => {
    const defaultSectionId = crypto.randomUUID();
    const newWs: WorkspaceState = {
      id: crypto.randomUUID(),
      name: `Workspace ${workspaces.length + 1}`,
      directory: null,
      sections: [{ id: defaultSectionId, name: "Section 1", tabs: [] }],
      activeTabId: "",
      activeSectionId: defaultSectionId,
    };
    setWorkspaces([...workspaces, newWs]);
    setActiveWorkspaceId(newWs.id);
  };

  const handleSectionCreate = (workspaceId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      const newSection: SectionState = {
        id: crypto.randomUUID(),
        name: `Section ${w.sections.length + 1}`,
        tabs: [],
      };
      return { ...w, sections: [...w.sections, newSection] };
    }));
  };

  const handleSectionSelect = (workspaceId: string, sectionId: string) => {
    setActiveWorkspaceId(workspaceId);
    setWorkspaces(prev => prev.map(w => w.id === workspaceId ? { ...w, activeSectionId: sectionId } : w));
  };

  const handleSectionRename = (workspaceId: string, sectionId: string, newName: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      return {
        ...w,
        sections: w.sections.map(s => s.id === sectionId ? { ...s, name: newName } : s),
      };
    }));
  };

  const handleSectionDelete = (workspaceId: string, sectionId: string) => {
    setWorkspaces(prev => prev.map(w => {
      if (w.id !== workspaceId) return w;
      const newSections = w.sections.filter(s => s.id !== sectionId);
      if (newSections.length === 0) {
        newSections.push({ id: crypto.randomUUID(), name: "Section 1", tabs: [] });
      }
      return { ...w, sections: newSections };
    }));
  };

  const handleOpenDirectory = async (id: string) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, directory: selected as string } : w));
      addLog(`Opened workspace directory: ${selected}`, "system");
    }
  };

  const handleInitialize = async () => {
    if (!currentProject) return;
    try {
      await invoke("initialize_project", { cwd: currentProject });
      addLog("Project initialized for Didi orchestration.", "system");
    } catch (err) {
      addLog(`Init failed: ${err}`, "system");
    }
  };

  const handleManualSnapshot = async () => {
    if (!currentProject) return;
    setSnapshotBusy(true);
    try {
      const snapshot = await invoke<GitSnapshotRecord>("create_git_snapshot", {
        cwd: currentProject,
        taskId: `manual-${Date.now()}`,
        label: "Manual checkpoint",
        agent: "Manual",
      });
      setSnapshots(prev => [snapshot, ...prev.filter(item => item.id !== snapshot.id)].slice(0, 40));
      addLog(`Manual snapshot ${snapshot.commit.slice(0, 8)} created`, "system");
    } catch (err) {
      addLog(`Manual snapshot failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleRewindSnapshot = async (snapshot: GitSnapshotRecord) => {
    if (!currentProject) return;
    const confirmed = window.confirm(`Rewind workspace files to snapshot ${snapshot.commit.slice(0, 8)}? This will overwrite current working tree changes.`);
    if (!confirmed) return;
    setSnapshotBusy(true);
    try {
      await invoke("rewind_git_snapshot", { cwd: currentProject, commit: snapshot.commit });
      addLog(`Rewound workspace to ${snapshot.commit.slice(0, 8)}`, "system");
      await refreshSnapshots(currentProject);
    } catch (err) {
      addLog(`Rewind failed: ${err}`, "system");
    } finally {
      setSnapshotBusy(false);
    }
  };

  const handleTabCreate = () => {
    const newTab: TerminalTab = {
      id: crypto.randomUUID(),
      name: `Tab ${tabs.length + 1}`,
      agents: [],
      layoutOrientation: "horizontal",
    };
    setTabs([...tabs, newTab]);
    setActiveTabIdLocal(newTab.id);
  };

  const handleTabSelect = (id: string) => {
    setActiveTabIdLocal(id);
  };

  const handleTabRename = (id: string, newName: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleTabClose = (id: string) => {
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      const fallbackTab: TerminalTab = {
        id: crypto.randomUUID(),
        name: "Tab 1",
        agents: [],
        layoutOrientation: "horizontal",
      };
      setTabs([fallbackTab]);
      setActiveTabIdLocal(fallbackTab.id);
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabIdLocal(newTabs[newTabs.length - 1].id);
    }
  };

  const handleTabReorder = (oldIndex: number, newIndex: number) => {
    setTabs(prev => {
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  return {
    refreshSnapshots,
    handleWorkspaceSelect,
    handleWorkspaceReorder,
    handleWorkspaceRename,
    handleWorkspaceDelete,
    handleCreateWorkspace,
    handleSectionCreate,
    handleSectionSelect,
    handleSectionRename,
    handleSectionDelete,
    handleOpenDirectory,
    handleInitialize,
    handleManualSnapshot,
    handleRewindSnapshot,
    handleTabCreate,
    handleTabSelect,
    handleTabRename,
    handleTabClose,
    handleTabReorder,
  };
}
