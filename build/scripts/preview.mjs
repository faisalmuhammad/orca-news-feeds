import http from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FeedService } from "../../.orca/tests/core.mjs";
import { demoTransport } from "./demo-data.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url)),
  storePath = path.join(root, ".orca/preview/storage.json");
await mkdir(path.dirname(storePath), { recursive: true });
let data = {};
try {
  data = JSON.parse(await readFile(storePath, "utf8"));
} catch {}
let writes = Promise.resolve();
const save = () => {
  writes = writes.then(async () => {
    await writeFile(storePath + ".tmp", JSON.stringify(data));
    await rename(storePath + ".tmp", storePath);
  });
  return writes;
};
const storage = {
  get: async (key) => data[key] ?? null,
  set: async (key, value) => {
    data[key] = value;
    await save();
  },
  delete: async (key) => {
    delete data[key];
    await save();
  },
};
const feeds = new FeedService({ storage, transport: demoTransport() });
if (!data["feeds.v1.head"] && process.env.FEEDS_PREVIEW_EMPTY !== "1") {
  for (const draft of [
    { kind: "hn", category: "top" },
    { kind: "rss", url: "https://example.org/feed.xml" },
    { kind: "reddit", subreddit: "programming", sort: "hot" },
  ]) {
    const preview = await feeds.preview(draft);
    await feeds.add({ token: preview.token });
  }
  const initial = await feeds.snapshot();
  if (initial.items[2])
    await feeds.setSaved({ id: initial.items[2].id, saved: true });
  if (initial.items[5])
    await feeds.setRead({ id: initial.items[5].id, read: true });
}
const handlers = {
  "feeds.snapshot": (v) => feeds.snapshot(v),
  "feeds.refresh": (v) => feeds.refresh(v),
  "feeds.more": (v) => feeds.more(v),
  "sources.preview": (v) => feeds.preview(v),
  "sources.add": (v) => feeds.add(v),
  "sources.update": (v) => feeds.update(v),
  "sources.remove": (v) => feeds.remove(v),
  "items.setRead": (v) => feeds.setRead(v),
  "items.markRead": (v) => feeds.markRead(v),
  "items.setSaved": (v) => feeds.setSaved(v),
  "items.image": (v) => feeds.image(v),
  "preferences.update": (v) => feeds.preferences(v),
  "news.workspaces": async () => ({
    workspaces: [
      { id: "preview-workspace", name: "Preview workspace", hostId: null },
    ],
    suggestedId: "preview-workspace",
    truncated: false,
  }),
  "news.ask": async () => {
    throw new Error(
      "This preview does not start agents. Open Feeds in Orca to ask about a story.",
    );
  },
};
const port = Number(process.env.FEEDS_PREVIEW_PORT ?? 4329),
  mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".map": "application/json",
    ".woff2": "font/woff2",
  };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:" + port);
    if (url.pathname === "/api" && req.method === "POST") {
      if (
        req.headers.origin &&
        new URL(req.headers.origin).host !== req.headers.host
      ) {
        res.writeHead(403).end();
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 65536) {
          res.writeHead(413).end();
          return;
        }
      }
      const { name, input } = JSON.parse(body);
      if (!Object.hasOwn(handlers, name)) {
        res.writeHead(404).end();
        return;
      }
      try {
        const result = await handlers[name](input ?? {});
        res
          .writeHead(200, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          })
          .end(JSON.stringify({ result }));
      } catch (error) {
        res
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: error.message }));
      }
      return;
    }
    const panel = path.join(root, "panel"),
      file = path.resolve(
        panel,
        "." +
          (url.pathname === "/"
            ? "/index.html"
            : decodeURIComponent(url.pathname)),
      );
    if (!file.startsWith(panel + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const content = await readFile(file);
    res
      .writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      })
      .end(content);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    "Feeds preview: http://127.0.0.1:" +
      port +
      " · sample headlines, separate storage",
  ),
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () => {
    server.close();
    void feeds.dispose().then(() => process.exit(0));
  });
