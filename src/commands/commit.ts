import { type Result, ok } from "neverthrow";
import {
  amendCommit,
  createCommit,
  countConsecutiveStagingCommits,
  hasChanges,
  isGitRepo,
  resetCommits,
  STAGING_PREFIX,
  stageAll,
  type GitError,
} from "../utils/git.js";

export function stageChanges(): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => countConsecutiveStagingCommits(cwd))
    .andThen(stagingCount =>
      hasChanges(cwd).andThen(hasChangesVal => {
        if (!hasChangesVal && stagingCount <= 1) {
          console.log("No changes to stage");
          return ok("unchanged" as const);
        }

        const stageResult = hasChangesVal ? stageAll(cwd) : ok(undefined);
        return stageResult
          .andThen(() => {
            if (stagingCount > 0) {
              console.log(
                `Found ${String(stagingCount)} staging commit(s), squashing into staging commit...`
              );
              return resetCommits(stagingCount, cwd);
            }
            return ok(undefined);
          })
          .andThen(() => createCommit(`${STAGING_PREFIX} Staging commit`, cwd))
          .map(() => "staged" as const);
      })
    )
    .map(stageResult => {
      if (stageResult === "staged") {
        console.log("✓ Changes staged");
      }
    });
}

export function commitChanges(message: string, amend: boolean = false): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => hasChanges(cwd))
    .andThen(hasChangesVal => {
      if (!hasChangesVal && !amend) {
        console.log("No changes to commit");
        return ok(undefined);
      }
      return hasChangesVal ? stageAll(cwd) : ok(undefined);
    })
    .andThen(() => countConsecutiveStagingCommits(cwd))
    .andThen(stagingCount => {
      if (stagingCount > 0) {
        const action = amend ? "squashing with amended commit" : "squashing with new commit";
        console.log(`Found ${String(stagingCount)} staging commit(s), ${action}...`);
        return resetCommits(stagingCount, cwd);
      }
      return ok(undefined);
    })
    .andThen(() => (amend ? amendCommit(message, cwd) : createCommit(message, cwd)))
    .map(() => {
      console.log(amend ? "✓ Commit amended" : "✓ Changes committed");
    });
}

export function uncommitChanges(): Result<void, GitError> {
  const cwd = process.cwd();

  return isGitRepo(cwd)
    .andThen(() => resetCommits(1, cwd))
    .map(() => {
      console.log("✓ Last commit undone");
    });
}
