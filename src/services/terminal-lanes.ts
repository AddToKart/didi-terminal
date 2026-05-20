export interface TerminalLane {
  id: string;
  label: string;
  agentName: string;
  shell?: string;
}

export const ROOT_TERMINAL_LANE_ID = "main";

export const createRootTerminalLane = (agentName: string): TerminalLane => ({
  id: ROOT_TERMINAL_LANE_ID,
  label: "Main",
  agentName,
});

export const getTerminalLanePtyKey = (workspaceId: string | undefined | null, laneAgentName: string) => {
  return workspaceId ? `${workspaceId}::${laneAgentName}`.toLowerCase() : laneAgentName.toLowerCase();
};

const getTerminalLaneStorageKey = (workspaceId: string | undefined | null, agentName: string) => {
  const workspaceKey = workspaceId || "standalone";
  return `didi_terminal_lanes:${workspaceKey}:${agentName.trim().toLowerCase()}`;
};

const isTerminalLane = (value: unknown): value is TerminalLane => {
  if (!value || typeof value !== "object") return false;
  const lane = value as TerminalLane;
  return (
    typeof lane.id === "string" &&
    typeof lane.label === "string" &&
    typeof lane.agentName === "string" &&
    (lane.shell === undefined || typeof lane.shell === "string")
  );
};

export const loadStoredTerminalLanes = (agentName: string, workspaceId?: string | null): TerminalLane[] | null => {
  try {
    const raw = localStorage.getItem(getTerminalLaneStorageKey(workspaceId, agentName));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const lanes = parsed.filter(isTerminalLane);
    if (lanes.length === 0) return null;

    const storedRoot = lanes.find(lane => lane.id === ROOT_TERMINAL_LANE_ID);
    const rootLane = {
      ...createRootTerminalLane(agentName),
      label: storedRoot?.label?.trim() || "Main",
      shell: storedRoot?.shell,
    };

    return [
      rootLane,
      ...lanes.filter(lane => lane.id !== ROOT_TERMINAL_LANE_ID),
    ];
  } catch {
    return null;
  }
};

export const loadTerminalLanes = (agentName: string, workspaceId?: string | null): TerminalLane[] => {
  return loadStoredTerminalLanes(agentName, workspaceId) ?? [createRootTerminalLane(agentName)];
};

export const saveTerminalLanes = (agentName: string, workspaceId: string | undefined | null, lanes: TerminalLane[]) => {
  try {
    const currentRoot = lanes.find(lane => lane.id === ROOT_TERMINAL_LANE_ID);
    const normalizedLanes = [
      {
        ...createRootTerminalLane(agentName),
        label: currentRoot?.label?.trim() || "Main",
        shell: currentRoot?.shell,
      },
      ...lanes.filter(lane => lane.id !== ROOT_TERMINAL_LANE_ID),
    ];
    localStorage.setItem(getTerminalLaneStorageKey(workspaceId, agentName), JSON.stringify(normalizedLanes));
  } catch {
    // localStorage can be unavailable in restricted contexts; lanes still work for this session.
  }
};

export const clearTerminalLanes = (agentName: string, workspaceId?: string | null) => {
  try {
    localStorage.removeItem(getTerminalLaneStorageKey(workspaceId, agentName));
  } catch {
    // Ignore storage cleanup failures.
  }
};
