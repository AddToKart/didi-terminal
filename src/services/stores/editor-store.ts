import { create } from 'zustand';
import type { EditorTab } from '@/types/editor.types';

interface EditorState {
  openTabs: EditorTab[];
  activeTabId: string | null;
  expandedDirs: Set<string>;
  editorRoot: string | null;

  setEditorRoot: (root: string | null) => void;
  openTab: (tab: EditorTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  markDirty: (tabId: string, content: string) => void;
  markClean: (tabId: string) => void;
  updateContent: (tabId: string, content: string) => void;
  toggleDir: (dirPath: string) => void;
  cycleTabForward: () => void;
  cycleTabBackward: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openTabs: [],
  activeTabId: null,
  expandedDirs: new Set(),
  editorRoot: null,

  setEditorRoot: (editorRoot) => set({ editorRoot }),

  openTab: (tab) => {
    const { openTabs } = get();
    const existing = openTabs.find((t) => t.filePath === tab.filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }
    set({ openTabs: [...openTabs, tab], activeTabId: tab.id });
  },

  closeTab: (tabId) => {
    const { openTabs, activeTabId } = get();
    const idx = openTabs.findIndex((t) => t.id === tabId);
    const next = openTabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      if (next.length === 0) {
        nextActiveId = null;
      } else if (idx > 0) {
        nextActiveId = next[idx - 1].id;
      } else {
        nextActiveId = next[0].id;
      }
    }
    set({ openTabs: next, activeTabId: nextActiveId });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  markDirty: (tabId, content) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === tabId ? { ...t, isDirty: true, content } : t
      ),
    })),

  markClean: (tabId) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === tabId ? { ...t, isDirty: false } : t
      ),
    })),

  updateContent: (tabId, content) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.id === tabId ? { ...t, content } : t
      ),
    })),

  toggleDir: (dirPath) =>
    set((state) => {
      const next = new Set(state.expandedDirs);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return { expandedDirs: next };
    }),

  cycleTabForward: () => {
    const { openTabs, activeTabId } = get();
    if (openTabs.length < 2) return;
    const idx = openTabs.findIndex((t) => t.id === activeTabId);
    const next = openTabs[(idx + 1) % openTabs.length];
    set({ activeTabId: next.id });
  },

  cycleTabBackward: () => {
    const { openTabs, activeTabId } = get();
    if (openTabs.length < 2) return;
    const idx = openTabs.findIndex((t) => t.id === activeTabId);
    const prev = openTabs[(idx - 1 + openTabs.length) % openTabs.length];
    set({ activeTabId: prev.id });
  },
}));
