import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getAgentId } from "./terminal-helpers";

interface UseTerminalEventsProps {
  agentName: string;
  ptyKey: string;
  ptyEventKey: string;
  setReadyState: (ready: boolean) => void;
}

export function useTerminalEvents({
  agentName,
  ptyKey,
  ptyEventKey,
  setReadyState,
}: UseTerminalEventsProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [sentinelPaused, setSentinelPaused] = useState(false);

  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unlistenHandoff = listen<{ target: string; payload: string }>("agent-handoff", (event) => {
      if (getAgentId(event.payload.target) === getAgentId(agentName)) {
        setReadyState(false);
        setIsPulsing(true);
        if (pulseTimeoutRef.current) {
          clearTimeout(pulseTimeoutRef.current);
        }
        pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 3000);
      }
    });

    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
      unlistenHandoff.then((f) => f());
    };
  }, [agentName, setReadyState]);

  useEffect(() => {
    const unlistenExit = listen<{ agent: string }>(`pty-exit-agent-${ptyEventKey}`, (event) => {
      if (event.payload.agent !== ptyKey) return;
      setReadyState(false);
    });

    return () => {
      unlistenExit.then((f) => f());
    };
  }, [ptyKey, ptyEventKey, setReadyState]);

  useEffect(() => {
    const unlistenSentinel = listen<{ agent: string }>("sentinel-intervention", (event) => {
      if (getAgentId(event.payload.agent) !== getAgentId(agentName)) return;
      setSentinelPaused(true);
      setReadyState(false);
      if (sentinelTimeoutRef.current) {
        clearTimeout(sentinelTimeoutRef.current);
      }
      sentinelTimeoutRef.current = setTimeout(() => setSentinelPaused(false), 7000);
    });

    return () => {
      if (sentinelTimeoutRef.current) {
        clearTimeout(sentinelTimeoutRef.current);
        sentinelTimeoutRef.current = null;
      }
      unlistenSentinel.then((f) => f());
    };
  }, [agentName, setReadyState]);

  return {
    isPulsing,
    sentinelPaused,
  };
}
