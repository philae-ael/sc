# Keep technical spec project-only

- ID: project-only-spec
- Created: 2026-06-15T00:00:00.000Z
- Target: spec/technical-spec.md
- Status: incorporated by this session

## Diff

Update the spec-management behavior and the main technical spec so `spec/technical-spec.md` contains only technical information about the `sc` project itself.

Requirements:
- Remove the spec-maintenance workflow section from `spec/technical-spec.md`.
- Do not document pi extensions, spec manager tooling, subagent behavior, diff-record formats, or other harness/process details in the main technical spec.
- Keep product/project content such as CLI behavior, repository layout, implementation architecture, Git helpers, error handling, and project tooling.
- Update the spec-manager extension's incorporation prompt so future subagents avoid adding harness/process/spec-tool details to the main technical spec.

## Context

The user clarified: "the spec should only be about the project, not about the harness around; eg. do not document updates to the spec tool in the tech spec".
