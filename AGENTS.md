# DidiTerminal — Agent Instructions

## Commands

```sh
npm run tauri dev          # Full stack (Vite + Tauri Rust backend)
npm run dev                # Frontend-only (Vite, port 1420)
npm run build              # tsc --noEmit && vite build (CI gate)
npm run tauri build        # Release bundle
npm run tauri              # Tauri CLI passthrough
```

No test runner or linter configured. The only validation gate is `npm run build`.

## Project Structure

```
src/
  main.tsx                  # Entry: routes `/` → App, `/dashboard` → Dashboard
  App.tsx                   # Root: standalone terminal vs OrchestratorApp
  lib/cn.ts                 # cn() utility (clsx + tailwind-merge) — import from @/lib/cn
  types/                    # Shared type definitions
  services/                 # Business logic, event listeners, controller hooks
  workflows/                # Multi-step agent orchestration flows
  pages/                    # Route-level page components
  features/                 # Feature building blocks (used by pages)
  components/
    ui/                     # shadcn primitives
    terminal/               # TerminalInstance, BrowserInstance, useXTerm
    layout/                 # App shell: sidebar, topbar, terminal area, etc.
    panels/                 # Sentinel, Snapshot, MasterPlan
    modals/                 # Settings, TwoFactor, Brainstorm, Approval
    graphs/                 # NetworkGraph (React Flow)
    workspace/              # PersonalKanban, SecurityPanel, ProjectFileExplorer
    architecture/           # MonorepoGraph
    developer-tools/        # PortManager, DbViewer, PackageManager, EnvManager, ApiLab
    source-control/         # GitPanel, CodeReviewPanel, SourceControlFullscreen, FileIcon
  dashboard/                # Remote monitoring dashboard (WS bridge on :1421)

src-tauri/src/
  main.rs                   # Entry: calls tauri_app_lib::run()
  lib.rs                    # Plugin registration, command handlers, app state
  services/                 # Rust backend modules (pty, git, bus, llm, db_client, etc.)
```

## Path Alias

`@/` → `./src/` (configured in tsconfig.json + vite.config.ts). Use for all internal imports.

## TypeScript Constraints

Strict mode with `noUnusedLocals: true` and `noUnusedParameters: true`. Unused imports or params cause build failures.

## Tauri

- `"csp": null` (no CSP — webview can load any resource)
- `shell:default` capability enabled (frontend can spawn arbitrary OS commands via `@tauri-apps/plugin-shell`)
- Rust lib crate is `tauri_app_lib` (not `tauri-app`). Entry: `tauri_app_lib::run()`
- Uses `tauri = { version = "2", features = ["unstable"] }`
- Capabilities defined in `src-tauri/capabilities/default.json`

## Backend Services (Rust)

| Service | File | Commands |
|---------|------|----------|
| PTY | `services/pty.rs` | spawn_pty, write_pty, close_pty, resize_pty, get_process_stats, get_project_context |
| Git | `services/git.rs` | Snapshot CRUD, diff, status, branch, commit, pull, push, log, merge |
| LLM | `services/llm.rs` | ask_llm, get_sidecar_status |
| Config | `services/config.rs` | get_config, set_config |
| Bus | `services/bus.rs` | Named pipe listener on `\\.\pipe\agentbus` |
| FS | `services/fs.rs` | read_file_content, write_file_content, list_directory, scan_env_files |
| HTTP | `services/http.rs` | make_http_request (arbitrary URL) |
| DB | `services/db_client.rs` | Remote Postgres/MySQL queries |
| Dashboard | `services/dashboard.rs` | Axum WebSocket server on `127.0.0.1:1421` |
| Security | `services/security.rs` | Workspace PIN (argon2 hashed) |
| Other | `services/ports.rs`, `packages.rs`, `graph.rs`, `master_plan.rs` | Process/port mgmt, package scanning, project graph, MASTER_PLAN.md |

## Project Structure Rules

Adding new code must follow these conventions.

### Where things go

| Kind of code | Destination | Example |
|---|---|---|
| Business logic, event listeners, state hooks | `services/` | `services/db-service.ts` |
| Multi-step processes (orchestration) | `workflows/` | `workflows/brainstorm-workflow.ts` |
| Route-level page components | `pages/` | `pages/TerminalModePage.tsx` |
| Feature building blocks (used by pages) | `features/` | `features/NonZenModeShell.tsx` |
| Pure utility functions (no state, no UI) | `lib/` | `lib/cn.ts` |
| Shared type/interface definitions | `types/` | `types/workspace.ts` |
| UI components | `components/{domain}/` | See below |
| Standalone module (dashboard) | Top-level dir e.g. `dashboard/` | `dashboard/Dashboard.tsx` |

### Component domain directories

All UI components go under `components/` in a domain subfolder:

- `components/ui/` — shadcn primitives only
- `components/terminal/` — TerminalInstance, BrowserInstance, xterm hooks
- `components/layout/` — App shell: sidebar, topbar, tabs, terminal area, overlays, status bar
- `components/modals/` — Modal dialogs (Settings, Approval, Brainstorm, TwoFactor)
- `components/panels/` — Info panels (Sentinel, Snapshot, MasterPlan)
- `components/graphs/` — Graph visualizations (NetworkGraph — React Flow)
- `components/workspace/` — Workspace-specific panels (Kanban, Security, FileExplorer)
- `components/architecture/` — Architecture visualization (MonorepoGraph)
- `components/developer-tools/` — Dev tool modals (PortManager, DbViewer, EnvManager, etc.)
- `components/source-control/` — Git/code-review panels

### Naming rules

- Keep files focused (< 200 lines; split otherwise)
- **No generic names.** Never create `utils.ts`, `helpers/`, `common/`, `shared/`. Name files after their specific purpose (e.g. `cn.ts`, not `utils.ts`)
- shadcn components stay in `components/ui/` and import `cn` from `@/lib/cn`
- Feature files match their exported function/component name (PascalCase for components, kebab-case for services)

### Import rules

- Always use `@/` path alias for internal imports (e.g. `import { cn } from "@/lib/cn"`). Avoid deep relative paths like `../../../components/...`
- Business logic (services) must not import UI components
- Types used across modules go in `types/`, not colocated

## Key Conventions

- **Agent identification:** `agentName.toLowerCase().replace(/[^a-z0-9]/g, "")` for lookup keys
- **Event naming:** `pty-output-agent-{key}`, `pty-exit-agent-{key}` where key = alphanumeric agent name with non-alnum → `_`
- **PTY writers are write-only via invoke:** Never hold PTY writer refs on the frontend; always go through `invoke("write_pty", ...)`
- **Prompt detection:** Regex-matched CLI prompts. If adding a new CLI integration, update `CLI_PROFILES` in `TerminalInstance.tsx`
- **Handoff protocol:** JSON over named pipe, fields: `target`, `payload`, `kind` (task|completion), `sender`, `task_id`
- **ANSI stripping:** Apply before parsing terminal output for prompt detection or error matching (three regex patterns in both TS and Rust)

## Testing

No automated tests exist. Manual verification paths:
- PTY: `spawn_pty` → terminal renders in xterm.js
- IPC: run `delegate.ps1` from a terminal and observe `agent-handoff` event
- React: visually verify in Tauri dev window

## Generated / Committed Artifacts

- Git snapshots stored in `%APPDATA%/didi/snapshots/` (outside repo)
- `src-tauri/target/`, `dist/`, `node_modules/`, `.vite-dev.log` all gitignored
- `didi.db` in Tauri app data dir (SQLite database persisted outside repo)
