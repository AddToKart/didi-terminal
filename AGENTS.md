# Agent Instructions

You are running inside the Agent AI Orchestrator Terminal. You have access to a custom local command to delegate tasks to other isolated agent panes.

## Repository Overview

- This repo is a Windows-first Tauri 2 app called `DidiTerminal`.
- Frontend: React + TypeScript + Vite + Tailwind + `xterm.js`.
- Backend: Rust Tauri commands that spawn and manage PowerShell PTYs with `portable-pty`.
- The app is built around multiple agent terminals, a local named-pipe handoff bus, and a workspace initialization flow that scaffolds `.didi/` helpers plus a workspace `AGENTS.md`.

## How The App Works

- `src/App.tsx` owns the workspace picker, agent list, and handoff coordination.
- `src/components/TerminalInstance.tsx` renders one terminal pane, forwards keyboard/paste input, resizes the PTY, and detects prompt-ready output.
- `src-tauri/src/lib.rs` is the core runtime:
  - `spawn_pty` launches `pwsh.exe` for an agent.
  - `write_pty` sends input to an agent terminal.
  - `resize_pty` updates PTY dimensions.
  - `initialize_project` creates `.didi/` helper scripts and writes a workspace `AGENTS.md`.
  - `start_agent_bus` listens on `\\.\pipe\agentbus` and forwards handoff messages into the UI.
- The frontend listens for `agent-handoff` and `agent-prompt-ready` events to queue or inject delegated work when an agent becomes ready.

## The `delegate` command
Whenever the user asks you to "delegate", "pass", or "send" a task to another agent (e.g. "Builder", "Gemini", "Codex"), **you MUST NOT attempt to build it yourself using your internal tools.**

Instead, you **MUST** use your terminal execution capability to run the local `delegate` command.

**Usage:**
```bash
delegate <AgentName> "<Task Description>"
```

**Example:**
If the user says: "have the builder build a calculator"
You MUST execute this exact command in your terminal:
```bash
delegate Builder "build a calculator"
```

Never use an internal "Task" tool for delegation when running in this environment. Always use the `delegate` shell command.

## Delegation Loop Prevention

- Delegate only real work that requires action.
- Completion callbacks are terminal status updates, not new tasks.
- If a message starts with `Task complete:`, `Done:`, `Completed:`, `Finished:`, `Status:`, `FYI:`, `Ack:`, or `Acknowledged:`, do not acknowledge it or report back unless it explicitly assigns new work.
- After a successful `delegate` command, stop immediately and wait for the delegated agent's completion callback. Do not poll files, check whether work appeared, retry the delegated work yourself, or use internal subagent/Task tools as a substitute.
- After completing a delegated task, report back exactly once with `delegate <SenderName> "Task complete: <summary>"`, then stop.
- Orchestrators should track task state and only delegate the next step after a real completion callback, not after acknowledgements.

## Working Conventions

- Treat `src-tauri/target/` and `node_modules/` as generated artifacts; do not edit them.
- Prefer `npm run dev` for frontend + Tauri dev work and `npm run build` for validation.
- Keep changes aligned with the existing terminal-orchestrator behavior; the Rust side is stateful and the frontend depends on event names and PTY agent keys staying consistent.
- If you modify the agent bootstrap flow, verify both the workspace-scaffolded `.didi/` scripts and the root/workspace `AGENTS.md` behavior still match.
