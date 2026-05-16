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

interface PooledTerminal {
  id: number;
  term: Terminal;
  fitAddon: FitAddon;
  webglAddon: WebglAddon | null;
  searchAddon: SearchAddon;
  inUse: boolean;
  isOpened: boolean;
  onDataDisposable: { dispose: () => void } | null;
  onBinaryDisposable: { dispose: () => void } | null;
  onKeyDisposable: { dispose: () => void } | null;
}

const terminalPool: PooledTerminal[] = [];
let poolIdCounter = 0;

function getTerminalFromPool(): PooledTerminal {
  const available = terminalPool.find(p => !p.inUse);
  if (available) {
    available.inUse = true;
    return available;
  }
  
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

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  const searchAddon = new SearchAddon();
  term.loadAddon(searchAddon);

  let webglAddon: WebglAddon | null = null;

  const pooled: PooledTerminal = {
    id: ++poolIdCounter,
    term,
    fitAddon,
    webglAddon,
    searchAddon,
    inUse: true,
    isOpened: false,
    onDataDisposable: null,
    onBinaryDisposable: null,
    onKeyDisposable: null,
  };
  terminalPool.push(pooled);
  return pooled;
}

function releaseTerminalToPool(pooled: PooledTerminal) {
  pooled.inUse = false;
  try {
    pooled.term.reset(); // Fully reset the terminal instead of just clearing the viewport
  } catch (e) {
    console.error("Failed to reset terminal", e);
  }
  
  if (pooled.onDataDisposable) pooled.onDataDisposable.dispose();
  if (pooled.onBinaryDisposable) pooled.onBinaryDisposable.dispose();
  if (pooled.onKeyDisposable) pooled.onKeyDisposable.dispose();
  pooled.onDataDisposable = null;
  pooled.onBinaryDisposable = null;
  pooled.onKeyDisposable = null;

  if (pooled.term.element && pooled.term.element.parentElement) {
    pooled.term.element.parentElement.removeChild(pooled.term.element);
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

  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;

    const emitResize = (term: Terminal) => {
      options.onResize?.(term.cols, term.rows);
    };

    let pooled: PooledTerminal | null = null;

    async function mountTerminal() {
      if (!isMounted || !containerRef.current) return;
      await document.fonts.ready;
      if (!isMounted || !containerRef.current) return;

      pooled = getTerminalFromPool();
      
      pooled.onDataDisposable = pooled.term.onData((data) => onDataRef.current?.(data));
      pooled.onBinaryDisposable = pooled.term.onBinary((data) => onBinaryRef.current?.(data));
      pooled.term.attachCustomKeyEventHandler((event) => onKeyRef.current?.(event) ?? true);

      if (!pooled.isOpened) {
        pooled.term.open(containerRef.current);
        pooled.isOpened = true;
        try {
          pooled.webglAddon = new WebglAddon();
          pooled.webglAddon.onContextLoss(() => {
            pooled?.webglAddon?.dispose();
            if (pooled) pooled.webglAddon = null;
          });
          pooled.term.loadAddon(pooled.webglAddon);
        } catch (e) {
          console.warn("WebGL addon could not be loaded", e);
        }
      } else {
        if (pooled.term.element) {
          containerRef.current.appendChild(pooled.term.element);
        }
      }

      terminalRef.current = pooled.term;
      searchAddonRef.current = pooled.searchAddon;

      requestAnimationFrame(() => {
        if (!isMounted || !pooled) return;
        try { pooled.fitAddon.fit(); } catch (e) {}
        emitResize(pooled.term);
        setTermLoaded(true);
      });

      const fitTerminal = () => {
        if (!pooled) return;
        try { pooled.fitAddon.fit(); } catch { return; }
        if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
        resizeSettleTimer = setTimeout(() => emitResize(pooled!.term), 120);
      };

      let resizeTimeout: ReturnType<typeof setTimeout>;
      resizeObserver = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitTerminal, 50);
      });
      resizeObserver.observe(containerRef.current);
    }

    mountTerminal();

    return () => {
      isMounted = false;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      if (resizeObserver) resizeObserver.disconnect();
      terminalRef.current = null;
      searchAddonRef.current = null;
      setTermLoaded(false);
      
      if (pooled) {
        releaseTerminalToPool(pooled);
      }
    };
  }, [options.agentName]);

  const findNext = (text: string) => searchAddonRef.current?.findNext(text);
  const findPrevious = (text: string) => searchAddonRef.current?.findPrevious(text);

  return { terminal: terminalRef.current, search: { findNext, findPrevious }, isReady: termLoaded };
}
