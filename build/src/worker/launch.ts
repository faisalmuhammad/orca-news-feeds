import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { NewsLaunchReceipt } from "../shared/model";

const execute = promisify(execFile);
type Runner = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    timeout: number;
    maxBuffer: number;
    encoding: "utf8";
  },
) => Promise<{ stdout: string }>;
export type NewsLauncher = (
  workspaceId: string,
  agent: string,
  prompt: string,
  operationId?: string,
) => Promise<NewsLaunchReceipt>;
export class NewsLaunchError extends Error {
  constructor(
    message: string,
    readonly operationId?: string,
    readonly refused = false,
  ) {
    super(message);
  }
}
async function resolveCli() {
  if (process.env.ORCA_CLI_COMMAND) return process.env.ORCA_CLI_COMMAND;
  if (process.env.ORCA_DEV_REPO_ROOT) return "orca-dev";
  if (process.platform === "darwin") {
    // Prefer this host's app bundle when its worker exposes a bundled path.
    for (const path of [process.argv[1], process.execPath]) {
      const at = path?.indexOf(".app/Contents/");
      if (at !== undefined && at >= 0) {
        const candidate =
          path.slice(0, at + 4) + "/Contents/Resources/bin/orca";
        try {
          await access(candidate, constants.X_OK);
          return candidate;
        } catch {}
      }
    }
    await access(
      "/Applications/Orca.app/Contents/Resources/bin/orca",
      constants.X_OK,
    );
    return "/Applications/Orca.app/Contents/Resources/bin/orca";
  }
  return process.platform === "linux" ? "orca-ide" : "orca.exe";
}
function readReply(stdout: string, operationId?: string): any {
  try {
    const reply = JSON.parse(stdout.trim());
    if (!reply || typeof reply.ok !== "boolean")
      throw new Error("Invalid receipt");
    return reply;
  } catch {
    throw new NewsLaunchError(
      "Could not confirm Orca’s launch receipt. Check the workspace before starting another conversation.",
      operationId,
    );
  }
}
export function createOrcaLauncher(
  options: { cli?: string; cwd?: string; run?: Runner } = {},
): NewsLauncher {
  let cli: Promise<string> | undefined;
  const run = options.run ?? (execute as Runner),
    cwd = options.cwd ?? resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return async (workspaceId, agent, prompt, operationId) => {
    const selector = workspaceId.startsWith("identity:")
        ? workspaceId
        : "id:" + workspaceId,
      args = [
        "agent",
        "launch",
        "--agent",
        agent,
        "--worktree",
        selector,
        "--prompt",
        prompt,
        "--focus",
        "--json",
      ];
    if (operationId) args.push("--retry-launch", operationId);
    let file: string;
    try {
      file = await (cli ??= options.cli
        ? Promise.resolve(options.cli)
        : resolveCli());
    } catch {
      throw new NewsLaunchError(
        "Orca’s CLI could not be found. Restore the CLI that ships with Orca.",
        undefined,
        true,
      );
    }
    let stdout: string;
    try {
      stdout = (
        await run(file, args, {
          cwd,
          timeout: 90000,
          maxBuffer: 2 * 1024 * 1024,
          encoding: "utf8",
        })
      ).stdout;
    } catch (error) {
      const failure = error as { stdout?: string; code?: string };
      if (failure.stdout?.trim()) stdout = failure.stdout;
      else
        throw new NewsLaunchError(
          failure.code === "ENOENT"
            ? "Orca’s CLI is unavailable. Restore the CLI that ships with Orca."
            : "Could not confirm the agent launch. Check the selected workspace before starting another conversation.",
          operationId,
          failure.code === "ENOENT",
        );
    }
    const reply = readReply(stdout, operationId);
    if (!reply.ok) {
      const data = reply.error?.data,
        id =
          typeof data?.operationId === "string"
            ? data.operationId
            : operationId;
      const refused =
        !id &&
        data?.launchOutcome !== "unknown" &&
        [
          "invalid_argument",
          "invalid_params",
          "incompatible_runtime",
          "agent_not_configured",
          "agent_launch_refused",
          "not_found",
          "runtime_access_denied",
        ].includes(reply.error?.code);
      throw new NewsLaunchError(
        reply.error?.message || "Orca could not start the agent.",
        id,
        refused,
      );
    }
    const result = reply.result,
      id =
        typeof result?.operationId === "string"
          ? result.operationId
          : operationId,
      outcome = result?.outcome,
      delivery = result?.prompt?.outcome;
    if (
      !outcome ||
      typeof outcome.handle !== "string" ||
      !outcome.handle ||
      !["structured", "terminal"].includes(outcome.kind) ||
      (outcome.kind === "structured" &&
        (typeof outcome.sessionId !== "string" || !outcome.sessionId))
    )
      throw new NewsLaunchError(
        "Orca returned no confirmed conversation. Check the workspace before starting another.",
        id,
      );
    if (
      result.prompt?.delivery !== "submit" ||
      (outcome.kind === "structured"
        ? delivery !== "journaled"
        : delivery !== "handed-to-terminal")
    )
      throw new NewsLaunchError(
        "Orca opened a conversation but did not confirm delivery of your question. Check its tab before starting another.",
        id,
      );
    return {
      kind: outcome.kind === "structured" ? "chat" : "terminal",
      handle: outcome.handle,
      ...(outcome.kind === "structured"
        ? { sessionId: outcome.sessionId }
        : {}),
      ...(id ? { operationId: id } : {}),
      delivery,
      detail:
        typeof result.receipt?.detail === "string" ? result.receipt.detail : "",
    };
  };
}
