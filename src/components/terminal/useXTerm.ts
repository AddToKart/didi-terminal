import { useEffect, useRef, useState, MutableRefObject } from "react";
import { Terminal, ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";

const MIN_FIT_WIDTH_PX = 280;
const MIN_FIT_HEIGHT_PX = 120;

// Hard cap on scrollback lines — prevents unbounded RAM growth from log-storm terminals.
const SCROLLBACK_LINE_CAP = 10_000;
const RESIZE_DEBOUNCE_MS = 40;
const FIT_RETRY_MS = 180;

// Delay before re-attempting WebGL context attachment after GPU context loss (e.g. laptop sleep/wake).
const WEBGL_RECOVERY_DELAY_MS = 250;

const nativeDarkTheme = {
  background: "#09090b",
  foreground: "#e4e4e7",
  cursor: "#f4f4f5",
  cursorAccent: "#09090b",
  selectionBackground: "#3b82f660",
  black: "#18181b",
  brightBlack: "#71717a",
  red: "#ef4444",
  brightRed: "#f87171",
  green: "#22c55e",
  brightGreen: "#4ade80",
  yellow: "#eab308",
  brightYellow: "#fde047",
  blue: "#3b82f6",
  brightBlue: "#60a5fa",
  magenta: "#d946ef",
  brightMagenta: "#e879f9",
  cyan: "#06b6d4",
  brightCyan: "#22d3ee",
  white: "#e4e4e7",
  brightWhite: "#fafafa",
};

export interface UseXTermOptions extends ITerminalOptions {
  agentName: string;
  onData?: (data: string) => void;
  onBinary?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onKey?: (event: KeyboardEvent) => boolean;
}

function createTerminal(options: UseXTermOptions): Terminal {
  const terminalOptions: Partial<UseXTermOptions> = { ...options };
  delete terminalOptions.agentName;
  delete terminalOptions.onData;
  delete terminalOptions.onBinary;
  delete terminalOptions.onResize;
  delete terminalOptions.onKey;

  return new Terminal({
    allowProposedApi: true,
    allowTransparency: true,
    altClickMovesCursor: true,
    convertEol: true,
    cursorBlink: true,
    cursorInactiveStyle: "outline",
    cursorStyle: "block",
    customGlyphs: true,
    drawBoldTextInBrightColors: true,
    fastScrollSensitivity: 5,
    fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas, monospace',
    fontSize: 13,
    fontWeight: "normal",
    fontWeightBold: "bold",
    letterSpacing: 0,
    lineHeight: 1.15,
    minimumContrastRatio: 4.5,
    rescaleOverlappingGlyphs: true,
    rightClickSelectsWord: false,
    scrollback: SCROLLBACK_LINE_CAP,
    smoothScrollDuration: 0,
    ...terminalOptions,
    theme: {
      ...nativeDarkTheme,
      background: "transparent",
      ...terminalOptions.theme,
    },
  });
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
  const onResizeRef = useRef(options.onResize);
  const onKeyRef = useRef(options.onKey);

  useEffect(() => {
    onDataRef.current = options.onData;
    onBinaryRef.current = options.onBinary;
    onResizeRef.current = options.onResize;
    onKeyRef.current = options.onKey;
  }, [options.onData, options.onBinary, options.onResize, options.onKey]);

  // Ref shared with WebGL helpers so recovery callbacks can check mount status.
  const isMountedRef = useRef(false);
  const webglAddonRef = useRef<WebglAddon | null>(null);

  /**
   * StrictMode double-mount guard (generation counter).
   *
   * React 19 StrictMode fires effects twice in dev (mount → cleanup → remount)
   * to stress-test lifecycle correctness. Without a guard, two concurrent
   * `mountTerminal()` async calls race to call `term.open()` on the same DOM
   * container, corrupting canvas bindings for the terminal that wins the race.
   *
   * The generation counter approach works correctly for BOTH scenarios:
   *  - StrictMode remount (same agentName): second effect increments the counter;
   *    the first effect's async continuation sees a stale gen and aborts.
   *  - Legitimate agentName change: new effect increments the counter the same
   *    way, aborting any in-flight work from the previous agentName's cycle.
   */
  const mountGenRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    let isMounted = true;
    // Stamp this effect run. Any async work capturing this value will abort if
    // a newer generation (StrictMode re-run or agentName change) starts first.
    const mountGen = ++mountGenRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let fitRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let searchAddon: SearchAddon | null = null;

    const emitResize = (t: Terminal) => {
      onResizeRef.current?.(t.cols, t.rows);
    };

    const fitVisibleTerminal = () => {
      if (!term || !fitAddon || !containerRef.current) return false;

      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < MIN_FIT_WIDTH_PX || rect.height < MIN_FIT_HEIGHT_PX) return false;

      try {
        fitAddon.fit();
      } catch {
        return false;
      }

      emitResize(term);
      setTermLoaded(true);
      return true;
    };

    let retryCount = 0;
    const scheduleFit = () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (fitRetryTimer) {
        clearTimeout(fitRetryTimer);
        fitRetryTimer = null;
      }

      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = null;
          if (!isMounted) return;

          if (fitVisibleTerminal()) {
            return;
          }

          if (retryCount < 3) {
            retryCount++;
            fitRetryTimer = setTimeout(() => {
              if (isMounted) scheduleFit();
            }, FIT_RETRY_MS);
          }
        });
      });
    };
    let handleResizeEnd: (() => void) | null = null;
    async function mountTerminal() {
      if (!isMounted || !containerRef.current) return;
      await document.fonts.ready;
      // After the async checkpoint, verify this is still the active mount
      // generation. StrictMode cleanup + remount increments mountGenRef before
      // this continuation runs, so stale cycles self-abort here.
      if (!isMounted || !containerRef.current || mountGen !== mountGenRef.current) return;

      term = createTerminal(options);
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      searchAddon = new SearchAddon();
      term.loadAddon(searchAddon);

      // Load Unicode 11 Addon for accurate wide-character sizing (Nerd Font icon support)
      const unicodeAddon = new Unicode11Addon();
      term.loadAddon(unicodeAddon);
      term.unicode.activeVersion = "11";

      term.onData((data) => onDataRef.current?.(data));
      term.onBinary((data) => onBinaryRef.current?.(data));

      term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
        const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
        const isMac = /Mac|iPhone|iPad/.test(ua);
        const mod = isMac ? event.metaKey : event.ctrlKey;

        // Smart Copy on Selection interceptor
        if (event.type === "keydown" && mod && event.key.toLowerCase() === "c") {
          if (term && term.hasSelection()) {
            navigator.clipboard.writeText(term.getSelection());
            term.clearSelection();
            return false; // Handled, do not send to PTY
          }
        }

        if (mod && (event.key === "Backspace" || event.code === "Backspace")) {
          event.preventDefault();
          if (event.type === "keydown") onDataRef.current?.("\x17");
          return false;
        }

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

        if (event.ctrlKey && event.key === "c") return true;

        return onKeyRef.current?.(event) ?? true;
      });

      term.open(containerRef.current);

      tryAttachWebgl(term, isMountedRef, webglAddonRef);

      terminalRef.current = term;
      searchAddonRef.current = searchAddon;

      scheduleFit();

      const fitTerminal = () => {
        if (!isMounted) return;
        if (document.body.classList.contains('is-pane-resizing')) return;
        if (!fitVisibleTerminal()) return;
        if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
        resizeSettleTimer = setTimeout(() => emitResize(term!), 120);
      };

      handleResizeEnd = () => {
        if (!isMounted) return;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitTerminal, RESIZE_DEBOUNCE_MS);
      };
      window.addEventListener('terminal-layout-resize-end', handleResizeEnd);
      window.addEventListener("resize", handleResizeEnd);
      document.addEventListener("visibilitychange", handleResizeEnd);

      resizeObserver = new ResizeObserver(() => {
        if (document.body.classList.contains('is-pane-resizing')) return;
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitTerminal, RESIZE_DEBOUNCE_MS);
      });
      resizeObserver.observe(containerRef.current);
    }

    mountTerminal();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (handleResizeEnd) {
        window.removeEventListener('terminal-layout-resize-end', handleResizeEnd);
        window.removeEventListener("resize", handleResizeEnd);
        document.removeEventListener("visibilitychange", handleResizeEnd);
      }
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (fitRetryTimer) clearTimeout(fitRetryTimer);
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
