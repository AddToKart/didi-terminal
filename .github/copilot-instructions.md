# Copilot Instructions for DidiTerminal

## Build, Test, and Lint Commands

### Development
```bash
# Start frontend dev server + Tauri backend (required for PTY and IPC features)
npm run tauri dev

# Frontend dev server only (Vite, port 1420)
npm run dev
```

### Building
```bash
# Type-check and build for production
npm run build

# Tauri production build
npm run tauri build
```

### Note on Testing
This repository does not currently have automated tests configured. When making changes, manually verify:
- PTY spawning works (`spawn_pty` command)
- Terminal input/output works (`write_pty`, `resize_pty`)
- Named pipe IPC works (test `delegate` command from a terminal)
- React components render correctly (use Tauri dev window)

---

## High-Level Architecture

### Core Application Flow
1. **User opens workspace** → `App.tsx` loads agent list and workspace state
2. **User clicks "Init Didi"** → Rust `initialize_project` scaffolds `.didi/` directory with delegation scripts and helper files
3. **User spawns agents** → Rust `spawn_pty` launches `pwsh.exe` instances, React `TerminalInstance` renders each via `xterm.js`
4. **Agents delegate tasks** → Scripts call `delegate.ps1`, which writes JSON to `\\.\pipe\agentbus` (Windows Named Pipe)
5. **Rust bus listener** → Background Tokio task reads from named pipe, emits `agent-handoff` event
6. **Frontend receives handoff** → React injects delegated task into target agent's PTY via `write_pty`

### Technology Stack
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + `xterm.js` (WebGL rendering)
- **Backend:** Tauri 2.0 (Rust) + `portable-pty` (native PTY management) + `tokio` (async IPC)
- **IPC:** Windows Named Pipes (`\\.\pipe\agentbus`)
- **External:** `llama-server` sidecar bundled for local AI inference

### Key Files and Responsibilities

| File/Directory | Responsibility |
|---|---|
| `src/App.tsx` | Main React component: workspace picker, agent list, handoff coordination, event listeners |
| `src/components/TerminalInstance.tsx` | Single terminal pane: PTY I/O, input forwarding, prompt detection, ANSI stripping |
| `src-tauri/src/lib.rs` | Core Rust commands: `spawn_pty`, `write_pty`, `resize_pty`, `initialize_project`, `start_agent_bus` |
| `src-tauri/src/main.rs` | Tauri app setup, event handlers |
| `.didi/delegate.ps1` | Scaffolded script agents run to delegate tasks to other agents |
| `.didi/AGENTS.md` | Scaffolded instruction file for agents in the workspace |

---

## Key Conventions

### State Management & PTY Handling
- **Rust Backend State:** Uses `struct AppState` with `Mutex<HashMap>` to track:
  - `pty_writers`: Write handles for each PTY
  - `pty_resizers`: Master PTY handles for resizing
  - `pty_processes`: Process metadata (PID, child handle)
  - `config`: App configuration (shell, LLM endpoint, theme colors)
- **React State:** Managed via hooks. Use `useRef` in event listeners to avoid stale closure bugs when holding references across async Tauri calls
- **Critical:** Never hold references to PTY writers outside the Rust side; always invoke `write_pty` through `invoke()` from React

### Agent Identification
- Agents are identified by lowercase, alphanumeric ID derived from name: `agentName.toLowerCase().replace(/[^a-z0-9]/g, "")`
- Agent names can include spaces/special chars, but internal lookups use normalized IDs
- The `delegate` command matches agents by normalized ID or exact PTY key (lowercase trim)

### Prompt Detection
Terminal readiness is detected by scanning output buffer for CLI profile patterns:
- OpenCode: `"Ask anything"`, `"Build ·"`, `"commands"`
- Copilot CLI: `"GitHub Copilot"`, `"ctrl+p commands"`, `"commands ? help"`
- Gemini CLI: `"Type your message"`, `"Gemini CLI"`
- Shell: `"PS "`, `"$ "`, `">>> "`
- Regex: `/^(>)$/ ` (single `>` on a line)

When adding new CLI integrations, ensure output includes recognizable patterns or update `CLI_PROFILES` in `TerminalInstance.tsx`.

### Task Handoff Protocol
- **Completion detection:** Messages starting with `"Task complete"`, `"Done"`, `"Completed"`, `"Finished"`, `"Status"`, `"FYI"`, `"Ack"`, or `"Acknowledged"` are completion callbacks
- **Handoff JSON format:**
  ```json
  {
    "target": "AgentName",
    "payload": "Task description",
    "kind": "task|completion",
    "sender": "SenderAgent",
    "task_id": "unique-id",
    "parent_task_id": "parent-id"
  }
  ```
- **Queuing behavior:** If target agent doesn't exist or prompt isn't ready, frontend queues the handoff and spawns the agent on demand

### Workspace and `.didi/` Directory Structure
When `initialize_project` is called, it scaffolds:
```
.didi/
  ├── delegate.ps1          # Bridge to named pipe IPC
  ├── delegate.cmd          # Batch wrapper
  ├── context.ps1           # Context gathering script
  ├── context.cmd           # Batch wrapper
  └── AGENTS.md             # Workspace agent instructions
```

These scripts are workspace-specific and persist across sessions. If you modify the bootstrap flow, ensure both the root `AGENTS.md` and workspace-scaffolded scripts stay in sync.

### ANSI Terminal Control Stripping
Both React and Rust strip ANSI codes to extract clean output:
```regex
/\x1B\][^\x07]*(?:\x07|\x1B\\)/g    # OSC sequences
/\x1B\[[0-?]*[ -/]*[@-~]/g          # CSI sequences
/\x1B[@-_][0-?]*[ -/]*[@-~]/g       # Fe sequences
```

This is critical for:
- Prompt detection in terminal output
- Display in UI components
- Parsing error messages for Sentinel monitoring

### Generated Artifacts
- **Ignore in edits:** `src-tauri/target/`, `node_modules/`, `dist/`
- **Do not version:** `.vite-dev.log`, build outputs
- Git snapshots stored in `AppData/didi/snapshots` (managed by Rust, persisted outside repo)

### TypeScript and Rust Configuration
- **TypeScript:** Strict mode enabled, `noUnusedLocals` and `noUnusedParameters` enforced
- **Vite:** Fixed port 1420 (Tauri requirement), Rust source ignored during watch
- **Rust:** MSRV 2021 edition, `portable-pty` for cross-platform PTY abstraction (though Windows-first in practice)

### Development Workflow Preferences
- Prefer `npm run tauri dev` over `npm run dev` when working with terminal features
- Keep the Tauri window open during development to test PTY behavior in real-time
- Use `npm run build` before commits to catch TypeScript errors
- If modifying Rust code, ensure Tauri dev window reloads the backend (it watches lib.rs automatically)

### Important Behavioral Contracts
- **Never modify .didi/ during development without syncing workspace AGENTS.md:** The app reads from both locations
- **PTY writers are write-once:** Once created, the same writer handle must be reused; spawning duplicates causes multiple PTY instances
- **Tauri events are async:** Use proper async/await and useRef patterns to avoid closure stale state in React event listeners
- **Delegation is fire-and-forget:** After a successful `delegate` command, expect an `agent-handoff` event; do not poll files or retry internally

---

## Architecture Diagrams

### IPC Flow (Delegation)
```
Agent Terminal (PowerShell)
         ↓
   delegate.ps1
         ↓
\\.\pipe\agentbus (Windows Named Pipe)
         ↓
Rust Backend (start_agent_bus listener)
         ↓
emit("agent-handoff")
         ↓
React App.tsx (listen for event)
         ↓
write_pty → Target Agent's stdin
```

### PTY Management Lifecycle
```
User spawns agent "Builder"
         ↓
invoke("spawn_pty", { agent: "builder", cwd: "..." })
         ↓
Rust: Create PTY master + slave, spawn pwsh.exe on slave
         ↓
Rust: Store writer (slave stdin) in pty_writers["builder"]
         ↓
React: Create Terminal instance, invoke read_pty in a loop
         ↓
React: Render output via xterm.js, detect prompt readiness
         ↓
User types input / task is delegated
         ↓
invoke("write_pty", { agent: "builder", data: "..." })
         ↓
Rust: Write to pty_writers["builder"] → PTY slave stdin → PowerShell process
```

---

## Workspace Initialization (`initialize_project`)

When called with a workspace path:
1. Creates `.didi/` directory
2. Generates `delegate.ps1`, `delegate.cmd`, `context.ps1`, `context.cmd` scripts
3. Writes workspace-specific `AGENTS.md` with instructions
4. Returns scaffolding summary to frontend

These files are **persistent** — agents rely on them existing across app restarts. Do not delete `.didi/` without clearing the workspace from the app's memory.

---

## Common Pitfalls to Avoid

1. **Holding PTY writer references in React:** Always go through `invoke("write_pty")` for thread safety
2. **Not awaiting Tauri invocations:** Async calls to Rust commands must be properly awaited
3. **Modifying pty_writers while a thread is reading:** The Rust side uses Mutex; ensure all writes go through the command interface
4. **Assuming agents are ready immediately after spawn:** Always listen for `agent-prompt-ready` before injecting tasks
5. **Forgetting ANSI stripping when parsing output:** Terminal output contains escape codes; strip before regex matching
6. **Changing event names without updating both sides:** Event names like `"agent-handoff"` are contracts between Rust and React — keep them in sync
7. **Not handling Windows path separators:** Use backslashes `\` in file paths, especially in `.didi/` delegation scripts

---

## Generated Artifacts and Build Output

- **TypeScript compilation:** `npm run build` generates `dist/` directory for production
- **Tauri build:** `npm run tauri build` generates `src-tauri/target/` (debug or release depending on mode)
- **Snapshots:** Git snapshot records stored in `%APPDATA%/didi/snapshots/{workspace-hash}.json`
- **Dev artifacts:** `.vite-dev.log` contains Vite server output during development

Do not commit `dist/`, `target/`, or `.vite-dev.log`. The `.gitignore` should exclude these; verify before committing.

---

## Additional Resources

- **README.md:** High-level overview and tutorial
- **AGENTS.md:** Instructions for AI agents running inside DidiTerminal
- **Custom instructions in repository:** Available in `custom_instruction` blocks for AI assistants (read by Copilot CLI)
