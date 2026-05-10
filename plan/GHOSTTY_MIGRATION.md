# Ghostty Web Migration Plan

## Overview

The goal is to replace `xterm.js` — the current terminal renderer in `TerminalInstance.tsx` — with the Ghostty WASM terminal engine. The Rust backend, the PTY management (`portable-pty`), the IPC bus, and all agent orchestration logic remain completely untouched. Only the frontend rendering layer changes.

---

## What We Are Using

**Ghostty Web** is the browser-compatible WASM build of the Ghostty terminal emulator. It exposes a JavaScript API that accepts raw PTY byte streams and renders them using its own internal GPU-accelerated engine directly onto an HTML Canvas element. It supports the full VT/ANSI escape sequence specification, ligatures, custom shaders, box drawing, emoji, and true-color.

The package is `ghostty-web` and is distributed as an npm package that ships the WASM binary alongside its JavaScript glue code.

---

## What Changes and What Does Not

### What Stays the Same
- All Rust commands: `spawn_pty`, `write_pty`, `resize_pty`, `close_pty`, `get_process_stats`
- The Tauri event bridge that streams PTY output to the frontend
- `AppState` and the PTY process map in `lib.rs`
- The `AppTerminalArea.tsx` grid and layout system
- All drag-and-drop, tab, and workspace logic
- The `BrowserInstance` component
- SQLite persistence
- The agent bus, handoff service, sentinel, and master plan

### What Changes
- `TerminalInstance.tsx` — the internal rendering engine swaps from `xterm.js` to Ghostty WASM
- The `useEffect` that creates the terminal object and mounts it to the DOM ref
- How we write incoming PTY data into the renderer
- How we send keyboard input from the renderer back to Rust
- How we apply theme colors and font settings
- The Vite/build configuration to correctly handle the `.wasm` binary asset

---

## The Migration Strategy

The safest approach is to treat `TerminalInstance.tsx` as a **black box swap**. The component's external interface — its props (`agentName`, `cwd`, `onRemove`, etc.) and its Tauri event listeners — do not change at all. Only the internal implementation of how text is rendered changes.

We will create a new composable hook, something like `useGhosttyTerminal`, that encapsulates the entire WASM lifecycle: loading, initialization, canvas mounting, writing data, and cleanup. This hook replaces the current `useEffect` blocks that manage the `xterm.js` `Terminal` instance and its addons.

The Ghostty WASM module is initialized asynchronously. We handle this by showing a minimal loading state on the canvas placeholder while WASM loads, then mounting the Ghostty surface once it reports ready. This is invisible to the user in practice since WASM loads in milliseconds after the first initialization is cached by the browser.

---

## Theme Integration

Ghostty accepts its configuration as a structured config object (mirroring the `.ghostty` config file format). We will build a **theme bridge** that reads our CSS design tokens (`--brand-primary`, `--app-bg`, etc.) from `getComputedStyle` at mount time and converts them into Ghostty's color palette format. This means the terminal will always inherit the active Didi theme automatically without any manual sync.

---

## Input and Output

**Output (PTY → Ghostty)**: The existing `onPtyData` Tauri event listener delivers raw byte arrays from the Rust PTY. Instead of calling `terminal.write(data)` on an xterm instance, we call the equivalent Ghostty WASM write function. The data format is identical — raw VT byte streams — so no transformation is needed.

**Input (Keyboard → PTY)**: Ghostty exposes an event callback for key input. We wire this directly to the existing `write_pty` Tauri invoke call, replacing the current `terminal.onData` handler from xterm. The PTY doesn't care where the keystrokes came from.

**Resize**: The existing `resize_pty` Tauri command stays. We hook into Ghostty's resize API on the same `ResizeObserver` that currently handles xterm resizing.

---

## Addon Removal

Currently, `xterm.js` requires several addons to reach feature parity with a real terminal: `@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/addon-web-gl`, `@xterm/addon-search`. Ghostty bundles all of this natively — GPU rendering, link detection, and correct sizing are built in. These addon packages are removed entirely from `package.json`.

---

## Vite Build Consideration

The Ghostty WASM binary must be treated as a static asset by Vite. We configure `vite.config.ts` to include the `.wasm` file as an asset that gets copied to the `public` or `dist` directory without being processed or hashed. We also set the correct MIME type (`application/wasm`) in the Tauri security headers so the WASM module can be instantiated without errors.

---

## Rollback Safety

Because the migration is entirely contained within `TerminalInstance.tsx` and a new hook file, rollback is trivial — we can keep the old xterm implementation in a separate file and swap the import back in one line if anything is unstable. No database migrations, no Rust changes, and no changes to any other component are involved. This makes the migration zero-risk to the rest of the system.
