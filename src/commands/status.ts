import { type Result } from "neverthrow";
import { isGitRepo, runGit, type GitError } from "../utils/git.js";

export function showStatus(): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => runGit(["status"], cwd, { stdio: "inherit" }))
    .map(() => undefined);
}
