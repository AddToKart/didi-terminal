import { useEffect, useRef, useState, MutableRefObject } from "react";
import { Terminal, ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { SearchAddon } from "@xterm/addon-search";
import "@xterm/xterm/css/xterm.css";

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
    scrollback: 5000,
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

  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let webglAddon: WebglAddon | null = null;
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
      term.attachCustomKeyEventHandler((event) => onKeyRef.current?.(event) ?? true);

      term.open(containerRef.current);

      try {
        webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon?.dispose();
          webglAddon = null;
        });
        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn("WebGL addon could not be loaded", e);
      }

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
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (resizeObserver) resizeObserver.disconnect();
      terminalRef.current = null;
      searchAddonRef.current = null;
      setTermLoaded(false);

      if (term) {
        try { term.dispose(); } catch (e) { console.error("Failed to dispose terminal", e); }
      }
    };
  }, [options.agentName]);

  const findNext = (text: string) => searchAddonRef.current?.findNext(text);
  const findPrevious = (text: string) => searchAddonRef.current?.findPrevious(text);

  return { terminal: terminalRef.current, search: { findNext, findPrevious }, isReady: termLoaded };
}
