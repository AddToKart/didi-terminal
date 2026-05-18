import { useEffect, useRef, useState, MutableRefObject } from "react";
import { Terminal, ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";

// Hard cap on scrollback lines — prevents unbounded RAM growth from log-storm terminals.
const SCROLLBACK_LINE_CAP = 10_000;

// Delay before re-attempting WebGL context attachment after GPU context loss (e.g. laptop sleep/wake).
const WEBGL_RECOVERY_DELAY_MS = 250;

export interface UseXTermOptions extends ITerminalOptions {
  agentName: string;
  onData?: (data: string) => void;
  onBinary?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onKey?: (event: KeyboardEvent) => boolean;
}

function createTerminal(): Terminal {
  const term = new Terminal({
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
    cursorBlink: false,
    cursorStyle: 'block',
    fontSize: 13,
    scrollback: SCROLLBACK_LINE_CAP,
    allowTransparency: true,
    theme: {
      background: 'rgba(0,0,0,0)',
      foreground: '#e2e8f0',
      cursor: '#00f0ff',
      selectionBackground: "#00f0ff40",
    },
  });
  return term;
}

/**
 * Force-releases a WebGL canvas's GPU textures and VRAM before the xterm
 * instance is disposed. Prevents GPU context exhaustion when many panes
 * are opened and closed over a long session.
 */
function forceReleaseCanvas(canvas: HTMLCanvasElement): void {
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  } catch { /* ignore */ }
  if (!gl) {
    try {
      gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    } catch { /* ignore */ }
  }
  if (gl) {
    try {
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext && !gl.isContextLost()) ext.loseContext();
    } catch { /* ignore */ }
  }
  // Wipe backing raster store to free rasterizer memory immediately.
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch { /* ignore */ }
}

/**
 * Attempts to attach the WebglAddon to an active terminal. If the GPU context
 * is lost, it schedules a single retry after WEBGL_RECOVERY_DELAY_MS so that
 * terminals automatically recover after a laptop sleep/wake cycle instead of
 * permanently falling back to the slower canvas renderer.
 */
function tryAttachWebgl(
  term: Terminal,
  isMountedRef: { current: boolean },
  addonRef: { current: WebglAddon | null }
): void {
  if (!term.element) return; // Terminal not yet opened in DOM.
  try {
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => {
      addonRef.current = null;
      try { webglAddon.dispose(); } catch { /* ignore */ }
      // Retry after the GPU reset window clears.
      setTimeout(() => {
        if (isMountedRef.current) tryAttachWebgl(term, isMountedRef, addonRef);
      }, WEBGL_RECOVERY_DELAY_MS);
    });
    term.loadAddon(webglAddon);
    addonRef.current = webglAddon;
  } catch (e) {
    // WebGL unavailable (software rendering fallback) — canvas renderer takes over.
    console.warn("[useXTerm] WebGL renderer unavailable, using canvas fallback:", e);
  }
}

export function useXTerm(
  containerRef: MutableRefObject<HTMLElement | null>,
  options: UseXTermOptions
) {
  const [termLoaded, setTermLoaded] = useState(false);
  const terminalRef = useRef<Terminal | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onDataRef = useRef(options.onData);
  const onBinaryRef = useRef(options.onBinary);
  const onKeyRef = useRef(options.onKey);

  useEffect(() => {
    onDataRef.current = options.onData;
    onBinaryRef.current = options.onBinary;
    onKeyRef.current = options.onKey;
  }, [options.onData, options.onBinary, options.onKey]);

  // Ref shared with WebGL helpers so recovery callbacks can check mount status.
  const isMountedRef = useRef(false);
  const webglAddonRef = useRef<WebglAddon | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let searchAddon: SearchAddon | null = null;

    const emitResize = (t: Terminal) => {
      options.onResize?.(t.cols, t.rows);
    };

    const fitVisibleTerminal = () => {
      if (!term || !fitAddon || !containerRef.current) return false;

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;

      try {
        fitAddon.fit();
      } catch {
        return false;
      }

      emitResize(term);
      return true;
    };

    const scheduleFit = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);

      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (!isMounted) return;

          if (fitVisibleTerminal()) {
            setTermLoaded(true);
            return;
          }

          resizeSettleTimer = setTimeout(() => {
            if (!isMounted) return;
            if (fitVisibleTerminal()) setTermLoaded(true);
          }, 80);
        });
      });
    };

    async function mountTerminal() {
      if (!isMounted || !containerRef.current) return;
      await document.fonts.ready;
      if (!isMounted || !containerRef.current) return;

      term = createTerminal();
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      searchAddon = new SearchAddon();
      term.loadAddon(searchAddon);

      term.onData((data) => onDataRef.current?.(data));
      term.onBinary((data) => onBinaryRef.current?.(data));

      // Critical key intercepts: route low-level CLI controls directly to PTY,
      // preventing the Webview or React from swallowing them.
      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isMac = /Mac|iPhone|iPad/.test(ua);
        const mod = isMac ? event.metaKey : event.ctrlKey;

        // Ctrl+Backspace (Cmd+Backspace on mac) → word-delete (\x17 = ETB / Ctrl+W).
        if (mod && (event.key === "Backspace" || event.code === "Backspace")) {
          event.preventDefault();
          if (event.type === "keydown") onDataRef.current?.("\x17");
          return false;
        }

        // Shift+Enter → ESC + CR (multi-line shell awareness).
        if (
          event.key === "Enter" &&
          event.shiftKey &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault();
          if (event.type === "keydown") onDataRef.current?.("\x1b\r");
          return false;
        }

        // Ctrl+C (interrupt) — always pass through; never let React intercept it.
        if (event.ctrlKey && event.key === "c") return true;

        // Delegate to the caller's custom key handler, fall through by default.
        return onKeyRef.current?.(event) ?? true;
      });

      term.open(containerRef.current);

      // Attach WebGL after open() so the DOM canvas element exists.
      tryAttachWebgl(term, isMountedRef, webglAddonRef);

      terminalRef.current = term;
      searchAddonRef.current = searchAddon;

      scheduleFit();

      const fitTerminal = () => {
        if (!fitVisibleTerminal()) return;
        if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
        resizeSettleTimer = setTimeout(() => emitResize(term!), 120);
      };

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitTerminal, 50);
      });
      resizeObserver.observe(containerRef.current);
    }

    mountTerminal();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      terminalRef.current = null;
      searchAddonRef.current = null;
      setTermLoaded(false);

      if (term) {
        // Force-release all WebGL GPU textures before disposal to prevent
        // VRAM exhaustion across long sessions with many pane open/close cycles.
        if (term.element) {
          term.element
            .querySelectorAll<HTMLCanvasElement>("canvas")
            .forEach(forceReleaseCanvas);
        }
        // Dispose the WebGL addon first, then the terminal itself.
        if (webglAddonRef.current) {
          try { webglAddonRef.current.dispose(); } catch { /* ignore */ }
          webglAddonRef.current = null;
        }
        try { term.dispose(); } catch (e) { console.error("[useXTerm] Failed to dispose terminal:", e); }
      }
    };
  }, [options.agentName]);

  const findNext = (text: string) => searchAddonRef.current?.findNext(text);
  const findPrevious = (text: string) => searchAddonRef.current?.findPrevious(text);

  return { terminal: terminalRef.current, search: { findNext, findPrevious }, isReady: termLoaded };
}
