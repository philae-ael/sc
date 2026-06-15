import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { Type, type Static } from "typebox";

const SPEC_DIR = "spec";
const MAIN_SPEC_PATH = "spec/technical-spec.md";
const DIFFS_DIR = "spec/diffs";
const STRONG_MODEL_PROVIDER = "openai-codex";
const STRONG_MODEL_ID = "gpt-5.5";
const STRONG_MODEL_PATTERN = `${STRONG_MODEL_PROVIDER}/${STRONG_MODEL_ID}:high`;

type SpecManagerError = { code: string; message: string };

const specDiffParams = Type.Object({
  diff: Type.String({
    description:
      "Understandable description of the technical spec change to incorporate. It may be prose, bullets, or patch-like text.",
  }),
  title: Type.Optional(Type.String({ description: "Short title for this spec change" })),
  context: Type.Optional(
    Type.String({ description: "Optional session/task context that helps incorporate the diff" })
  ),
  launchStrongAgent: Type.Optional(
    Type.Boolean({
      description:
        "Whether to launch an isolated strong subagent that incorporates the diff into the main spec. Defaults to true.",
    })
  ),
});

type SpecDiffParams = Static<typeof specDiffParams>;

function messageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDiffDocument(params: SpecDiffParams, id: string, isoTimestamp: string): string {
  const title = params.title?.trim() || "Untitled spec change";
  const context = params.context?.trim();

  return [
    `# ${title}`,
    "",
    `- ID: ${id}`,
    `- Created: ${isoTimestamp}`,
    `- Target: ${MAIN_SPEC_PATH}`,
    "- Status: pending incorporation",
    "",
    "## Diff",
    "",
    params.diff.trim(),
    ...(context ? ["", "## Context", "", context] : []),
    "",
  ].join("\n");
}

function createDiffFile(
  cwd: string,
  params: SpecDiffParams
): ResultAsync<{ id: string; relativePath: string }, SpecManagerError> {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const id = randomUUID().slice(0, 8);
  const relativePath = path.join(DIFFS_DIR, `${timestamp}-${id}.md`);
  const absolutePath = path.join(cwd, relativePath);
  const document = formatDiffDocument(params, id, now.toISOString());

  return ResultAsync.fromPromise(mkdir(path.join(cwd, DIFFS_DIR), { recursive: true }), error => ({
    code: "SPEC_DIFF_DIR_ERROR",
    message: `Failed to create ${DIFFS_DIR}: ${messageFromUnknown(error)}`,
  })).andThen(() =>
    ResultAsync.fromPromise(writeFile(absolutePath, document, "utf-8"), error => ({
      code: "SPEC_DIFF_WRITE_ERROR",
      message: `Failed to write ${relativePath}: ${messageFromUnknown(error)}`,
    })).map(() => ({ id, relativePath }))
  );
}

function normalizeProjectPath(cwd: string, targetPath: string): string {
  const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  return path.relative(cwd, absolutePath).split(path.sep).join("/");
}

function isManagedSpecPath(relativePath: string): boolean {
  return relativePath === SPEC_DIR || relativePath.startsWith(`${SPEC_DIR}/`);
}

function isSpecDiffPath(relativePath: string): boolean {
  return relativePath === DIFFS_DIR || relativePath.startsWith(`${DIFFS_DIR}/`);
}

function isLikelySpecMutationCommand(command: string): boolean {
  if (!command.includes(MAIN_SPEC_PATH)) return false;
  return /\b(cp|mv|rm|tee)\b|>|\bsed\s+-i\b|\bperl\s+-pi\b|\bnode\s+-e\b|\bpython\b/.test(command);
}

function isIncorporationPrompt(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return (
    normalized.includes("spec/diffs/") &&
    normalized.includes("diff") &&
    normalized.includes("incorporat") &&
    normalized.includes("already") &&
    normalized.includes("recorded")
  );
}

function buildIncorporationPrompt(diffPath: string): string {
  return [
    "You are the strong spec-maintenance agent for this project.",
    "",
    `A required spec diff has already been recorded at \`${diffPath}\`.`,
    `Read \`${diffPath}\`, \`${MAIN_SPEC_PATH}\`, and any other files under \`${SPEC_DIR}/\` that are needed.`,
    `Apply only project-relevant content from the diff to the main technical spec at \`${MAIN_SPEC_PATH}\`.`,
    "If the diff only concerns pi extensions, spec-manager behavior, subagents, diff-record formats, or other harness/process details, do not modify the main technical spec.",
    "",
    "Rules:",
    "- Do not create another spec diff for this incorporation task; the prerequisite diff already exists.",
    "- Keep the spec coherent and concise; reconcile conflicts instead of appending duplicate sections.",
    "- Preserve durable project technical decisions, architecture, commands, data flows, and constraints.",
    "- Keep the main spec about the sc project only; do not document the pi harness, spec tool, subagent workflow, or spec-update process there.",
    "- If the diff is ambiguous, make the smallest reasonable project-spec update and leave an explicit open question in the spec.",
    "- Do not modify source code unless the recorded diff explicitly requires it.",
  ].join("\n");
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

function runPiSubagentInTmux(
  ctx: ExtensionContext,
  prompt: string,
  diffPath: string
): Promise<Result<void, SpecManagerError>> {
  return new Promise(resolve => {
    void (async () => {
      if (!process.env.TMUX) {
        resolve(
          err({
            code: "SPEC_SUBAGENT_NO_TMUX",
            message:
              "Spec subagent requires running inside tmux so its TUI can be displayed in a new window. Start pi inside a tmux session and retry.",
          })
        );
        return;
      }

      const pi = getPiInvocation(["--approve", "--model", STRONG_MODEL_PATTERN]);
      const piArgs = pi.args.concat([prompt]);
      const tmuxArgs = [
        "display-popup",
        "-E",
        "-x",
        "0",
        "-y",
        "1000",
        "-w",
        "100%",
        "-h",
        "20",
        "-d",
        ctx.cwd,
        "--",
        pi.command,
        ...piArgs,
      ];

      const tmux = spawn("tmux", tmuxArgs);

      const tmuxExit: number | null = await new Promise(r => {
        tmux.on("error", () => r(-1));
        tmux.on("close", code => r(code));
      });

      if (tmuxExit !== 0) {
        resolve(
          err({
            code: "SPEC_SUBAGENT_TMUX_ERROR",
            message: `Failed to open tmux popup for subagent: tmux exited ${String(tmuxExit)}`,
          })
        );
        return;
      }

      if (ctx.hasUI) {
        ctx.ui.notify(`Spec subagent running in tmux popup at the bottom of the screen.`, "info");
        ctx.ui.setStatus("spec", `spec: subagent running`);
      } else {
        process.stderr.write(`[spec-subagent] running in tmux popup at the bottom of the screen\n`);
      }

      if (ctx.hasUI) {
        ctx.ui.setStatus("spec", "spec: managed");
        ctx.ui.notify(`Spec subagent for ${diffPath} launched in floating pane.`, "info");
      }
      resolve(ok(undefined));
    })();
  });
}

function buildWorkflowSystemPrompt(baseSystemPrompt: string): string {
  return [
    baseSystemPrompt,
    "",
    "Technical spec workflow:",
    "",
    `- The project technical spec lives under \`${SPEC_DIR}/\`, with the main spec at \`${MAIN_SPEC_PATH}\`.`,
    "- If this session updates the technical spec, first call `spec_record_diff` with an understandable diff.",
    `- Record diff files directly under \`${DIFFS_DIR}/\` as \`{yyyy-mm-dd-hhmm}-{id}.md\` or \`{yyyy-mm-dd-hhmm}-{id}.diff\`; do not create nested \`.md/diff\` paths.`,
    `- \`spec_record_diff\` writes \`${DIFFS_DIR}/{yyyy-mm-dd-hhmm}-{id}.md\` by default and launches an isolated strong subagent (in a new tmux window) with no session context to incorporate project-relevant content into the main spec.`,
    "- Keep the main technical spec about the `sc` project only; do not add pi harness, spec-manager, subagent, or spec-update process details to it.",
    `- Direct write/edit tool calls to managed spec files outside \`${DIFFS_DIR}/\` are blocked unless the active turn is incorporating an already-recorded diff.`,
    `- A turn whose task is only to incorporate an already-recorded diff from \`${DIFFS_DIR}/\` must not create another diff.`,
  ].join("\n");
}

async function recordSpecDiff(
  _pi: ExtensionAPI,
  ctx: ExtensionContext,
  params: SpecDiffParams
): Promise<Result<{ id: string; relativePath: string }, SpecManagerError>> {
  const normalizedDiff = params.diff.trim();
  if (!normalizedDiff) {
    return err({ code: "EMPTY_SPEC_DIFF", message: "Spec diff cannot be empty" });
  }

  const result = await createDiffFile(ctx.cwd, { ...params, diff: normalizedDiff });
  if (result.isErr()) {
    return err(result.error);
  }

  if (ctx.hasUI) {
    ctx.ui.notify(`Spec diff recorded at ${result.value.relativePath}`, "info");
  }

  if (params.launchStrongAgent ?? true) {
    const launchResult = await runPiSubagentInTmux(
      ctx,
      buildIncorporationPrompt(result.value.relativePath),
      result.value.relativePath
    );
    if (launchResult.isErr()) {
      return err(launchResult.error);
    }
  }

  return ok(result.value);
}

export default function specManagerExtension(pi: ExtensionAPI) {
  let incorporationTurnActive = false;
  pi.on("before_agent_start", event => {
    incorporationTurnActive = isIncorporationPrompt(event.prompt);

    return { systemPrompt: buildWorkflowSystemPrompt(event.systemPrompt) };
  });

  pi.on("tool_call", (event, ctx) => {
    if (incorporationTurnActive) return;

    if (event.toolName === "write" || event.toolName === "edit") {
      const input = event.input as { path?: unknown } | undefined;
      const targetPath =
        input && typeof input === "object" && typeof input.path === "string"
          ? input.path
          : undefined;
      if (!targetPath) return;

      const relativePath = normalizeProjectPath(ctx.cwd, targetPath);
      if (isManagedSpecPath(relativePath) && !isSpecDiffPath(relativePath)) {
        return {
          block: true,
          reason: `Record a spec diff with spec_record_diff before editing ${relativePath}.`,
        };
      }
    }

    if (event.toolName === "bash") {
      const input = event.input as { command?: unknown } | undefined;
      const command =
        input && typeof input === "object" && typeof input.command === "string"
          ? input.command
          : undefined;
      if (command && isLikelySpecMutationCommand(command)) {
        return {
          block: true,
          reason: `Record a spec diff with spec_record_diff before mutating ${MAIN_SPEC_PATH}.`,
        };
      }
    }
  });

  pi.on("agent_end", () => {
    incorporationTurnActive = false;
  });

  pi.registerTool({
    name: "spec_record_diff",
    label: "Record Spec Diff",
    description:
      "Record an understandable technical-spec diff under spec/diffs/{yyyy-mm-dd-hhmm}-{id}.md before the spec is updated, then optionally launch an isolated strong subagent (in a new tmux window) to incorporate it. Manual diff records may also use .diff files.",
    promptSnippet:
      "Record a technical-spec change request before editing spec files and launch isolated subagent incorporation into the main spec",
    promptGuidelines: [
      "Use spec_record_diff before making direct edits to files under spec/ when the session updates the technical spec.",
      "Keep spec/technical-spec.md about the sc project only; do not document pi harness, spec-manager, subagent, or spec-update process details there.",
      "Do not use spec_record_diff when merely incorporating a diff that is already recorded under spec/diffs/.",
    ],
    parameters: specDiffParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await recordSpecDiff(pi, ctx, params);
      if (result.isErr()) {
        return {
          content: [{ type: "text", text: result.error.message }],
          details: result.error,
          isError: true,
        };
      }

      const launchText =
        (params.launchStrongAgent ?? true)
          ? "An isolated strong subagent incorporated it in a tmux window."
          : "No incorporation subagent was launched.";

      return {
        content: [
          {
            type: "text",
            text: `Recorded spec diff at ${result.value.relativePath}. ${launchText}`,
          },
        ],
        details: result.value,
      };
    },
  });

  pi.registerCommand("spec-diff", {
    description:
      "Record a technical-spec diff and run isolated strong subagent incorporation in a new tmux window: /spec-diff <diff text>",
    handler: async (args, ctx) => {
      const diff = args.trim();
      if (!diff) {
        ctx.ui.notify("Usage: /spec-diff <understandable diff text>", "warning");
        return;
      }

      const result = await recordSpecDiff(pi, ctx, { diff, title: "Manual spec diff" });
      if (result.isErr()) {
        ctx.ui.notify(result.error.message, "error");
      }
    },
  });
}
