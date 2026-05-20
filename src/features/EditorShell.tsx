import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { lazy, Suspense } from "react";
import { Code2, FileCode2 } from "lucide-react";
import { EditorTopbar } from "@/components/layout/EditorTopbar";
import { EditorSidebar } from "@/components/layout/EditorSidebar";
import { EditorTabBar } from "@/components/layout/EditorTabBar";
import { CodeMirrorEditor } from "@/components/editor/CodeMirrorEditor";
import { QuickOpenModal } from "@/components/modals/QuickOpenModal";
import { useEditorStore } from "@/services/stores/editor-store";
import { useUIController } from "@/services/useUIController";
import { useWorkspaceController } from "@/services/useWorkspaceController";

// Lazy-load the terminal pane since it spawns a PTY
const EditorTerminalPane = lazy(() =>
  import("@/components/editor/EditorTerminalPane").then((m) => ({
    default: m.EditorTerminalPane,
  }))
);

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function EditorShell() {
  const ui = useUIController();
  const ws = useWorkspaceController();
  const { appMode, setAppMode } = ui;
  const { currentProject } = ws;
  const prevModeRef = useRef<"terminal" | "orchestrator" | "zen">("terminal");

  const {
    openTabs,
    activeTabId,
    editorRoot,
    setEditorRoot,
    closeTab,
    setActiveTab,
    markDirty,
    markClean,
    cycleTabForward,
    cycleTabBackward,
  } = useEditorStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Track previous mode for back button
  useEffect(() => {
    if (appMode !== "editor") {
      prevModeRef.current = appMode as "terminal" | "orchestrator" | "zen";
    }
  }, [appMode]);

  // Set editor root from current project
  useEffect(() => {
    if (currentProject && editorRoot !== currentProject) {
      setEditorRoot(currentProject);
    }
  }, [currentProject, editorRoot, setEditorRoot]);

  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null;
  const dirtyCount = openTabs.filter((t) => t.isDirty).length;

  // Save a specific tab
  const saveTab = useCallback(
    async (tabId: string) => {
      const tab = openTabs.find((t) => t.id === tabId);
      if (!tab || !editorRoot) return;
      try {
        await invoke("write_file_content", {
          path: tab.filePath,
          root: editorRoot,
          content: tab.content,
        });
        markClean(tabId);
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    },
    [openTabs, editorRoot, markClean]
  );

  // Save active tab
  const handleSave = useCallback(() => {
    if (activeTabId) saveTab(activeTabId);
  }, [activeTabId, saveTab]);

  // Save all dirty tabs
  const handleSaveAll = useCallback(() => {
    openTabs.filter((t) => t.isDirty).forEach((t) => saveTab(t.id));
  }, [openTabs, saveTab]);

  // Handle content change with auto-save debounce
  const handleContentChange = useCallback(
    (tabId: string, value: string) => {
      markDirty(tabId, value);
      if (autosaveTimers.current[tabId]) {
        clearTimeout(autosaveTimers.current[tabId]);
      }
      autosaveTimers.current[tabId] = setTimeout(() => {
        saveTab(tabId);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [markDirty, saveTab]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAll();
        } else {
          handleSave();
        }
      }
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((v) => !v);
      }
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        setIsQuickOpenVisible(true);
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          cycleTabBackward();
        } else {
          cycleTabForward();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, handleSaveAll, cycleTabForward, cycleTabBackward]);

  const handleGoBack = useCallback(() => {
    setAppMode(prevModeRef.current);
  }, [setAppMode]);

  const root = editorRoot ?? currentProject ?? "";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#09090b] overflow-hidden">
      {/* Editor Topbar */}
      <EditorTopbar
        prevMode={prevModeRef.current}
        isSidebarOpen={isSidebarOpen}
        isTerminalOpen={isTerminalOpen}
        isDirtyCount={dirtyCount}
        onGoBack={handleGoBack}
        onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        onToggleTerminal={() => setIsTerminalOpen((v) => !v)}
        onSave={handleSave}
        onSaveAll={handleSaveAll}
        onQuickOpen={() => setIsQuickOpenVisible(true)}
      />

      <QuickOpenModal
        isOpen={isQuickOpenVisible}
        onClose={() => setIsQuickOpenVisible(false)}
        root={root}
      />

      {/* Main body: sidebar + editor area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* File Tree Sidebar */}
        {isSidebarOpen && root && (
          <div className="w-[220px] shrink-0 overflow-hidden">
            <EditorSidebar root={root} />
          </div>
        )}

        {/* Editor + Terminal vertical split */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {openTabs.length === 0 ? (
            // Empty state
            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-30">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                <Code2 size={40} className="text-sky-400/60" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-300">No file open</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {root
                    ? "Click a file in the explorer to open it"
                    : "Open a project directory to get started"}
                </p>
              </div>
              {!root && (
                <p className="text-[11px] text-zinc-700">
                  Select a workspace with a directory set in the sidebar
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Editor area */}
              <div
                className="flex flex-col min-h-0"
                style={{ flex: isTerminalOpen ? "0 0 65%" : "1 1 auto" }}
              >
                {/* Tab Bar */}
                <EditorTabBar
                  tabs={openTabs}
                  activeTabId={activeTabId}
                  onSelectTab={setActiveTab}
                  onCloseTab={closeTab}
                />

                {/* Editor instances — all mounted, inactive ones use display:none */}
                <div className="flex-1 overflow-hidden relative">
                  {openTabs.map((tab) => (
                    <div
                      key={tab.id}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: tab.id === activeTabId ? "flex" : "none",
                      }}
                    >
                      <CodeMirrorEditor
                        tabId={tab.id}
                        filePath={tab.filePath}
                        language={tab.language}
                        content={tab.content}
                        isActive={tab.id === activeTabId}
                        onContentChange={handleContentChange}
                      />
                    </div>
                  ))}
                </div>

                {/* Status bar — file info */}
                {activeTab && (
                  <div className="h-5 bg-black border-t border-zinc-800 flex items-center gap-3 px-3 text-[10px] font-mono text-zinc-600 shrink-0">
                    <span className="flex items-center gap-1">
                      <FileCode2 size={10} />
                      {activeTab.language}
                    </span>
                    <span>·</span>
                    <span className="truncate max-w-[300px]">{activeTab.filePath}</span>
                    {activeTab.isDirty && (
                      <>
                        <span>·</span>
                        <span className="text-sky-500">Modified</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Terminal pane */}
              {isTerminalOpen && (
                <div className="flex flex-col" style={{ flex: "0 0 35%" }}>
                  <Suspense fallback={null}>
                    <EditorTerminalPane
                      cwd={root || null}
                      onClose={() => setIsTerminalOpen(false)}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
