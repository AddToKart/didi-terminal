# DidiTerminal — MCP & Skills Integration Plan

---

## Overview

This plan describes the integration of a Model Context Protocol (MCP) Server into DidiTerminal and the introduction of a Didi OS Mastery Skills system. The goal is to eliminate bloated delegation messages, give all AI agents a native and standardized way to interact with DidiTerminal's features, and expose the project Kanban board as a live, queryable resource accessible to any connected AI tool.

The two layers work together:

- **MCP Layer** — The standardized connection and interaction layer. It allows any compatible AI tool (Gemini CLI, OpenCode, Copilot, Codex, Antigravity, Claude, etc.) to connect to DidiTerminal and use its features as native Tools and Resources.
- **Didi OS Mastery Skills** — The knowledge layer. It teaches every agent how to navigate DidiTerminal's special abilities, so they act as Power Users of the application rather than blind code writers inside a dumb terminal.

---

## The Didi Service

The MCP Server is not always running. It is a controlled service that the user explicitly activates from within the DidiTerminal UI.

### How It Works

Inside the DidiTerminal sidebar, directly below the **Init Didi** button, there will be a new button labeled **Start Didi Service**. This button starts the MCP server as a background process managed by the Tauri backend.

- The button is disabled unless a workspace has been initialized with **Init Didi** first.
- When active, the button changes to a **Stop Didi Service** state and the UI shows a persistent green status indicator confirming the service is live.
- When the DidiTerminal application is closed, the MCP server automatically shuts down. The server cannot exist independently of the application window.
- The MCP server listens on a fixed local address. This address is shown in the UI once the service is running so the user can configure their AI tools once and forget about it.

### Agent Connection

AI tools and CLI agents connect to the Didi MCP Server through their own native MCP configuration. There is no auto-injection or forced enrollment. The user configures each external tool (VS Code, Gemini CLI, Claude Desktop, etc.) once in their respective settings to point at the Didi server address. From that point on, whenever the Didi Service is running, those tools automatically have access to DidiTerminal's Tools and Resources.

---

## MCP Tools

Tools are actions that an agent can invoke through the MCP server to interact with DidiTerminal directly. The following tools are exposed by the Didi MCP Server.

### Delegation Tools

- **delegate** — Sends a task from one agent to another through the DidiTerminal handoff bus. This is the MCP-native equivalent of running `.didi\delegate` in the terminal. The message it sends is a slim, structured payload containing only the task instruction and the sender identity. No rules, no file trees, no system paragraphs are included.

- **report_completion** — Sends a completion callback from a specialist back to the agent that delegated the task. This is the MCP-native equivalent of the "Task complete" callback message.

### Kanban Board Tools

- **move_task** — Moves a task card between Kanban columns (Todo, In Queue, In Progress, Waiting, Done). Agents can update their own task status directly without touching the MASTER_PLAN.md file manually.

- **add_task** — Adds a new task to the Kanban board under a specified section.

- **get_my_task** — Returns the task currently assigned to the calling agent. The agent uses this to read its own assignment from the Agent Queue without having to parse the markdown file.

### Application Tools

- **take_snapshot** — Triggers a DidiTerminal Git snapshot before the agent starts a risky operation. This allows agents to proactively protect the project state using the existing Snapshot system.

- **spawn_agent** — Requests DidiTerminal to spawn a new agent terminal tab with a specified name and workspace. This allows agents to autonomously expand the team when needed.

- **get_active_agents** — Returns the list of agent terminal tabs currently open in DidiTerminal.

- **get_sentinel_status** — Returns the current Sentinel loop-detection state for a specified agent, including failure count and last intervention reason.

---

## MCP Resources

Resources are live data sources that agents can query from the MCP server. Unlike Tools, Resources are read-only and represent the current state of the project and application.

### Board Resources

- **board/todo** — Returns all tasks currently in the Todo column of the Kanban board as structured JSON.

- **board/in_queue** — Returns all tasks currently waiting in the In Queue column.

- **board/in_progress** — Returns all tasks currently active in the In Progress column, including which agent is working on each one.

- **board/waiting** — Returns all tasks currently in the Waiting for Completion state.

- **board/done** — Returns all tasks that have been completed.

- **board/full** — Returns the complete Kanban board state across all columns in a single structured response.

### Project Resources

- **project/context** — Returns the workspace file tree on demand. This is a pull-based resource. Agents request it when they are lost or need to find a file. It is never pushed into a delegation message automatically.

- **project/git_status** — Returns the current Git diff and status for the active workspace.

- **project/master_plan** — Returns the full MASTER_PLAN.md content as raw markdown for agents that need to read the entire document.

### Application Resources

- **app/agents** — Returns the live list of open agent terminal tabs including their names and current PTY status.

- **app/activity_log** — Returns the recent handoff and system activity log from the DidiTerminal UI.

- **app/snapshots** — Returns the list of available Git snapshots for the current workspace.

---

## Slim Messaging Redesign

With the MCP server providing context on-demand, the delegation message format changes fundamentally.

### Current Format (Bloated)
Every delegation message currently bundles the task, the sender identity, system rules about how to report back, the active agent list, the workspace root, the Master Plan ownership rules, the delegation wait rules, and the full workspace file tree into a single large text block injected into the agent terminal.

### New Format (Slim)
Every delegation message will contain only three things:

1. The task instruction itself, written as a clear and direct command.
2. The sender identity so the agent knows who to report back to.
3. A single reference line pointing to the AGENTS.md protocol document for behavioral rules.

The agent is responsible for using its MCP connection to query any additional context it needs. If it needs the file tree, it calls the `project/context` resource. If it needs to know what other agents are doing, it calls the `board/in_progress` resource. If it needs its own assignment details, it calls `get_my_task`. Nothing is assumed and nothing is pre-loaded.

---

## Didi OS Mastery Skills

The Didi OS Mastery Skills are installed into the `.didi/` folder as part of the **Init Didi** initialization. They are project-scoped, not global. Every agent that enters the project inherits these skills automatically because the `.didi/` folder is part of the workspace.

These are not general-purpose coding tools. They are specifically a "Driver's Manual" for DidiTerminal's own features and abilities.

### What the Skills Cover

**Delegation Mastery** — The agent knows exactly how to use `.didi\delegate` and the MCP `delegate` tool. It knows the difference between sending a task and sending a completion callback. It knows it must stop after delegating and wait.

**Kanban Mastery** — The agent knows how to read its own task from the Agent Queue, how to update its own task status using the MCP `move_task` tool, and that it must never touch another agent's entry in the Agent Queue.

**Snapshot Mastery** — The agent knows to call `take_snapshot` via MCP before any destructive operation (large refactor, file deletion, database migration). It understands this as a safety net, not an optional step.

**Sentinel Awareness** — The agent knows the Sentinel system is watching it for loops and repeated failures. It knows to change its approach if it gets stuck rather than retrying the same command. It knows it can query its own Sentinel status via MCP.

**Context Discovery** — The agent knows never to guess the file tree. It uses `project/context` via MCP when it needs to find a file. It uses `.didi\context` as the terminal-native fallback.

**Agent Coordination** — The agent knows how to check the `board/in_progress` resource to see what other agents are working on, so it can avoid file conflicts and duplication.

**Service Awareness** — The agent knows that if the Didi MCP Server is reachable at its configured address, all the above tools are available. If it is not reachable, it falls back to the terminal-native `.didi\delegate` script automatically.

### Skill File Location

All Didi OS Mastery content is stored in `.didi/skills/` as structured documents that the MCP server reads and serves as Prompt Templates when an agent connects for the first time in a session. This ensures the agent learns the rules through the MCP protocol itself, not through a bloated inline message.

---

## How It All Works Together

When the user initializes a project with **Init Didi**, the `.didi/` folder is created with the delegation scripts, the AGENTS.md protocol, the MASTER_PLAN.md, and the Didi OS Mastery Skills.

When the user clicks **Start Didi Service**, the Tauri backend starts the MCP server. The server immediately loads the current workspace context, reads the MASTER_PLAN.md to populate the Kanban resources, and begins listening for connections.

The user configures their external AI tools once in their respective settings to point at the Didi MCP server address. From that point on, every session where the user clicks Start Didi Service automatically activates full AI tool integration across all configured tools.

When a task is delegated, the message is slim and direct. The receiving agent checks its MCP connection, reads its assignment via `get_my_task`, queries any files it needs via `project/context`, does its work, updates its own Kanban card via `move_task`, and reports completion via `report_completion`. At no point is a large block of text carrying files, rules, or system instructions through the agent bus.

The result is a system where every agent, regardless of which AI tool or CLI it runs in, operates with the same situational awareness, the same tools, and the same understanding of the DidiTerminal environment.

---

## Settings Integration

The DidiTerminal Settings panel will include a dedicated **Didi Service** section with the following configuration:

- The local MCP server port number (defaults to a fixed port, user can change it).
- The server transport mode (SSE or WebSocket).
- A display of the current server address for easy copying into external tool configurations.
- A toggle to automatically start the Didi Service when the application opens.
