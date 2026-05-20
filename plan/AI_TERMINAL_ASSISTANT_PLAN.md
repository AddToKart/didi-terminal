# DidiTerminal — Local-First AI Assistant Plan

## Overview

This plan describes a focused AI assistant for DidiTerminal that helps with small but high-value terminal workflows, with local models as the primary path and cloud models as an optional fallback. The goal is not to build a generic chat product or a full coding copilot. The goal is to make DidiTerminal more useful as an agent workspace by adding an assistant that can explain, suggest, summarize, draft, and guide without getting in the user's way.

The assistant should feel native to DidiTerminal:

- It lives inside the terminal workflow instead of replacing it.
- It assists with practical tasks instead of producing long, vague conversations.
- It favors local inference for speed, privacy, and offline usefulness.
- It falls back to cloud models only when needed and only with explicit user intent.

## Product Goal

The product goal is to make DidiTerminal better at the small repetitive decisions that slow work down:

- drafting git commit messages
- suggesting next commands
- summarizing terminal output and errors
- proposing small task breakdowns
- explaining what a command will do before the user runs it
- helping route work to the right agent or terminal context
- turning short natural-language requests into actionable terminal help

The assistant should reduce friction, not add another surface to manage.

## Core Principles

### Local-First

Local models are the default path for all routine assistance. If the machine can answer fast enough with a local model, the assistant should not ask the cloud.

### Contextual, Not Chatty

The assistant should respond to the current terminal state, current workspace, current git status, or current agent activity. It should not behave like a general-purpose chatbot unless the user explicitly asks for that mode.

### Safe by Default

The assistant should avoid auto-running destructive actions. It can suggest commands, draft messages, and summarize state, but dangerous operations should always require confirmation.

### Small, Reliable Outputs

For most tasks, the best response is short:

- one commit message suggestion
- one command suggestion
- one concise explanation
- one next step

### Model Agnostic

The assistant should not depend on one provider. It should be able to use a local model first and a cloud provider second through a unified interface.

## Primary Use Cases

### 1. Git Commit Message Completion

The assistant drafts clear commit messages based on the current diff, staged files, or a selected change set.

Expected behavior:

- generate a short title and an optional body
- support conventional commit style when appropriate
- summarize the real intent of the diff instead of restating filenames
- offer a few alternates only when the user asks for them

### 2. Command Suggestion

The assistant suggests shell commands for common terminal tasks.

Examples:

- listing logs for the current session
- checking git status
- running the next obvious build or test command
- suggesting a safe follow-up command after an error

Expected behavior:

- explain the command in one line
- warn when the command has side effects
- avoid chaining risky commands together

### 3. Terminal Output Summarization

The assistant interprets terminal output, build failures, stack traces, and long logs.

Expected behavior:

- identify the likely cause of an error
- extract the first actionable fix
- separate signal from noise
- produce a short summary suitable for an agent handoff

### 4. Task Suggestion and Planning

The assistant turns broad user requests into a few actionable steps.

Examples:

- break a feature request into implementation steps
- propose the next best action when a session is stuck
- suggest what to inspect first after a build failure

Expected behavior:

- keep plans short and concrete
- respect the existing DidiTerminal agent workflow
- avoid replacing the built-in orchestration system

### 5. Explain-What-This-Does

The assistant explains commands, files, or output in plain language.

Expected behavior:

- useful for new users and quick refreshers
- no long lectures
- highlight risks and side effects when relevant

### 6. Lightweight Workspace Guidance

The assistant helps users find the right place to work inside DidiTerminal.

Examples:

- which panel to use for a task
- whether a task belongs in a terminal, snapshot, or agent handoff
- whether the user should start with local work or cloud escalation

## Non-Goals

The assistant should not attempt to be:

- a full chat platform
- a general internet research assistant
- a replacement for the existing agent orchestration system
- a full autonomous coding agent that edits everything without review
- a remote sync layer for sensitive data by default

The assistant should also not become a second opinion machine that says a lot without taking responsibility for a concrete next step.

## Assistant Modes

### Quick Assist Mode

This is the default mode. It is optimized for short responses and low latency.

Good for:

- commit messages
- command suggestions
- quick explanations
- error summaries

### Context Assist Mode

This mode uses more workspace context when the question needs it.

Good for:

- summarizing a failure across multiple files
- explaining a workflow issue
- suggesting a better next step based on current app state

### Cloud Assist Mode

This mode is optional and explicit. It is used only when local inference is not enough or when the user chooses a higher-quality external model.

Good for:

- harder reasoning tasks
- verbose rewrite requests
- complex multi-step planning

## Model Strategy

### Priority Order

1. Local model
2. Local model with larger context or slower settings
3. Cloud fallback when explicitly allowed or clearly needed

### Selection Rules

The assistant should route requests using simple rules:

- routine terminal help goes to local
- private workspace context stays local whenever possible
- requests that need broader reasoning can escalate to cloud with user approval
- fallback should be transparent so the user always knows where the response came from

### Provider Abstraction

The assistant should use a provider interface so the application can swap models without rewriting the user experience.

The interface should support:

- prompt submission
- streaming response tokens
- cancellation
- model selection
- cost or latency metadata
- context size limits

## Architecture Overview

The assistant should be treated as a feature layer built on top of the existing DidiTerminal services, not as a separate app.

### Core Components

- **Assistant UI** — the user-facing entry point inside the app
- **Context Collector** — gathers workspace, git, terminal, and agent state
- **Prompt Router** — decides whether the request should be answered locally or escalated
- **Model Provider Layer** — local and cloud inference adapters
- **Action Suggestion Layer** — formats commands, commit messages, and next-step guidance
- **Safety Layer** — blocks unsafe automatic actions and flags risky suggestions
- **History Layer** — stores recent requests, approved suggestions, and useful context

### Data Flow

1. The user asks for help.
2. The assistant identifies the request type.
3. The context collector gathers only the minimum needed state.
4. The router chooses a local or cloud model.
5. The model returns a suggestion.
6. The safety layer checks it.
7. The UI presents the result in a compact, actionable form.

## Context Sources

The assistant should use existing DidiTerminal data sources where possible:

- current git diff and status
- active workspace path
- selected file or terminal output
- recent terminal lines
- agent queue and task state
- snapshots and Sentinel status when relevant

The assistant should avoid collecting unrelated data. Context should be request-scoped, not everything all the time.

## UX Plan

### Entry Points

The assistant should be available from a few predictable places:

- a terminal toolbar action
- a sidebar assistant panel
- a command palette action
- inline actions on git diff or error output

### Interaction Style

The UI should default to compact responses.

Examples:

- commit message suggestion with copy button
- command suggestion with explanation and safe-run toggle
- error summary with likely cause and next step
- small list of suggested follow-up actions

### Response Presentation

Responses should have a consistent structure:

- short answer first
- optional explanation below
- action buttons when relevant
- clear warning when the suggestion is unsafe or uncertain

### Good Mobile/Small Window Behavior

Even though this plan is desktop-first, the assistant UI should still degrade well in narrow layouts:

- stacked actions instead of wide panels
- short summaries instead of dense cards
- no reliance on hover-only controls

## Safety and Guardrails

### No Silent Execution

The assistant may suggest commands, but it should not run potentially destructive operations automatically.

### Risk Detection

The assistant should flag commands that:

- delete files
- rewrite history
- modify secrets
- send data externally
- trigger wide-ranging package updates
- change database state

### Confirmation Rules

High-risk actions should require a user confirm step before execution.

### Secret Handling

The assistant should not request or echo secrets unless the user explicitly pastes them into a secure input flow. Sensitive data should be excluded from cloud routing unless the user explicitly chooses that path.

### Hallucination Control

When the assistant is unsure, it should say so and ask for a narrower target instead of guessing.

## Local Model Requirements

The local model must be able to handle the following well enough to be useful:

- short instruction following
- command explanation
- diff summarization
- commit message drafting
- small planning tasks

A smaller local model can still be valuable if the product keeps the responses concise and task-specific.

## Cloud Fallback Policy

Cloud fallback should be optional and explicit.

Use cloud only when:

- the local model is unavailable
- the request is too large for the local model
- the user asks for a stronger model
- the request clearly benefits from broader reasoning

Cloud usage should preserve the same assistant behavior and output style so the UX does not change when the provider changes.

## Suggested Implementation Phases

### Phase 1 — Define the Assistant Shape

- decide the supported tasks for v1
- define the assistant UI entry points
- define what local context can be used safely
- define the model routing rules
- define what should never be automated

### Phase 2 — Local-Only MVP

- support commit message drafting
- support command suggestions
- support terminal output summaries
- support basic workspace explanation
- keep all requests local

### Phase 3 — Context-Aware Assistance

- add git diff awareness
- add terminal output attachment
- add workspace file awareness
- add agent state awareness when helpful
- add richer error interpretation

### Phase 4 — Optional Cloud Escalation

- add cloud provider adapter
- add user consent for escalation
- add fallback routing when local is insufficient
- keep response formatting identical between providers

### Phase 5 — Safety, Memory, and Refinement

- add approval flow for risky commands
- add response history for repeated tasks
- add telemetry for usefulness and latency
- tune prompts and routing based on real usage

## Success Criteria

The assistant is worth keeping if it consistently does the following:

- saves time on small terminal decisions
- produces useful commit messages with minimal editing
- explains errors accurately enough to act on quickly
- avoids noisy or long-winded answers
- stays fast when local
- uses cloud sparingly
- never becomes a source of accidental damage

## Risks

### Scope Creep

The biggest risk is expanding from a small assistant into a broad AI platform. The scope must stay anchored to practical terminal help.

### Latency

If the assistant feels slow, users will ignore it. This is why local-first matters.

### Unclear Boundaries

If the assistant tries to do too much automatically, trust will drop. Suggestions should stay separate from execution.

### Weak Context Routing

If the assistant grabs too much or too little context, responses will be noisy or inaccurate. Context collection should stay request-driven.

### Cloud Dependence

If the product only works well when cloud access is available, it will not feel like a real DidiTerminal feature. Local quality needs to be good enough on its own.

## Rollout Recommendation

Start with a small assistant that is obviously useful and easy to trust.

Recommended first release:

- commit message drafts
- command explanations
- command suggestions
- terminal error summaries
- one-button copy actions

Do not start with a giant conversation history system or autonomous agent control. Earn trust with simple help first, then expand only where users repeatedly ask for more.

## Final Position

Yes, this idea is beneficial for DidiTerminal if it is built as a focused local-first assistant rather than a general chatbot. The assistant should improve existing terminal and agent workflows, not replace them. If it stays narrow, fast, and safe, it can become one of the most valuable features in the product.
