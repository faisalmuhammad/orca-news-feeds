import { assert, mockHost, mountWorker, test } from "orca/testing";
import * as main from "../worker/main.mjs";
import { FeedService } from "../.orca/tests/core.mjs";
import { demoTransport } from "../build/scripts/demo-data.mjs";
test("Ask an agent uses the normal Orca launcher once with story context", async () => {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (k: string) => data.get(k) ?? null,
    set: async (k: string, v: unknown) => {
      data.set(k, v);
    },
    delete: async (k: string) => {
      data.delete(k);
    },
  };
  const service = new FeedService({ storage, transport: demoTransport() });
  const preview = await service.preview({
    kind: "rss",
    url: "https://example.org/host-test.xml",
  });
  await service.add({ token: preview.token });
  const item = (await service.snapshot()).items[0];
  await service.dispose();
  const host = mockHost({
    capabilities: ["storage:own", "workspace:read", "agent:launch"],
    storage: Object.fromEntries(data) as any,
    results: {
      "workspace.list": {
        workspaces: [
          {
            id: "workspace-1",
            kind: "folder",
            name: "News",
            path: "/news",
            branch: null,
            hostId: null,
          },
        ],
        truncated: false,
      },
      "agent.launch": { terminalId: "fresh-terminal" },
    },
  });
  const launches: { file: string; args: string[] }[] = [];
  const receipt = {
    kind: "chat",
    handle: "agent-fresh",
    sessionId: "codex-fresh",
    delivery: "journaled",
    detail: "Started a fresh chat.",
  };
  const launcher = main.createOrcaLauncher({
    cli: "/mock/orca",
    run: async (file: string, args: string[]) => {
      launches.push({ file, args });
      return {
        stdout: JSON.stringify({
          ok: true,
          result: {
            outcome: {
              kind: "structured",
              handle: "agent-fresh",
              sessionId: "codex-fresh",
            },
            prompt: {
              delivery: "submit",
              outcome: "journaled",
              messageId: "message-1",
            },
            receipt: { detail: "Started a fresh chat." },
          },
        }),
      };
    },
  });
  const worker = await mountWorker(
    { default: main.createActivate(launcher), deactivate: main.deactivate },
    { host },
  );
  const input = {
    id: item.id,
    question: "Explain the context.",
    agent: "codex",
    workspaceId: "workspace-1",
    requestId: "11111111-1111-4111-8111-111111111111",
  };
  assert.deepEqual(await worker.request("news.ask", input), receipt);
  assert.deepEqual(await worker.request("news.ask", input), receipt);
  assert.equal(host.callsOf("agent.launch").length, 0);
  assert.equal(launches.length, 1);
  assert.equal(launches[0].file, "/mock/orca");
  assert.ok(launches[0].args.includes("--focus"));
  assert.ok(launches[0].args.includes("id:workspace-1"));
  assert.ok(
    launches[0].args[launches[0].args.indexOf("--prompt") + 1].includes(
      "Explain the context.",
    ),
  );
  assert.deepEqual(worker.refusals, []);
  await worker.deactivate();
});
test("the real worker bridge activates with the manifest grants", async () => {
  const host = mockHost({
    capabilities: ["storage:own", "workspace:read", "agent:launch"],
    results: {
      "workspace.list": { workspaces: [], truncated: false },
      "workspace.readContext": null,
    },
  });
  const worker = await mountWorker(main, { host });
  const snapshot = await worker.request("feeds.snapshot");
  assert.equal((snapshot as { total: number }).total, 0);
  const options = await worker.request("news.workspaces");
  assert.deepEqual(options, {
    workspaces: [],
    suggestedId: null,
    truncated: false,
  });
  assert.deepEqual(worker.refusals, []);
  await worker.deactivate();
});
