# Project Overview

DidiTerminal is an autonomous multi-agent orchestrator desktop application built with Tauri, React, TypeScript, and Vite. 

The application manages multiple native pseudo-terminals (PTYs) running PowerShell, rendered via `xterm.js`. It enables asynchronous multi-agent collaboration via a Windows named pipe IPC bus (`\\.\pipe\agentbus`), allowing agents to delegate tasks to one another.

## Key Technologies
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, `xterm.js`, `react-resizable-panels`, `@xyflow/react`.
- **Backend:** Tauri 2.0 (Rust), `portable-pty`, `tokio` (for async named pipe IPC).
- **Persistence:** SQLite via `@tauri-apps/plugin-sql` for workspaces, settings, and personal tasks.
- **Inference:** Local AI inference via a bundled `llama-server` sidecar binary.

# Key Features

- **Multi-Workspace Hierarchy:** Organizes work into Workspaces, Sections, and Tabs. Each Tab can host multiple tiled agent PTYs.
- **Master Plan Kanban:** An interactive board synchronized with `MASTER_PLAN.md`. Supports automated task dispatching, status updates, and subtask tracking.
- **Dynamic Layout Engine:** Supports Vertical, Horizontal, Grid, and specialized layouts (Waterfall, Canvas, Focus) for terminal instances.
- **Zen Mode:** A minimal, distraction-free environment for deep work, accessible via hotkeys.
- **Agent Network Graph:** Real-time visualization of agent relationships and handoff flows using `@xyflow/react`.
- **Sentinel Monitoring:** An autonomous watchdog service that monitors agent PTYs for loops and repeated failures, intervening when necessary.
- **Git Snapshots (Time Machine):** Automatic, non-invasive git snapshots created before each task delegation, providing a safety net for the workspace.
- **Human-In-The-Loop (HITL):** Optional human approval for task completions triggered by specific markdown markers.

# Building and Running

Managed via `package.json` scripts:

- **Development Mode:** `npm run tauri dev`
- **Production Build:** `npm run tauri build`

# Architecture & Development Conventions

## Multi-Agent Collaboration Protocol

1.  **Initialization:** `initialize_project` scaffolds a `.didi/` directory.
2.  **IPC Bus:** A Rust background task (`bus.rs`) listens on `\\.\pipe\agentbus` for JSON payloads.
3.  **Delegation:** Agents write JSON to the pipe. Rust emits `agent-handoff` to the frontend.
4.  **Enrichment:** `handoff-service.ts` injects workspace context and rules into delegated tasks.
5.  **Queueing:** `handoff-queue-service.ts` manages tasks when agents are busy.
6.  **Execution:** The frontend writes the task to the target agent's PTY once it detects a shell prompt.

## Code Conventions

### Project Structure & Placement Rules

Adhere strictly to this granular directory structure to maintain architectural integrity:

- **Frontend (`src/`):**
    - `components/`: Domain-specific UI logic, further subdivided:
        - `ui/`: Low-level, reusable atomic components (buttons, inputs, cards, dropdowns). Usually shadcn/ui.
        - `layout/`: High-level app scaffolding (TopBar, SideBar, Tab navigation, Orchestrator layout).
        - `terminal/`: Core terminal logic (xterm.js instances, PTY output handling, browser instances).
        - `workspace/`: Project management tools (Kanban boards, File Explorers, Security/PIN panels).
        - `panels/`: Informational side-drawers or contextual views (Sentinel logs, Master Plan view, Snapshots).
        - `source-control/`: Git integration UI (Diff viewers, Git panels, Fullscreen code reviews).
        - `modals/`: Global overlays (Settings, Brainstorming sessions, HITL Approvals).
        - `developer-tools/`: Internal power-user utilities (Port manager, DB viewers, Env manager).
        - `graphs/`: Data visualizations (Agent network graphs, Monorepo dependency maps).
        - `architecture/`: Visual representations of the app's internal state or structure.
    - `features/`: Complex, "smart" containers that orchestrate multiple components (e.g., ZenModeView, OrchestrationSidebar).
    - `pages/`: Primary entry points for different app modes (TerminalModePage, ZenModePage).
    - `services/`: Singletons and hooks managing state, IPC, and background logic (handoff-service, sentinel-service, db-service).
    - `types/`: Domain-specific TypeScript interfaces (workspace.ts, orchestration-mode.types.ts).
    - `workflows/`: Implementations of complex multi-agent sequences (brainstorm-workflow, master-plan-workflow).
    - `lib/`: Shared utilities (styling helpers, glassmorphism math, terminal control sequence regex).
    - `dashboard/`: Specialized logic for the home/overview dashboard.

- **Backend (`src-tauri/src/`):**
    - `services/`: Rust modules handling specific domains (pty, git, llm, bus, db_client).

**Placement Rule:** If a component is reusable across the entire app, put it in `ui/`. If it belongs to a specific feature set (e.g., Kanban), put it in the corresponding `components/` subfolder. If it coordinates multiple domains (e.g., a mode-specific view), put it in `features/`.

### Implementation Standards

- **State Management:** `useAppController.ts` is the primary state hub, leveraging `db-service.ts` for SQLite persistence.
- **Event Bus:** Communication between Rust and React happens via Tauri `emit`/`listen`.
- **Terminal Parsing:** `app-core.ts` contains shared regex and utilities for parsing shell prompts and control sequences.

## MASTER_PLAN.md Conventions

- **Status Markers:** Tasks use `<!-- didi:status=... -->` comments (todo, in_queue, in_progress, waiting_completion, done).
- **HITL Marker:** Adding `<!-- didi:requires_approval -->` to a task line requires human confirmation before a completion callback is processed.
- **Agent Queue:** Top-level tasks in the `### Agent Queue` section are visible to the Kanban board.
