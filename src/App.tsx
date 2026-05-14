import { TerminalInstance } from "./components/terminal/TerminalInstance";
import { OrchestratorApp } from "./components/layout/OrchestratorApp";
import { getStandaloneAgentParams } from "./services/standalone-agent";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
  const { standaloneAgent, standaloneCwd } = getStandaloneAgentParams();

  if (standaloneAgent) {
    return (
      <div className="h-screen w-screen bg-app-bg">
        <ErrorBoundary title="Terminal crashed">
          <TerminalInstance agentName={standaloneAgent} cwd={standaloneCwd} />
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <ErrorBoundary title="App crashed">
      <OrchestratorApp />
    </ErrorBoundary>
  );
}

export type { TerminalTab, SectionState, WorkspaceState } from "./types/workspace";

export default App;
