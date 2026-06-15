import * as fs from "node:fs";
import * as path from "node:path";
import { type Result, err, ok } from "neverthrow";
import { getBareGitDir, getWorktreeRoot, isGitRepo, runGit, type GitError } from "../utils/git.js";

export function cloneRepo(url: string, targetDir?: string): Result<void, GitError> {
  const dir = targetDir || path.basename(url).replace(/\.git$/, "");
  const repoDir = path.resolve(dir);
  const bareGitDir = path.join(repoDir, ".git");

  if (fs.existsSync(repoDir)) {
    return err({
      code: "FILE_ERROR",
      message: `Directory ${dir} already exists`,
    });
  }

  try {
    fs.mkdirSync(repoDir, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "FILE_ERROR",
      message: `Failed to create directory ${dir}: ${message}`,
    });
  }

  console.log(`Cloning ${url} to ${bareGitDir}...`);
  return runGit(["clone", "--bare", url, bareGitDir])
    .andThen(() => getInitialWorktreeBranch(bareGitDir))
    .andThen(branch => {
      const worktreeDir = path.join(repoDir, branch);
      console.log(`Creating ${branch} worktree at ${worktreeDir}...`);
      return runGit(["worktree", "add", worktreeDir, branch], bareGitDir).map(() => branch);
    })
    .map(branch => {
      console.log(`✓ Repository cloned to ${repoDir}`);
      console.log(`  ${branch} worktree: ${path.join(repoDir, branch)}`);
    });
}

function getInitialWorktreeBranch(bareGitDir: string): Result<string, GitError> {
  return runGit(["symbolic-ref", "--short", "HEAD"], bareGitDir).andThen(defaultBranch => {
    if (defaultBranch === "main" || defaultBranch === "master") {
      return ok(defaultBranch);
    }

    for (const branch of ["main", "master"]) {
      const branchExists = runGit(
        ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        bareGitDir
      );
      if (branchExists.isOk()) {
        return ok(branch);
      }
    }

    return ok(defaultBranch);
  });
}

export function addWorktree(name: string, branch?: string): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => getWorktreeRoot(cwd))
    .andThen(repoRoot => {
      const wtDir = path.join(repoRoot, name);

      if (fs.existsSync(wtDir)) {
        return err({
          code: "FILE_ERROR",
          message: `Worktree ${name} already exists`,
        });
      }

      return getBareGitDir(cwd).andThen(bareGitDir => {
        const ref = branch || name;

        console.log(`Creating worktree ${name} at ${wtDir}...`);

        const branchCheckResult = runGit(
          ["show-ref", "--verify", "--quiet", `refs/heads/${ref}`],
          bareGitDir
        );
        const branchExists = branchCheckResult.isOk();

        const wtAddResult = branchExists
          ? runGit(["worktree", "add", wtDir, ref], bareGitDir)
          : runGit(["worktree", "add", "-b", name, wtDir], bareGitDir);

        return wtAddResult.map(() => {
          console.log(`✓ Worktree ${name} created at ${wtDir}`);
        });
      });
    });
}

export function removeWorktree(name: string): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => getWorktreeRoot(cwd))
    .andThen(repoRoot => {
      const wtDir = path.join(repoRoot, name);

      if (!fs.existsSync(wtDir)) {
        return err({
          code: "FILE_ERROR",
          message: `Worktree ${name} does not exist`,
        });
      }

      return getBareGitDir(cwd).andThen(bareGitDir => {
        console.log(`Removing worktree ${name}...`);
        return runGit(["worktree", "remove", name], bareGitDir).map(() => {
          console.log(`✓ Worktree ${name} removed`);
        });
      });
    });
}

export function listWorktrees(): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => getBareGitDir(cwd))
    .andThen(bareGitDir => runGit(["worktree", "list"], bareGitDir))
    .map(output => {
      console.log(output);
    });
}
