import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Terminal } from "@xterm/xterm";
import {
  ROOT_TERMINAL_LANE_ID,
  clearTerminalLanes,
  getTerminalLanePtyKey,
  loadTerminalLanes,
  saveTerminalLanes,
  type TerminalLane,
} from "@/services/terminal-lanes";
import { getNextLaneIndex, getPtyEventKey } from "./terminal-helpers";

interface UseTerminalLanesProps {
  agentId: string;
  agentName: string;
  workspaceId?: string;
  setReadyState: (ready: boolean) => void;
  terminalApiRef: React.MutableRefObject<Terminal | null>;
  onRemove?: () => void;
}

export function useTerminalLanes({
  agentId,
  agentName,
  workspaceId,
  setReadyState,
  terminalApiRef,
  onRemove,
}: UseTerminalLanesProps) {
  const [lanes, setLanes] = useState<TerminalLane[]>(() => loadTerminalLanes(agentId, workspaceId));
  const [activeLaneId, setActiveLaneId] = useState(ROOT_TERMINAL_LANE_ID);
  const [editingLaneId, setEditingLaneId] = useState<string | null>(null);
  const [editLaneLabel, setEditLaneLabel] = useState("");
  const lanesRef = useRef(lanes);

  const activeLane = lanes.find((lane) => lane.id === activeLaneId) ??
    lanes[0] ?? { id: ROOT_TERMINAL_LANE_ID, label: "Main", agentName: agentId };

  const getLanePtyKey = useCallback(
    (laneAgentId: string) => {
      return getTerminalLanePtyKey(workspaceId, laneAgentId);
    },
    [workspaceId]
  );

  const ptyKey = getLanePtyKey(activeLane.agentName);

  const handleSelectShell = useCallback(
    async (shellCommand: string) => {
      const updatedLanes = lanesRef.current.map((lane) => {
        if (lane.id === activeLaneId) {
          return { ...lane, shell: shellCommand || undefined };
        }
        return lane;
      });
      setLanes(updatedLanes);
      saveTerminalLanes(agentId, workspaceId, updatedLanes);

      try {
        await invoke("close_pty", { agent: ptyKey });
      } catch (error) {
        console.warn("Failed to close PTY:", error);
      }

      setReadyState(false);
      if (terminalApiRef.current) {
        terminalApiRef.current.reset();
        terminalApiRef.current.write("\r\n\x1b[33mSpawning new shell...\x1b[0m\r\n");
      }
    },
    [activeLaneId, ptyKey, agentId, workspaceId, setReadyState, terminalApiRef]
  );

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    const restoredLanes = loadTerminalLanes(agentId, workspaceId);
    setLanes(restoredLanes);
    setActiveLaneId(ROOT_TERMINAL_LANE_ID);
    setEditingLaneId(null);
    setEditLaneLabel("");
  }, [agentId, workspaceId]);

  useEffect(() => {
    saveTerminalLanes(agentId, workspaceId, lanes);
  }, [agentId, workspaceId, lanes]);

  useEffect(() => {
    const unlistenPromise = listen<{ agentId: string; selectLaneId?: string }>("lanes-changed", (event) => {
      const { agentId: changedAgentId, selectLaneId } = event.payload;
      if (changedAgentId === agentId) {
        const restoredLanes = loadTerminalLanes(agentId, workspaceId);
        setLanes(restoredLanes);
        if (selectLaneId) {
          setActiveLaneId(selectLaneId);
        }
      }
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [agentId, workspaceId]);

  const handleSelectLane = useCallback(
    (laneId: string) => {
      if (laneId === activeLaneId) return;
      setActiveLaneId(laneId);
    },
    [activeLaneId]
  );

  const handleAddLane = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const nextIndex = getNextLaneIndex(lanesRef.current);

      const laneId = crypto.randomUUID();
      const lane: TerminalLane = {
        id: laneId,
        label: `Lane ${nextIndex}`,
        agentName: `${agentId}::lane::${laneId}`,
      };

      setLanes((prev) => [...prev, lane]);
      setActiveLaneId(lane.id);
    },
    [agentId]
  );

  const handleCloseLane = useCallback(
    (event: React.MouseEvent, laneId: string) => {
      event.stopPropagation();
      const currentLanes = lanesRef.current;
      const laneIndex = currentLanes.findIndex((lane) => lane.id === laneId);
      const lane = currentLanes[laneIndex];
      if (!lane || lane.id === ROOT_TERMINAL_LANE_ID) return;

      invoke("close_pty", { agent: getLanePtyKey(lane.agentName) }).catch(console.error);
      setLanes((prev) => prev.filter((item) => item.id !== laneId));

      if (laneId === activeLaneId) {
        const fallbackLane = currentLanes[laneIndex - 1] ?? currentLanes[0];
        setActiveLaneId(fallbackLane.id);
        setReadyState(false);
      }
    },
    [activeLaneId, getLanePtyKey, setReadyState]
  );

  const closeExtraLanes = useCallback(() => {
    for (const lane of lanesRef.current) {
      if (lane.id === ROOT_TERMINAL_LANE_ID) continue;
      invoke("close_pty", { agent: getLanePtyKey(lane.agentName) }).catch(console.error);
    }
    clearTerminalLanes(agentName, workspaceId);
  }, [agentName, getLanePtyKey, workspaceId]);

  const handleRemovePane = useCallback(() => {
    closeExtraLanes();
    onRemove?.();
  }, [closeExtraLanes, onRemove]);

  const handleStartRenameLane = useCallback((lane: TerminalLane) => {
    setEditingLaneId(lane.id);
    setEditLaneLabel(lane.label);
  }, []);

  const handleCommitRenameLane = useCallback(() => {
    if (!editingLaneId) return;
    const nextLabel = editLaneLabel.trim();
    if (!nextLabel) {
      setEditingLaneId(null);
      return;
    }

    setLanes((prev) =>
      prev.map((lane) => (lane.id === editingLaneId ? { ...lane, label: nextLabel } : lane))
    );
    setEditingLaneId(null);
  }, [editLaneLabel, editingLaneId]);

  const handleCancelRenameLane = useCallback(() => {
    setEditingLaneId(null);
    setEditLaneLabel("");
  }, []);

  return {
    lanes,
    activeLaneId,
    activeLane,
    editingLaneId,
    editLaneLabel,
    setEditLaneLabel,
    ptyKey,
    ptyEventKey: getPtyEventKey(ptyKey),
    handleSelectShell,
    handleSelectLane,
    handleAddLane,
    handleCloseLane,
    handleRemovePane,
    handleStartRenameLane,
    handleCommitRenameLane,
    handleCancelRenameLane,
  };
}
