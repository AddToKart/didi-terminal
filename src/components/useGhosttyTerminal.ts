import { useEffect, useRef, useState } from "react";
import { init, Terminal, ITerminalOptions, FitAddon } from "ghostty-web";

let isWasmLoaded = false;
let wasmInitPromise: Promise<void> | null = null;

function loadWasm() {
  if (isWasmLoaded) return Promise.resolve();
  if (!wasmInitPromise) {
    wasmInitPromise = init().then(() => {
      isWasmLoaded = true;
    });
  }
  return wasmInitPromise;
}

interface UseGhosttyTerminalOptions extends ITerminalOptions {
  agentName: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onKey?: (e: KeyboardEvent) => boolean;
}

export function useGhosttyTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseGhosttyTerminalOptions
) {
  const terminalRef = useRef<Terminal | null>(null);
  const [termLoaded, setTermLoaded] = useState(false);
  const onDataRef = useRef(options.onData);
  const onResizeRef = useRef(options.onResize);
  const onKeyRef = useRef(options.onKey);

  onDataRef.current = options.onData;
  onResizeRef.current = options.onResize;
  onKeyRef.current = options.onKey;

  useEffect(() => {
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let isMounted = true;
    let resizeFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let lastResize: { cols: number; rows: number } | null = null;

    const emitResize = () => {
      if (!term || !onResizeRef.current || !term.cols || !term.rows) return;
      if (lastResize && lastResize.cols === term.cols && lastResize.rows === term.rows) return;

      lastResize = { cols: term.cols, rows: term.rows };
      onResizeRef.current(term.cols, term.rows);
    };

    async function mountTerminal() {
      await loadWasm();
      if (!isMounted || !containerRef.current) return;

      term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        cursorBlink: false,
        cursorStyle: 'block',
        fontSize: 13,
        allowTransparency: false,
        theme: {
          background: '#09090b',
          foreground: '#e2e8f0',
          cursor: '#00f0ff',
          selectionBackground: "#00f0ff40",
          ...options.theme,
        },
        ...options,
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      // Wait for any web fonts to load so the Canvas renderer measures character sizes correctly
      await document.fonts.ready;

      term.open(containerRef.current);
      terminalRef.current = term;

      if (term.renderer && 'remeasureFont' in term.renderer) {
        (term.renderer as any).remeasureFont();
      }

      term.onData((data) => onDataRef.current?.(data));

      term.attachCustomKeyEventHandler((event) => onKeyRef.current?.(event) ?? false);

      // Initial fit
      fitAddon.fit();
      emitResize();

      const fitTerminal = () => {
        resizeFrame = null;
        if (!term || !fitAddon) return;
        fitAddon.fit();
        emitResize();
      };

      resizeObserver = new ResizeObserver(() => {
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(fitTerminal);
      });
      resizeObserver.observe(containerRef.current);

      setTermLoaded(true);
    }

    mountTerminal();

    return () => {
      isMounted = false;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      if (resizeObserver) resizeObserver.disconnect();
      terminalRef.current = null;
      setTermLoaded(false);
      if (term) term.dispose();
    };
  }, [options.agentName]);

  return { terminal: terminalRef.current, isReady: termLoaded };
}
