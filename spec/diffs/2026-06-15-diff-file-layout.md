# Use file-based spec diff records

- ID: diff-file-layout
- Created: 2026-06-15T00:00:00.000Z
- Target: spec/technical-spec.md
- Status: incorporated by this session

## Diff

Correct the spec diff storage layout.

The intended layout is that each recorded diff is a single file directly under `spec/diffs/`, using either:

- `spec/diffs/${date}-${id}.md`, for understandable Markdown prose; or
- `spec/diffs/${date}-${id}.diff`, for a literal or patch-like diff.

Do not create a directory named `${date}-${id}.md` containing a nested `diff` file.

Update the pi extension to write `spec/diffs/${date}-${id}.md` by default, and update the main technical spec to describe `.md` or `.diff` diff files.

## Context

The previous implementation used `spec/diffs/${date}-${id}.md/diff`, which was a misunderstanding of the requested path format.
