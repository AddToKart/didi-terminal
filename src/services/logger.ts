import { useOrchestrationStore } from "./stores/orchestration-store";

let logIdCounter = 1;

export function addLog(message: string, type: "system" | "handoff" = "system") {
  const setActivity = useOrchestrationStore.getState().setActivity;
  setActivity((prev) => {
    const newLog = {
      id: logIdCounter++,
      time: new Date().toLocaleTimeString(),
      message,
      type,
    };
    return [newLog, ...prev].slice(0, 50);
  });
}
