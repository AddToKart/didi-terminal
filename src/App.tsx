import { TerminalInstance } from "./components/terminal/TerminalInstance";
import { OrchestratorApp } from "./components/layout/OrchestratorApp";
import { getStandaloneAgentParams } from "./services/standalone-agent";

function App() {
  const { standaloneAgent, standaloneCwd } = getStandaloneAgentParams();

  if (standaloneAgent) {
    return (
      <div className="h-screen w-screen bg-app-bg">
        <TerminalInstance agentName={standaloneAgent} cwd={standaloneCwd} />
      </div>
    );
  }

  return <OrchestratorApp />;
}

export type { TerminalTab, SectionState, WorkspaceState } from "./types/workspace";

export default App;
