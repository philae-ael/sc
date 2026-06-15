# Enforce spec diff-before-edit workflow

- ID: extension-enforcement
- Created: 2026-06-15T00:00:00.000Z
- Target: spec/technical-spec.md
- Status: incorporated by this session

## Diff

Update the spec-maintenance workflow to note that the project-local pi extension actively guards direct edits to main spec files.

Spec behavior to incorporate:
- The extension injects workflow instructions into each turn.
- It registers spec_record_diff and /spec-diff to create `spec/diffs/${date}-${id}.md` by default.
- It queues a strong incorporation turn after recording a diff.
- It blocks write/edit tool calls that target spec files outside spec/diffs/ unless the current turn is an incorporation turn for an already-recorded diff.
- It also blocks obvious bash commands that mention spec/technical-spec.md outside an incorporation turn, nudging the agent to use spec_record_diff first.

## Context

This reinforces the user's requirement that sessions updating the spec first add an understandable diff, then launch a strong agent to incorporate it.
