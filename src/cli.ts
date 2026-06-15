#!/usr/bin/env node

import { Command } from "commander";
import { commitChanges, stageChanges, uncommitChanges } from "./commands/commit.js";
import { pullChanges, pushChanges } from "./commands/sync.js";
import { addWorktree, cloneRepo, listWorktrees, removeWorktree } from "./commands/worktree.js";
import { showStatus } from "./commands/status.js";

const program = new Command();

program.name("sc").description("Git worktree management tool").version("1.0.0");

program
  .command("clone <url> [targetDir]")
  .description("Clone a repository with bare .git and create main worktree")
  .action((url: string, targetDir?: string) => {
    const result = cloneRepo(url, targetDir);
    if (result.isErr()) {
      console.error("✗ Clone failed:", result.error.message);
      process.exit(1);
    }
  });

const wtCmd = program.command("wt").description("Manage worktrees");

wtCmd
  .command("add <name> [branch]")
  .alias("a")
  .description("Add a new worktree")
  .action((name: string, branch?: string) => {
    const result = addWorktree(name, branch);
    if (result.isErr()) {
      console.error("✗ Add worktree failed:", result.error.message);
      process.exit(1);
    }
  });

wtCmd
  .command("remove <name>")
  .alias("rm")
  .description("Remove a worktree")
  .action((name: string) => {
    const result = removeWorktree(name);
    if (result.isErr()) {
      console.error("✗ Remove worktree failed:", result.error.message);
      process.exit(1);
    }
  });

wtCmd
  .command("list")
  .alias("l")
  .description("List all worktrees")
  .action(() => {
    const result = listWorktrees();
    if (result.isErr()) {
      console.error("✗ List worktrees failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("stage")
  .description("Stage all changes as a staging commit (prevents push)")
  .action(() => {
    const result = stageChanges();
    if (result.isErr()) {
      console.error("✗ Stage failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("commit <message>")
  .alias("c")
  .description("Commit changes (merges with staging commit if previous is staging)")
  .option("-a, --amend", "Amend the last commit instead of creating a new one")
  .action((message: string, options: { amend?: boolean }) => {
    const result = commitChanges(message, options.amend ?? false);
    if (result.isErr()) {
      console.error("✗ Commit failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("uncommit")
  .description("Undo the last commit, keeping its changes staged")
  .action(() => {
    const result = uncommitChanges();
    if (result.isErr()) {
      console.error("✗ Uncommit failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("pull")
  .description("Fetch all remotes and pull changes")
  .action(() => {
    const result = pullChanges();
    if (result.isErr()) {
      console.error("✗ Pull failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("push")
  .description("Push changes (prevents pushing staging commits)")
  .option("--force", "Force push even if last commit is a staging commit")
  .action((options: { force?: boolean }) => {
    const result = pushChanges(options.force ?? false);
    if (result.isErr()) {
      console.error("✗ Push failed:", result.error.message);
      process.exit(1);
    }
  });

program
  .command("status")
  .alias("st")
  .description("Show repository status")
  .action(() => {
    const result = showStatus();
    if (result.isErr()) {
      console.error("✗ Status failed:", result.error.message);
      process.exit(1);
    }
  });

program.showHelpAfterError(false);

// Show status by default when no command is provided
program.action(() => {
  const result = showStatus();
  if (result.isErr()) {
    console.error("✗ Status failed:", result.error.message);
    process.exit(1);
  }
});

program.parse();
