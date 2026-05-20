# Project Overview

DidiTerminal is a high-performance, autonomous multi-agent orchestrator desktop application built with Tauri, React 19, and Rust.

The application manages multiple native pseudo-terminals (PTYs) and a CodeMirror-based editor, enabling seamless transitions between terminal orchestration and code authoring. It features a Windows named pipe IPC bus (`\\.\pipe\agentbus`) for asynchronous multi-agent collaboration and task delegation.

## Key Technologies
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (v3/v4), `xterm.js`, `CodeMirror 6`, `Zustand`.
- **Backend:** Tauri 2.0 (Rust), `portable-pty`, `tokio` (for async named pipe IPC), SQLite.
- **Persistence:** SQLite via `@tauri-apps/plugin-sql` for workspaces, settings, and task history.
- **Inference:** Local AI inference via bundled `llama-server` sidecar.

# Key Features

- **Four Primary Modes:**
  - **Terminal Mode:** Multi-agent PTY management with advanced layouts.
  - **Orchestrator Mode:** High-level view for agent network graph and long-term planning.
  - **Zen Mode:** Distraction-free, minimal environment for focused work.
  - **Editor Mode:** Full-screen CodeMirror 6 editor with pitch-black UI and terminal integration.
- **Workspace Hierarchy:** `Workspace` -> `Section` -> `Tab` -> `Agents`. Supports multiple tiled PTYs per Tab.
- **Merged Tabs:** Drag-and-drop tabs onto each other to create split views within a single workspace context.
- **Full-Screen Source Control:** Professional Git integration with Graph views, Branch management, and GitHub PR interactivity.
- **Developer Power-Tools:** Integrated panels for Port Forwarding, Docker Management, Environment Vault, WSL Distro spawner, and DB Viewing. Accessible via the minimalist `StatusBar`.
- **Master Plan Kanban:** Real-time synchronization between `MASTER_PLAN.md` and an interactive task board.
- **Time Machine (Git Snapshots):** Automated, non-invasive snapshots before every major agent delegation for safety and rollback.

# Building and Running

Managed via `package.json` scripts:
- **Development:** `npm run tauri dev`
- **Build:** `npm run tauri build`

# Architecture & Development Conventions

## State Management Strategy

The app has transitioned from monolithic state to a modular **Zustand + Specialized Hooks** architecture:
- **Stores (`src/services/stores/`):** Atomic Zustand stores for UI, Workspaces, Agents, Git, and Orchestration.
- **Domain Hooks (`src/services/`):** 
  - `use-workspace-crud.ts`: Logic for creating/renaming/deleting workspaces and sections.
  - `use-agent-ops.ts`: Terminal spawning, layout management, and agent lifecycle.
  - `use-app-effects.ts`: Collection of lifecycle hooks for persistence, event listeners, and background sync.

## Code Conventions

### Project Structure & Placement Rules

- **Frontend (`src/`):**
    - `components/`: Pure and semi-smart UI components.
        - **Sub-Component Pattern:** Large components should be split into `Component.tsx` (orchestration) and `component-components.tsx` (atomic parts).
        - `ui/`: shadcn/ui atoms.
        - `layout/`: App scaffolding (TopBar, SideBar, StatusBar).
        - `terminal/`: xterm.js and PTY logic.
        - `developer-tools/`: Specialized panels (Docker, Env, Ports).
        - `source-control/`: Git and GitHub UI.
    - `features/`: Mode-specific shells (ZenModeView, EditorShell, NonZenModeShell).
    - `services/`: Zustand stores, specialized hooks, and core logic.
    - `lib/`: High-performance utilities (Xterm write queue, layout math, glassmorphism).

### Aesthetic Standards

- **Pitch Black UI:** The app uses a pure black (`#000000`) background for the main canvas, editor, and terminals to maximize focus and OLED contrast.
- **Cybernetic Refinements:** Minimalist borders, subtle glassmorphism, and cyan/pink accents for technical clarity.
- **Minimalism:** Use the `StatusBar` for high-signal notifications and indicators rather than intrusive modals.

## Terminal & Agent Protocols

- **IPC Bus:** `\\.\pipe\agentbus` handles JSON handoffs.
- **Lane System:** Terminals use a "Lane" system (`terminal-lanes.ts`) for managing sub-pty instances and layouts.
- **Prompt Detection:** `app-core.ts` contains regex for detecting shell readiness across different platforms (PowerShell, WSL).

## MASTER_PLAN.md Conventions

- **Status Markers:** Tasks use `<!-- didi:status=... -->` comments (todo, in_queue, in_progress, waiting_completion, done).
- **HITL Marker:** Adding `<!-- didi:requires_approval -->` to a task line requires human confirmation before a completion callback is processed.
- **Agent Queue:** Top-level tasks in the `### Agent Queue` section are visible to the Kanban board.
