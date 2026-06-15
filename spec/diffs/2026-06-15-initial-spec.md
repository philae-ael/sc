# Initial technical spec and spec-management workflow

- ID: initial-spec
- Created: 2026-06-15T00:00:00.000Z
- Target: spec/technical-spec.md
- Status: incorporated by this session

## Diff

Create the initial project technical spec under spec/technical-spec.md.

The spec should document:
- Product purpose: sc is a TypeScript CLI wrapper around Git for worktree-first workflows.
- Intended repository layout with a bare repository at .git and worktrees like main/, develop/, and scratch/.
- CLI command behavior for clone, worktree add/remove/list, stage, commit, pull, push, and status.
- Current implementation architecture: Commander CLI in src/cli.ts, command modules under src/commands, Git wrapper utilities in src/utils/git.ts, neverthrow Result-based error handling, spawnSync with args arrays, npm scripts/build tooling.
- Spec maintenance process: future spec updates must first record an understandable diff as `spec/diffs/${date}-${id}.md` or `spec/diffs/${date}-${id}.diff`; then a strong agent incorporates that diff into spec/technical-spec.md.

## Context

This diff accompanies creation of a project-local pi extension at .pi/extensions/spec-manager.ts that provides a spec_record_diff tool and /spec-diff command for this workflow.
