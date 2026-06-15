import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { err, ok, type Result } from "neverthrow";

export const STAGING_PREFIX = "[SC-STAGE]";

export type GitError = { code: string; message: string };

interface RunGitOptions {
  stdio?: "pipe" | "inherit";
}

export function runGit(
  args: string[],
  cwd?: string,
  options?: RunGitOptions
): Result<string, GitError> {
  try {
    const stdio = options?.stdio ?? "pipe";
    const spawnOptions =
      stdio === "inherit"
        ? { cwd, stdio: "inherit" as const }
        : { cwd, encoding: "utf-8" as const };

    const result = spawnSync("git", args, spawnOptions);

    if (result.error) {
      return err({
        code: "GIT_ERROR",
        message: `Git command failed: git ${args.join(" ")}\n${result.error.message}`,
      });
    }

    if (result.status !== 0) {
      const stderr =
        stdio === "inherit" ? "" : typeof result.stderr === "string" ? result.stderr : "";
      return err({
        code: "GIT_ERROR",
        message: `Git command failed: git ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`,
      });
    }

    if (stdio === "inherit") {
      return ok("");
    }

    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    return ok(stdout.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "GIT_ERROR",
      message: `Git command failed: git ${args.join(" ")}\n${message}`,
    });
  }
}

export function isGitRepo(dir: string): Result<boolean, GitError> {
  return runGit(["rev-parse", "--git-dir"], dir).map(() => true);
}

export function getRepoRoot(cwd?: string): Result<string, GitError> {
  return runGit(["rev-parse", "--show-toplevel"], cwd);
}

export function getBareGitDir(repoRoot: string): Result<string, GitError> {
  try {
    // For a worktree, .git might be a file pointing to the common git dir
    const gitPath = path.join(repoRoot, ".git");
    if (fs.statSync(gitPath).isFile()) {
      const content = fs.readFileSync(gitPath, "utf-8");
      const match = content.match(/gitdir: (.*)/);
      if (match) {
        return ok(path.resolve(repoRoot, match[1]));
      }
    }
    return ok(gitPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "FILE_ERROR",
      message: `Failed to get bare git dir: ${message}`,
    });
  }
}

export function getWorktreeRoot(worktreeDir: string): Result<string, GitError> {
  return getBareGitDir(worktreeDir).map(bareGitDir => path.dirname(bareGitDir));
}

export function isHeadAtStagingCommit(cwd: string): Result<boolean, GitError> {
  return runGit(["log", "-1", "--pretty=%s"], cwd).map(log => log.startsWith(STAGING_PREFIX));
}

export function getLastCommitMessage(cwd: string): Result<string, GitError> {
  return runGit(["log", "-1", "--pretty=%B"], cwd);
}

export function amendCommit(message: string, cwd: string): Result<void, GitError> {
  return runGit(["commit", "--amend", "-m", message], cwd).map(() => undefined);
}

export function createCommit(message: string, cwd: string): Result<void, GitError> {
  return runGit(["commit", "-m", message], cwd).map(() => undefined);
}

export function stageAll(cwd: string): Result<void, GitError> {
  return runGit(["add", "-A"], cwd).map(() => undefined);
}

export function hasChanges(cwd: string): Result<boolean, GitError> {
  return runGit(["status", "--porcelain"], cwd).map(status => status.length > 0);
}

export function countConsecutiveStagingCommits(cwd: string): Result<number, GitError> {
  return runGit(["log", "--pretty=%s"], cwd).andThen(output => {
    if (!output) return ok(0);

    const lines = output.split("\n").filter(line => line.trim().length > 0);
    let count = 0;
    for (const line of lines) {
      if (line.startsWith(STAGING_PREFIX)) {
        count++;
      } else {
        break;
      }
    }
    return ok(count);
  });
}

export function resetCommits(count: number, cwd: string): Result<void, GitError> {
  if (count === 0) return ok(undefined);
  return runGit(["reset", "--soft", `HEAD~${String(count)}`], cwd).map(() => undefined);
}
