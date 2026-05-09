# DidiTerminal — Mobile Integration Plan

---

## Overview

This plan describes the integration of a native mobile companion application into DidiTerminal using Tauri v2's built-in mobile support. The goal is to allow the user to monitor, command, and interact with their running agent orchestration from any location outside their home network, while the desktop application remains the "Host" and the mobile app acts as the "Commander."

The mobile app is not a remote desktop or a streaming screen. It is a purpose-built "Manager Dashboard" that connects to the desktop's Didi MCP Server over a secure tunnel and provides a mobile-optimized view of the orchestration system.

---

## Core Principle

The desktop is the "Worker." The mobile is the "Manager."

Everything that requires heavy computation (running PTYs, spawning agents, executing CLI tools, analyzing files, running local LLMs) happens exclusively on the desktop. The mobile app only handles the "Human Layer": reviewing status, issuing high-level commands, approving decisions, and monitoring the Kanban board.

---

## Architecture

### The "Dual Personality" App

Since DidiTerminal is built on Tauri v2 and React, the same codebase compiles to both a desktop application and a native mobile application for Android and iOS. The UI adapts its "Personality" based on the platform it is running on.

- **Desktop Personality** — The full DidiTerminal experience. PTY terminals, agent tabs, Sentinel monitoring, Brainstorm, Snapshots, Master Plan Kanban, and the Didi MCP Service toggle are all present and functional.

- **Mobile Personality** — The commander experience. The PTY terminals and agent spawning controls are hidden. The interface focuses entirely on the Chat interface, the Kanban board, the Agent Orchestration Map, and the Notification Center. The mobile app connects to the desktop over the Didi MCP Server and issues commands through it.

The React frontend detects the platform at runtime and renders the appropriate set of views without requiring a separate codebase or separate build pipeline.

---

## The Remote Connection

### The Problem

The desktop application runs entirely on a local network. The user's phone, when outside the home, is on a completely different network with no direct path to the desktop. Standard port-forwarding or IP-based solutions require complex router configuration and expose the machine to the open internet.

### The Solution: Reverse Tunnel

DidiTerminal bundles a lightweight tunnel binary as a Tauri sidecar. When the user enables remote access, the desktop initiates an outbound, encrypted connection to a public relay service. The mobile app connects to the same relay. The relay passes messages between the two devices without either side needing to open firewall ports or configure network settings.

The tunnel is:
- **Outbound only** from the desktop. The home firewall remains completely closed.
- **Encrypted end-to-end.** The relay cannot read the content of the messages.
- **On-demand.** The tunnel only exists when the user activates it from the DidiTerminal UI.

### How to Enable Remote Access

1. The user clicks the **Enable Remote Access** button in the DidiTerminal sidebar. This button is only available when the Didi Service (MCP Server) is already running.
2. The Tauri backend starts the tunnel sidecar and waits for it to establish a public relay address.
3. Once the address is established, DidiTerminal displays a QR Code on screen containing the relay address and a one-time security token.
4. The user opens the Didi mobile app on their phone and scans the QR Code.
5. The mobile app stores the relay address and the security token. The pairing is complete.
6. From this point on, whenever both the desktop tunnel is active and the mobile app is open, the connection is live.

---

## Security

### QR Code Pairing

The QR code encodes a cryptographically signed pairing token generated fresh each time the user enables remote access. The token is time-limited and bound to the specific tunnel session. If the user stops and restarts the tunnel, a new QR code must be scanned.

### Request Authentication

Every request from the mobile app to the desktop includes the pairing token in its headers. The Tauri backend validates this token before processing any command. Requests without a valid token are silently rejected.

### Biometric Lock

On the mobile app, access to the Commander Dashboard is protected by the device's native biometric authentication (Face ID, fingerprint, or PIN). The app cannot be opened without passing this check. The pairing token is stored in the device's secure enclave, not in plain storage.

---

## Mobile UI

### Chat Interface

A clean, conversational interface for issuing commands to the Orchestrator agent. The user can type natural language instructions such as "Start the next task in the queue" or "Tell me the status of the Builder agent." The Orchestrator receives these messages via the MCP `delegate` tool and responds through the same channel. The chat history is visible as a simple message feed.

### Kanban Board

A mobile-optimized, card-based view of the Master Plan Kanban board. Columns are displayed as scrollable vertical lists. The user can swipe a task card horizontally to move it between columns. Tapping a card shows the task details, subtasks, and the agent currently assigned to it.

### Orchestration Map

A simplified, read-only version of the Agent Network Graph. It shows which agents are currently active, which ones are waiting for callbacks, and which ones are idle. Edges between agents indicate active or recent delegation handoffs.

### Notification Center

A feed of recent system events, including:

- Agent task completions and failures.
- Sentinel interventions.
- Human Intervention requests where the agent needs a decision before proceeding.
- Kanban board state changes.
- Snapshot creation events.

---

## Push Notifications

When the mobile app is not in the foreground, the desktop sends push notifications to the device for high-priority events.

- **Human Intervention Required** — An agent has reached a decision point and needs the user's input. The notification includes the question and two action buttons (Approve / Reject) that can be tapped directly from the notification without opening the app.

- **Task Completed** — A top-level Kanban task has moved to Done.

- **Agent Stuck** — The Sentinel system has flagged an agent for repeated failures and has paused it.

- **All Tasks Complete** — The entire Agent Queue is empty and all tasks are in the Done column.

Notifications use the device's native notification system via Tauri v2's mobile notification plugin.

---

## Connection States

The mobile UI always shows a clear connection status indicator so the user knows the current state of the remote link.

- **Connected** — The tunnel is active, the MCP server is reachable, and data is live.
- **Disconnected** — The tunnel is not running or the desktop application is closed. The mobile app shows the last known state with a timestamp and displays a "Last seen" indicator.
- **Reconnecting** — The app is attempting to re-establish the tunnel connection after a brief interruption.

---

## Offline Behavior

When the mobile app loses connection to the desktop, it does not crash or show an empty screen. It displays the last known state of the Kanban board, the last known agent statuses, and the notification history. All commands the user attempts to send while offline are queued locally and replayed automatically when the connection is restored.

---

## Settings Integration

The DidiTerminal desktop Settings panel will include a **Remote Access** section with the following options:

- A toggle to enable or disable remote access entirely.
- The current tunnel address (shown when active).
- A button to regenerate the pairing QR code and invalidate the previous session.
- A list of currently paired devices with the option to revoke individual device access.
- An option to configure which event types trigger push notifications.
- A toggle to require biometric confirmation on the mobile app before processing any destructive command (e.g., "Delete agent" or "Rewind snapshot").
