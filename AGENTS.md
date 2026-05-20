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
  services/stores/          # Zustand stores (agent, git, orchestration, ui, workspace)
  workflows/                # Multi-step agent orchestration flows
  pages/                    # Route-level page components
  features/                 # Feature building blocks (NonZenModeShell, ZenModeView, OrchestrationSidebarFeature)
  components/
    ui/                     # shadcn primitives
    terminal/               # TerminalInstance, BrowserInstance, useXTerm
    layout/                 # App shell: sidebar, topbar, tabs, terminal area, overlays, status bar, window controls
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
  scripts/                  # Script templates (delegate.ps1, context.ps1, AGENTS.md, MASTER_PLAN.md)
```

## Path Alias

`@/` → `./src/` (configured in tsconfig.json + vite.config.ts). Use for all internal imports.

## TypeScript Constraints

Strict mode with `noUnusedLocals: true` and `noUnusedParameters: true`. Unused imports or params cause build failures.

## Tauri

- **CSP enforced**: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: http://ipc.localhost ws://127.0.0.1:1421; font-src 'self' data:; img-src 'self' data: blob:; object-src 'none';`
- Capabilities defined in `src-tauri/capabilities/default.json` (core window ops, dialog, clipboard, SQL)
- No shell:default capability (cannot spawn arbitrary OS commands via plugin-shell)
- Rust lib crate is `tauri_app_lib`. Entry: `tauri_app_lib::run()`
- Uses `tauri = { version = "2", features = ["unstable"] }`

## Backend Services (Rust)

| Service | File | Commands |
|---------|------|----------|
| PTY | `services/pty.rs` | spawn_pty, write_pty, close_pty, resize_pty, get_process_stats, get_project_context |
| Git | `services/git.rs` | Snapshot CRUD, diff, status, branch, commit, pull, push, log, merge, panel operations |
| LLM | `services/llm.rs` | ask_llm, get_sidecar_status |
| Config | `services/config.rs` | get_config, set_config |
| Bus | `services/bus.rs` | Named pipe listener on `\\.\pipe\agentbus` |
| FS | `services/fs.rs` | read_file_content, write_file_content, list_directory, scan_env_files |
| HTTP | `services/http.rs` | make_http_request (arbitrary URL) |
| DB | `services/db_client.rs` | Remote Postgres/MySQL queries |
| Dashboard | `services/dashboard.rs` | Axum WebSocket server on `127.0.0.1:1421` |
| Security | `services/security.rs` | Workspace PIN (argon2 hashed) |
| Ports | `services/ports.rs` | Process/port management, kill_process |
| Packages | `services/packages.rs` | Package scanning, outdated detection, update execution |
| Graph | `services/graph.rs` | Project dependency graph |
| MasterPlan | `services/master_plan.rs` | Task planning CRUD, status management |
| Profile | `services/profile.rs` | Profile import/export |
| Job | `services/job.rs` | Windows Job Object for child process management |

## Project Structure Rules

Adding new code must follow these conventions.

### Where things go

| Kind of code | Destination | Example |
|---|---|---|
| Business logic, event listeners, state hooks | `services/` | `services/db-service.ts` |
| Zustand stores | `services/stores/` | `services/stores/workspace-store.ts` |
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
- `components/layout/` — App shell: sidebar, topbar, tabs, terminal area, overlays, status bar, window controls, pane layout
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

## Zustand Stores

| Store | File | Purpose |
|-------|------|---------|
| Agent | `services/stores/agent-store.ts` | Agent state management |
| Git | `services/stores/git-store.ts` | Git state, snapshots, diffs |
| Orchestration | `services/stores/orchestration-store.ts` | Multi-agent orchestration state |
| UI | `services/stores/ui-store.ts` | UI state, modals, theme |
| Workspace | `services/stores/workspace-store.ts` | Workspace, tabs, sections state |

## Testing

No automated tests exist. Manual verification paths:
- PTY: `spawn_pty` → terminal renders in xterm.js
- IPC: run `delegate.ps1` from a terminal and observe `agent-handoff` event
- React: visually verify in Tauri dev window

## Generated / Committed Artifacts

- Git snapshots stored in `%APPDATA%/didi/snapshots/` (outside repo)
- `src-tauri/target/`, `dist/`, `node_modules/`, `.vite-dev.log` all gitignored
- `didi.db` in Tauri app data dir (SQLite database persisted outside repo)

## Database Schema (SQLite)

7 migrations applied via `tauri-plugin-sql`:

| Version | Description | Key Changes |
|---------|-------------|-------------|
| 1 | create_initial_tables | workspaces, tabs, agents, settings, personal_tasks |
| 2 | add_totp_to_workspaces | TOTP secrets per workspace |
| 3 | add_sections_table | sections table, tabs.section_id |
| 4 | add_active_section_id | workspaces.activeSectionId |
| 5 | add_agent_uuid | agents.agent_uuid |
| 6 | add_performance_indexes | Indexes on order, workspace, section, tab, task columns |
| 7 | add_section_merged_tab_pair | sections.mergedTabPair |
