# Run spec incorporation in an isolated subagent

- ID: subagent-incorporation
- Created: 2026-06-15T00:00:00.000Z
- Target: spec/technical-spec.md
- Status: incorporated by this session

## Diff

Change the spec-management extension so the agent that incorporates recorded spec diffs runs as an isolated subagent, not as a follow-up user message in the current conversation.

Requirements:
- Recording a spec diff still creates a direct diff file under `spec/diffs/`, using `.md` by default.
- After recording the diff, the extension should spawn a separate `pi` process in non-interactive print mode with `--no-session`, so the incorporation agent starts with an empty conversation and does not carry current context.
- The subagent should use the configured strong model (`openai-code/gpt-5.5:high`) and the same project cwd.
- The subagent prompt should include only the recorded diff path and spec-incorporation instructions needed to update `spec/technical-spec.md`.
- The extension and main spec should stop describing this as a queued follow-up turn and describe it as an isolated subagent instead.

## Context

The user clarified that the incorporation agent should be a subagent and should not carry the current context.
