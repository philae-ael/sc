# Project Instructions

- Keep responses concise.
- Run `npm run check` after source code changes.
- Use `neverthrow` for recoverable errors in source code.
- Avoid `throw` in source code; return `Result` errors instead.
- Remove comments that simply repeat the code.

## Project Technical Reference

For product behavior, architecture, CLI contracts, repository layout, Git workflows, tooling, and implementation details, read:

- `spec/technical-spec.md`

Do not duplicate technical spec content in this file. If project behavior or architecture changes, update the spec through the spec workflow instead of adding durable project knowledge here.

## Spec Workflow Reminder

When a session needs to update `spec/technical-spec.md`, first record an understandable diff under `spec/diffs/` using either:

- `spec/diffs/${date}-${id}.md`
- `spec/diffs/${date}-${id}.diff`

Then let the isolated spec-maintenance subagent incorporate project-relevant content into `spec/technical-spec.md`. The main technical spec should describe only the `sc` project, not pi, the harness, subagents, or spec-management tooling.
