# SC Technical Spec

## Purpose

`sc` is a TypeScript CLI wrapper around Git for worktree-first workflows. It makes a repository layout with a bare Git directory and sibling worktrees the default way to clone, inspect, stage, commit, sync, and manage branches.

## Repository Layout

The intended `sc` repository layout is:

```text
repo/
  .git/      # bare repository
  main/      # primary worktree
  develop/   # optional worktree
  scratch/   # optional worktree
```

`sc clone <url> [targetDir]` creates this shape by cloning the remote as a bare repository into `<targetDir>/.git` and adding an initial branch worktree, usually `main` or `master`.

## CLI Surface

The executable is `sc` and is implemented with Commander in `src/cli.ts`.

### Root Behavior

- Bare `sc` behaves like `sc status`.
- Commands return `neverthrow` `Result` values from command modules.
- CLI actions print friendly failures and exit with status `1` when a command returns `Err`.

### Worktree Commands

- `sc clone <url> [targetDir]`
  - Fails if the target directory already exists.
  - Runs `git clone --bare <url> <targetDir>/.git`.
  - Detects the initial worktree branch after cloning:
    - use the repository default branch when it is `main` or `master`;
    - otherwise prefer an existing `main` branch;
    - otherwise prefer an existing `master` branch;
    - otherwise fall back to the repository default branch.
  - Creates the initial worktree under `<targetDir>/<branch>` and checks out that same branch/ref from the bare Git directory.
- `sc wt add <name> [branch]` / `sc wt a`
  - Resolves the SC root from the current worktree.
  - Creates the new worktree as a sibling under the SC root.
  - Uses the provided branch when present; otherwise uses `<name>`.
  - If the branch exists, checks it out. If it does not exist, creates a new branch named `<name>`.
- `sc wt remove <name>` / `sc wt rm`
  - Resolves the SC root.
  - Fails if the named worktree directory does not exist.
  - Runs `git worktree remove <name>` from the bare Git directory.
- `sc wt list` / `sc wt l`
  - Runs `git worktree list` from the bare Git directory and prints the result.

### Change and Commit Commands

- `sc stage`
  - Stages all changes with `git add -A`.
  - Creates a staging commit with subject `[SC-STAGE] Staging commit`.
  - If `HEAD` is already a staging commit, amends it instead of creating another staging commit.
  - Prints `No changes to stage` when the worktree has no changes.
- `sc commit <message> [--amend]` / `sc c <message> [--amend]`
  - Supports `-a` as a short flag for `--amend`, e.g. `sc commit -a "message"`.
  - Stages all changes with `git add -A` when changes exist.
  - Counts consecutive `[SC-STAGE]` commits from `HEAD`.
  - Soft-resets before those staging commits so they are squashed into the resulting commit.
  - With `--amend`, amends the resulting `HEAD` with the provided message.
  - Without `--amend`, creates a normal commit with the provided message.
  - Prints `No changes to commit` when the worktree has no changes and `--amend` is not used.
- `sc uncommit`
  - Runs `git reset --soft HEAD~1` in the current working directory.
  - Undoes the last commit while keeping its changes staged in the index/worktree.
  - Prints `✓ Last commit undone` on success.
  - Returns a `GitError` `Result` on failure, such as outside a working tree or when no parent commit exists.

### Sync Commands

- `sc pull`
  - Runs `git fetch --all` first.
  - Warns but continues if fetch fails, which supports repositories with no remotes.
  - Runs `git pull` and prints success on completion.
- `sc push [--force]`
  - Reads the last commit message.
  - Refuses to push when the last commit message contains `[SC-STAGE]`, unless `--force` is provided.
  - Runs `git push`, with `--force` when requested.

### Status Commands

- `sc status` / `sc st`
  - Runs `git status` in the current working directory with inherited stdio.
  - The current implementation delegates directly to Git status output.

## Implementation Architecture

```text
src/
  cli.ts                 # Commander command registration and process-exit handling
  commands/
    commit.ts            # stage, commit, and uncommit workflows
    status.ts            # status workflow
    sync.ts              # pull and push workflows
    worktree.ts          # clone and worktree workflows, including initial clone branch selection
  utils/
    git.ts               # Git process wrapper and shared Git helpers
```

### Git Execution

`src/utils/git.ts` owns Git process execution:

- `runGit(args, cwd?, options?)` calls `spawnSync("git", args, ...)` with an argument array.
- `stdio: "pipe"` captures trimmed stdout and includes stderr in error messages.
- `stdio: "inherit"` streams Git output directly and returns an empty success string.
- Recoverable failures return `Err<GitError>` instead of throwing.

Shared helpers include:

- `isGitRepo`
- `getRepoRoot`
- `getBareGitDir`
- `getWorktreeRoot`
- `isHeadAtStagingCommit`
- `getLastCommitMessage`
- `amendCommit`
- `createCommit`
- `stageAll`
- `hasChanges`
- `countConsecutiveStagingCommits`
- `resetToBeforeStagingCommits`
- `softResetToParent`

### Error Handling

The project uses `neverthrow` for type-safe error handling.

- Source command modules return `Result<void, GitError>`.
- Recoverable failures use `err({ code, message })`.
- Successful command flows use `ok(...)` or `.map(() => undefined)`.
- CLI entrypoints inspect `Result` values and terminate the process only at the boundary.
- Source code should avoid `throw` for recoverable errors.

## Tooling

Scripts:

```bash
npm run build   # Compile TypeScript to JavaScript
npm run dev     # Run the CLI through tsx
npm run start   # Run compiled JavaScript
npm run lint    # Run ESLint over src/
npm run fmt     # Format files with Biome
npm run check   # Lint then format
```

Formatting uses Biome with two-space indentation, 100-character line width, and semicolons. Linting uses ESLint with TypeScript ESLint rules.

