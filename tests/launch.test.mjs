import test from "node:test";
import assert from "node:assert/strict";
import { createOrcaLauncher, NewsLaunchError } from "../.orca/tests/launch.mjs";

const structured = () => ({
  ok: true,
  result: {
    outcome: { kind: "structured", handle: "agent-1", sessionId: "codex-1" },
    prompt: { delivery: "submit", outcome: "journaled", messageId: "msg-1" },
    receipt: { detail: "Started a fresh chat" },
    operationId: "op-1",
  },
});
const mock = (reply, calls = []) =>
  createOrcaLauncher({
    cli: "/mock/orca",
    cwd: "/plugin",
    run: async (file, args, options) => {
      calls.push({ file, args, options });
      return { stdout: JSON.stringify(reply) };
    },
  });
test("confirmed chat passes inert arguments and honors an exact workspace", async () => {
  const calls = [],
    prompt = 'Explain $(touch /tmp/never) `anything`\nwith "quotes"';
  const receipt = await mock(structured(), calls)(
    "repo::/project with spaces",
    "codex",
    prompt,
  );
  assert.deepEqual(receipt, {
    kind: "chat",
    handle: "agent-1",
    sessionId: "codex-1",
    delivery: "journaled",
    operationId: "op-1",
    detail: "Started a fresh chat",
  });
  assert.deepEqual(calls[0].args, [
    "agent",
    "launch",
    "--agent",
    "codex",
    "--worktree",
    "id:repo::/project with spaces",
    "--prompt",
    prompt,
    "--focus",
    "--json",
  ]);
  assert.equal(calls[0].options.cwd, "/plugin");
  assert.equal(calls[0].options.shell, undefined);
});
test("terminal success requires the terminal handoff receipt", async () => {
  const reply = structured();
  reply.result.outcome = { kind: "terminal", handle: "terminal-1" };
  reply.result.prompt.outcome = "handed-to-terminal";
  assert.equal((await mock(reply)("w", "claude", "Explain")).kind, "terminal");
});
test("opened surfaces without question delivery are rejected", async () => {
  for (const outcome of [
    undefined,
    "not-delivered",
    "unconfirmed",
    "handed-to-terminal",
  ]) {
    const reply = structured();
    reply.result.prompt.outcome = outcome;
    await assert.rejects(
      mock(reply)("w", "codex", "Explain"),
      (error) =>
        error instanceof NewsLaunchError &&
        error.operationId === "op-1" &&
        !error.refused,
    );
  }
  const reply = structured();
  delete reply.result.outcome.sessionId;
  await assert.rejects(
    mock(reply)("w", "codex", "Explain"),
    /no confirmed conversation/,
  );
});
test("nonzero CLI replies preserve unknown operation IDs and replay arguments", async () => {
  const calls = [];
  const launch = createOrcaLauncher({
    cli: "/mock/orca",
    cwd: "/plugin",
    run: async (file, args, options) => {
      calls.push({ file, args, options });
      if (calls.length === 1)
        throw Object.assign(new Error("exit 1"), {
          stdout: JSON.stringify({
            ok: false,
            error: {
              code: "agent_session_operation_unknown",
              message: "Launch outcome unknown",
              data: {
                operationId: "op-1",
                launchOutcome: "unknown",
                retrySafe: true,
              },
            },
          }),
        });
      return { stdout: JSON.stringify(structured()) };
    },
  });
  await assert.rejects(
    launch("identity:workspace", "codex", "Exact question"),
    (error) => error.operationId === "op-1",
  );
  await launch("identity:workspace", "codex", "Exact question", "op-1");
  assert.deepEqual(calls[1].args, [...calls[0].args, "--retry-launch", "op-1"]);
  assert.equal(calls[1].options.cwd, calls[0].options.cwd);
  assert.ok(calls[1].args.includes("identity:workspace"));
});
test("only confirmed pre-launch refusals allow a fresh retry", async () => {
  await assert.rejects(
    mock({
      ok: false,
      error: { code: "agent_not_configured", message: "Configure agent" },
    })("w", "codex", "Explain"),
    (error) => error.refused === true,
  );
  await assert.rejects(
    mock({
      ok: false,
      error: { code: "agent_session_operation_unknown", message: "Unknown" },
    })("w", "codex", "Explain"),
    (error) => error.refused === false,
  );
});
test("malformed replay replies retain the existing operation ID", async () => {
  const launch = createOrcaLauncher({
    cli: "/mock/orca",
    run: async () => ({ stdout: "invalid JSON" }),
  });
  await assert.rejects(
    launch("w", "codex", "Explain", "op-1"),
    (error) => error.operationId === "op-1" && !error.refused,
  );
});
