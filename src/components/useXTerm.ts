import { useEffect, useRef, useState, MutableRefObject } from "react";
import { Terminal, ITerminalOptions } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

export interface UseXTermOptions extends ITerminalOptions {
  agentName: string;
  onData?: (data: string) => void;
  onBinary?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onKey?: (event: KeyboardEvent) => boolean;
}

export function useXTerm(
  containerRef: MutableRefObject<HTMLElement | null>,
  options: UseXTermOptions
) {
  const [termLoaded, setTermLoaded] = useState(false);
  const terminalRef = useRef<Terminal | null>(null);
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
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let webglAddon: WebglAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    let resizeSettleTimer: ReturnType<typeof setTimeout> | null = null;

    const emitResize = () => {
      if (term) {
        options.onResize?.(term.cols, term.rows);
      }
    };

    function mountTerminal() {
      if (!isMounted || !containerRef.current) return;

      const terminalOptions: ITerminalOptions = { ...options };
      delete (terminalOptions as any).agentName;

      term = new Terminal({
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        cursorBlink: false,
        cursorStyle: 'block',
        fontSize: 13,
        scrollback: 100000,
        allowTransparency: true,
        ...terminalOptions,
        theme: {
          background: '#09090b',
          foreground: '#e2e8f0',
          cursor: '#00f0ff',
          selectionBackground: "#00f0ff40",
          ...terminalOptions.theme,
        },
      });

      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      term.open(containerRef.current);
      
      try {
        webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon?.dispose();
        });
        term.loadAddon(webglAddon);
      } catch (e) {
        console.warn("WebGL addon could not be loaded, falling back to canvas/dom", e);
      }

      terminalRef.current = term;

      term.onData((data) => onDataRef.current?.(data));
      term.onBinary((data) => onBinaryRef.current?.(data));

      term.attachCustomKeyEventHandler((event) => onKeyRef.current?.(event) ?? false);

      // Initial fit
      try {
        fitAddon.fit();
      } catch (e) {
        // Ignore fit error on unmounted container
      }
      emitResize();

      const fitTerminal = () => {
        resizeFrame = null;
        if (!term || !fitAddon) return;
        try {
          fitAddon.fit();
        } catch {
          return;
        }

        if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
        resizeSettleTimer = setTimeout(emitResize, 120);
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
      if (resizeSettleTimer) clearTimeout(resizeSettleTimer);
      if (resizeObserver) resizeObserver.disconnect();
      terminalRef.current = null;
      setTermLoaded(false);
      try {
        if (webglAddon) webglAddon.dispose();
      } catch {}
      try {
        if (fitAddon) fitAddon.dispose();
      } catch {}
      try {
        if (term) term.dispose();
      } catch {}
    };
  }, [options.agentName]);

  return { terminal: terminalRef.current, isReady: termLoaded };
}
