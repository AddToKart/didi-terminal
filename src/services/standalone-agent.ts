export interface StandaloneAgentParams {
  standaloneAgent: string | null;
  standaloneCwd: string | null;
}

export const getStandaloneAgentParams = (): StandaloneAgentParams => {
  const params = new URLSearchParams(window.location.search);
  return {
    standaloneAgent: params.get("agent"),
    standaloneCwd: params.get("cwd") || localStorage.getItem("didi_project"),
  };
};
