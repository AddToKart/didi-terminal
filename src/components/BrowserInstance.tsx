import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, RotateCcw, ArrowLeft, ArrowRight, ExternalLink, Globe, Loader2 } from "lucide-react";

interface BrowserInstanceProps {
  id: string; // unique pane id to track the child webview
  url?: string;
  onRemove: () => void;
  dragAttributes?: any;
  dragListeners?: any;
}

export function BrowserInstance({ id, url: initialUrl = "", onRemove, dragAttributes, dragListeners }: BrowserInstanceProps) {
  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewId = `browser-${id}`;

  const getFullUrl = (raw: string) => {
    if (!raw || raw.trim() === "") return "";
    const trimmed = raw.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return "https://" + trimmed;
  };

  const openView = useCallback(async (targetUrl: string) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setIsLoading(true);
    try {
      await invoke("open_browser_view", { 
        id: viewId, 
        url: targetUrl, 
        x: rect.left, 
        y: rect.top, 
        w: rect.width, 
        h: rect.height 
      });
      setIsViewOpen(true);
    } catch (e) {
      console.error("Failed to open browser view:", e);
    } finally {
      setIsLoading(false);
    }
  }, [viewId]);

  const updateBounds = useCallback(async () => {
    if (!containerRef.current || !isViewOpen) return;
    const rect = containerRef.current.getBoundingClientRect();
    try {
      await invoke("update_browser_bounds", {
        id: viewId,
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
      });
    } catch (e) {
      // Silently ignore if view isn't open yet
    }
  }, [viewId, isViewOpen]);

  // Observe resize of the container to keep the webview in sync
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => updateBounds());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateBounds]);

  // Close the child webview on unmount
  useEffect(() => {
    return () => {
      invoke("close_browser_view", { id: viewId }).catch(() => {});
    };
  }, [viewId]);

  const handleGo = async (e: React.FormEvent) => {
    e.preventDefault();
    const full = getFullUrl(inputValue);
    if (!full) return;
    setUrl(full);
    setInputValue(full);

    if (isViewOpen) {
      setIsLoading(true);
      try {
        await invoke("navigate_browser_view", { id: viewId, url: full });
      } catch (e) {
        console.error("Navigate failed:", e);
      } finally {
        setIsLoading(false);
      }
    } else {
      await openView(full);
    }
  };

  const handleRemove = async () => {
    await invoke("close_browser_view", { id: viewId }).catch(() => {});
    onRemove();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#020202] text-zinc-300 font-sans border border-app-border rounded-lg overflow-hidden">
      {/* Header / URL Bar */}
      <div
        className="h-9 flex items-center gap-2 px-3 bg-[#0d0d0f] border-b border-app-border shrink-0 select-none cursor-grab active:cursor-grabbing"
        {...dragAttributes}
        {...dragListeners}
      >
        <div className="flex items-center gap-1.5 text-zinc-500 shrink-0">
          <Globe size={14} className="text-brand-primary" />
          <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">Browser</span>
        </div>

        <div className="flex items-center gap-1 px-2 border-l border-zinc-800 ml-1 shrink-0">
          <button className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="Back">
            <ArrowLeft size={14} />
          </button>
          <button className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300" title="Forward">
            <ArrowRight size={14} />
          </button>
          <button
            onClick={() => { if (url) openView(url); }}
            className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-zinc-300"
            title="Refresh"
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
          </button>
        </div>

        <form onSubmit={handleGo} className="flex-1 min-w-0 h-6">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-full h-full bg-[#050505] border border-zinc-800 rounded px-3 text-[11px] text-zinc-400 focus:outline-none focus:border-brand-primary/50 focus:text-zinc-200 transition-all font-mono"
            placeholder="Enter a URL and press Enter..."
          />
        </form>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => url && window.open(url, "_blank")}
            className="p-1.5 hover:bg-zinc-800 rounded-md transition-all text-zinc-500 hover:text-zinc-300"
            title="Open in system browser"
          >
            <ExternalLink size={14} />
          </button>
          <button
            onClick={handleRemove}
            className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all text-zinc-500"
            title="Close Browser"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content placeholder — Tauri child webview renders here */}
      <div ref={containerRef} className="flex-1 relative bg-[#0a0a0a] overflow-hidden">
        {!isViewOpen && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-600">
            <Globe size={40} className="opacity-20" />
            <p className="text-xs font-mono">Type a URL above and press Enter</p>
          </div>
        )}
        {isLoading && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-4 px-2 flex items-center bg-[#050505] border-t border-app-border text-[9px] text-zinc-600 font-mono italic justify-between">
        <span>{url || "No URL"}</span>
        {isViewOpen && <span className="text-green-600/60">● Live</span>}
      </div>
    </div>
  );
}
