import { type Result, ok, err } from "neverthrow";
import {
  getLastCommitMessage,
  isGitRepo,
  runGit,
  STAGING_PREFIX,
  type GitError,
} from "../utils/git.js";

export function pullChanges(): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => {
      console.log("Fetching from all remotes...");
      const fetchResult = runGit(["fetch", "--all"], cwd);
      if (fetchResult.isErr()) {
        console.warn("Fetch failed (might not have remotes):", fetchResult.error.message);
      }
      return ok(undefined);
    })
    .andThen(() => {
      console.log("Pulling changes...");
      return runGit(["pull"], cwd);
    })
    .map(() => {
      console.log("✓ Pull successful");
    });
}

export function pushChanges(force: boolean = false): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => getLastCommitMessage(cwd))
    .andThen(lastMessage => {
      if (lastMessage.includes(STAGING_PREFIX) && !force) {
        return err({
          code: "STAGING_COMMIT_ERROR",
          message:
            "Cannot push staging commits. Use --force to override or use `sc commit` to convert to a regular commit.",
        });
      }
      return ok(undefined);
    })
    .andThen(() => {
      console.log("Pushing changes...");
      const args = ["push"];
      if (force) {
        args.push("--force");
      }
      return runGit(args, cwd);
    })
    .map(() => {
      console.log("✓ Push successful");
    });
}
