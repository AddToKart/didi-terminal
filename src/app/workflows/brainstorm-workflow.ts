import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import {
  BRAINSTORM_CALLBACK_TARGET,
  getAgentId,
  type BrainstormResponsePayload,
} from "../../services/app-core";
import type { BrainstormSession } from "../../components/BrainstormModal";

interface CreateBrainstormWorkflowOptions {
  currentProjectRef: MutableRefObject<string | null>;
  brainstormSessionsRef: MutableRefObject<BrainstormSession[]>;
  setBrainstormSessions: Dispatch<SetStateAction<BrainstormSession[]>>;
  addLog: (message: string, type?: "system" | "handoff") => void;
}

export const createBrainstormWorkflow = ({
  currentProjectRef,
  brainstormSessionsRef,
  setBrainstormSessions,
  addLog,
}: CreateBrainstormWorkflowOptions) => {
  const sendBrainstormRound = async (session: BrainstormSession, round: number) => {
    const previousResponses = session.responses
      .filter(response => response.round < round)
      .map(response => `${response.agent}: ${response.text}`)
      .join(" ");

    await Promise.all(session.participants.map(participant => emit("agent-handoff", {
      target: participant,
      sender: "Brainstorm",
      kind: "task",
      taskId: `${session.id}-r${round}-${getAgentId(participant)}`,
      payload: [
        `[Brainstorm round ${round}/${session.turns}] ${session.prompt}`,
        previousResponses ? `Previous responses: ${previousResponses}` : "",
        `Respond with your position and one concrete recommendation, then run exactly: .didi\\delegate ${BRAINSTORM_CALLBACK_TARGET} "Brainstorm response ${session.id} round ${round}: <your concise response without quotation marks>"`,
      ].filter(Boolean).join(" "),
    })));
  };

  const finishBrainstorm = async (session: BrainstormSession) => {
    const transcript = session.responses
      .map(response => `- ${response.agent} (round ${response.round}): ${response.text}`)
      .join("\n");

    let consensus = transcript;
    try {
      consensus = await invoke<string>("ask_llm", {
        system: "You convert multi-agent debate notes into a concise implementation plan. Return bullets only.",
        prompt: `Problem: ${session.prompt}\n\nResponses:\n${transcript}`,
      });
    } catch (err) {
      console.warn("Consensus synthesis failed; using raw brainstorm transcript", err);
    }

    const body = [
      `Prompt: ${session.prompt}`,
      "",
      "### Consensus",
      consensus,
      "",
      "### Participants",
      session.participants.map(agent => `- ${agent}`).join("\n"),
    ].join("\n");

    if (currentProjectRef.current) {
      try {
        await invoke("append_master_plan_entry", {
          cwd: currentProjectRef.current,
          title: `Brainstorm Consensus ${new Date().toLocaleString()}`,
          body,
        });
        addLog("Brainstorm consensus appended to MASTER_PLAN.md", "system");
      } catch (err) {
        addLog(`Brainstorm consensus save failed: ${err}`, "system");
      }
    } else {
      addLog("Brainstorm consensus ready; select a workspace to write MASTER_PLAN.md", "system");
    }

    const completedSessions: BrainstormSession[] = brainstormSessionsRef.current.map(item => (
      item.id === session.id ? { ...item, status: "complete" as const } : item
    ));
    brainstormSessionsRef.current = completedSessions;
    setBrainstormSessions(completedSessions);
  };

  const recordBrainstormResponse = async (
    agent: string,
    response: BrainstormResponsePayload
  ) => {
    const session = brainstormSessionsRef.current.find(item => item.id === response.sessionId);
    if (!session || session.status === "complete") return;

    const cleanAgent = agent.trim() || "Agent";
    const isParticipant = session.participants.some(participant => getAgentId(participant) === getAgentId(cleanAgent));
    if (!isParticipant) return;

    const alreadyRecorded = session.responses.some(item =>
      getAgentId(item.agent) === getAgentId(cleanAgent) && item.round === response.round
    );
    if (alreadyRecorded) return;

    const nextSession: BrainstormSession = {
      ...session,
      responses: [
        ...session.responses,
        {
          agent: cleanAgent,
          round: response.round,
          text: response.text,
          at: new Date().toLocaleTimeString(),
        },
      ],
    };

    const nextSessions = brainstormSessionsRef.current.map(item =>
      item.id === nextSession.id ? nextSession : item
    );
    brainstormSessionsRef.current = nextSessions;
    setBrainstormSessions(nextSessions);
    addLog(`Brainstorm response from ${cleanAgent}`, "handoff");

    const roundResponders = new Set(
      nextSession.responses
        .filter(item => item.round === nextSession.round)
        .map(item => getAgentId(item.agent))
    );
    const participantIds = nextSession.participants.map(getAgentId);
    const roundComplete = participantIds.every(id => roundResponders.has(id));
    if (!roundComplete) return;

    if (nextSession.round < nextSession.turns) {
      const advancedSession = { ...nextSession, round: nextSession.round + 1 };
      const advancedSessions = brainstormSessionsRef.current.map(item =>
        item.id === advancedSession.id ? advancedSession : item
      );
      brainstormSessionsRef.current = advancedSessions;
      setBrainstormSessions(advancedSessions);
      addLog(`Brainstorm advancing to round ${advancedSession.round}`, "system");
      await sendBrainstormRound(advancedSession, advancedSession.round);
      return;
    }

    await finishBrainstorm(nextSession);
  };

  const handleStartBrainstorm = async (prompt: string, participants: string[], turns: number) => {
    const session: BrainstormSession = {
      id: `bs-${Date.now().toString(36)}`,
      prompt,
      participants,
      turns,
      round: 1,
      status: "collecting",
      responses: [],
    };
    const nextSessions = [session, ...brainstormSessionsRef.current].slice(0, 8);
    brainstormSessionsRef.current = nextSessions;
    setBrainstormSessions(nextSessions);
    addLog(`Brainstorm started with ${participants.length} agents`, "system");
    await sendBrainstormRound(session, 1);
  };

  return {
    recordBrainstormResponse,
    handleStartBrainstorm,
  };
};
