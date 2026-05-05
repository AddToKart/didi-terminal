# Project Overview

This project is "DidiTerminal", an autonomous multi-agent orchestrator desktop application built with Tauri, React, TypeScript, and Vite. 

The application creates multiple native pseudo-terminals (PTYs) running PowerShell, rendered via `xterm.js` in a React frontend. It features an inter-process communication (IPC) bus via a Windows named pipe (`\\.\pipe\agentbus`), allowing agents (CLI applications or AI agents) running in different terminal instances to delegate tasks to one another asynchronously. It also automatically spawns a `llama-server` sidecar binary for local AI inference.

## Key Technologies
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, `xterm.js` (for terminal rendering), `react-resizable-panels`.
- **Backend:** Tauri 2.0 (Rust), `portable-pty` (for native terminal spawning), `tokio` (for async named pipe IPC).

# Building and Running

The project relies on standard Vite and Tauri development commands, managed via `package.json` scripts:

- **Development Mode:** Start the Vite dev server and the Tauri desktop window:
  ```bash
  npm run tauri dev
  ```
  *(Note: `npm run dev` starts only the Vite server. The Tauri backend is required for PTY and IPC features).*

- **Production Build:** Build the compiled application for release:
  ```bash
  npm run tauri build
  ```

# Architecture & Development Conventions

## Multi-Agent Collaboration Protocol

The core innovation of this application is the autonomous agent collaboration mechanism:

1.  **Project Initialization:** When a workspace is opened, the user can click "Init Didi", triggering the Rust `initialize_project` command.
2.  **Scaffolding:** This scaffolds a `.didi/` directory in the target workspace containing delegation scripts (`delegate.ps1`, `delegate.cmd`, `context.ps1`, `context.cmd`) and an `AGENTS.md` instruction file.
3.  **IPC Bus:** A Rust background Tokio task listens on a Windows named pipe (`\\.\pipe\agentbus`).
4.  **Delegation:** When an agent runs `.didi\delegate <TargetAgent> "<Task>"`, the PowerShell script writes a JSON payload to the named pipe.
5.  **Event Dispatch:** Rust reads the named pipe, logs the event to a global `session.json` history (in `AppData`), and emits an `"agent-handoff"` event to the React frontend.
6.  **Frontend Injection:** `App.tsx` listens for the handoff event. If the target agent exists and its prompt is ready, the frontend immediately writes the delegated task into the agent's PTY. If the prompt isn't ready or the agent doesn't exist yet, it queues the payload and spawns the new agent.

## Code Conventions

- **Rust Backend:** The Tauri backend logic is contained in `src-tauri/src/lib.rs` and `src-tauri/src/main.rs`. Application state is handled using Tauri's `State` with `Mutex` wrapping HashMaps for PTY writers and resizers. Ensure all blocking I/O (like reading the PTY stdout) is moved to separate threads or async tasks.
- **React Frontend:** State relies on React hooks. `App.tsx` uses `useRef` heavily to maintain fresh state across async Tauri event listeners to avoid stale closure bugs.
- **Terminal Parsing:** `TerminalInstance.tsx` strips ANSI terminal controls from the stream and uses basic string matching to detect when an agent is ready for input by scanning the output buffer for common shell prompts (e.g., `PS `, `$ `, `Ask anything`, `>>> `). Ensure any new CLI tools integrated use recognizable prompt indicators.