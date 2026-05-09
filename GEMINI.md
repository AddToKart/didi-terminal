# Project Overview

DidiTerminal is an autonomous multi-agent orchestrator desktop application built with Tauri, React, TypeScript, and Vite. 

The application manages multiple native pseudo-terminals (PTYs) running PowerShell, rendered via `xterm.js`. It enables asynchronous multi-agent collaboration via a Windows named pipe IPC bus (`\\.\pipe\agentbus`), allowing agents to delegate tasks to one another.

## Key Technologies
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, `xterm.js`, `react-resizable-panels`, `@xyflow/react` (for agent network visualization).
- **Backend:** Tauri 2.0 (Rust), `portable-pty`, `tokio` (for async named pipe IPC and sidecar management).
- **Inference:** Local AI inference via a bundled `llama-server` sidecar binary.

# Key Features

- **Master Plan Kanban:** An interactive board synchronized with `MASTER_PLAN.md`. Supports automated task dispatching, drag-and-drop status updates, and subtask tracking.
- **Dynamic Layout Engine:** Supports Vertical, Horizontal, and Grid tiling (automatically calculating 2x2, 3x2, etc.) for multiple terminal instances.
- **Agent Network Graph:** Real-time visualization of agent relationships and handoff flows using `@xyflow/react`.
- **Sentinel Monitoring:** An autonomous watchdog service that monitors agent PTYs for loops and repeated failures, intervening by pausing agents to prevent resource waste.
- **Multi-Agent Brainstorming:** A specialized workflow for parallel agent deliberation with automated consensus synthesis using the local LLM sidecar.
- **Git Snapshots:** Automatic, non-invasive git snapshots (using a separate index) created before each task delegation, providing a "time machine" for the workspace.
- **Human-In-The-Loop (HITL):** Optional human approval for task completions triggered by specific markdown markers in the Master Plan.

# Building and Running

Managed via `package.json` scripts:

- **Development Mode:** `npm run tauri dev` (starts Vite dev server and Tauri backend).
- **Production Build:** `npm run tauri build` (compiles the application and sidecars).

# Architecture & Development Conventions

## Multi-Agent Collaboration Protocol

1.  **Initialization:** `initialize_project` scaffolds a `.didi/` directory with delegation scripts and `AGENTS.md`.
2.  **IPC Bus:** A Rust background task listens on `\\.\pipe\agentbus` for JSON payloads.
3.  **Delegation:** Scripts like `.didi\delegate` write to the pipe. Rust logs the event to `session.json` and emits `agent-handoff` to the frontend.
4.  **Context Enrichment:** The frontend `handoff-service` automatically injects workspace context and collaboration rules into delegated tasks.
5.  **Execution:** The frontend writes the task to the target agent's PTY once it detects a shell prompt.

## Code Conventions

- **Frontend Services:**
    - `sentinel-service.ts`: Implements the autonomous monitoring and intervention logic.
    - `handoff-service.ts`: Manages the handoff lifecycle, including snapshotting and HITL.
    - `app-core.ts`: Shared utilities for terminal parsing, ID generation, and payload matching.
- **Rust Backend:**
    - `src-tauri/src/services/llm.rs`: Interface for the `llama-server` sidecar.
    - `src-tauri/src/services/master_plan.rs`: Procedural markdown parsing and state management for the Master Plan.
    - `src-tauri/src/services/git.rs`: Non-destructive git snapshot implementation.
- **State Management:** `App.tsx` uses `useRef` to maintain fresh state for async event listeners. Components communicate via Tauri events (`emit`/`listen`).

## MASTER_PLAN.md Conventions

- **Status Markers:** Tasks use `<!-- didi:status=... -->` comments (todo, in_queue, in_progress, waiting_completion, done).
- **HITL Marker:** Adding `<!-- didi:requires_approval -->` to a task line requires human confirmation before a completion callback is processed.
- **Agent Queue:** Top-level tasks in the `### Agent Queue` section are visible to the Kanban board.
