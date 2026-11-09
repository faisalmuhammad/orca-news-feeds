import { execFileSync } from "node:child_process";
import { mkdir, copyFile, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
const cli =
    process.env.ORCA_CLI_COMMAND ??
    "/Applications/Orca.app/Contents/Resources/bin/orca",
  root = fileURLToPath(new URL("../../", import.meta.url));
const out = path.join(root, ".orca/shots");
await mkdir(out, { recursive: true });
function call(args) {
  let raw;
  try {
    raw = execFileSync(cli, [...args, "--json"], {
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      timeout: 20000,
    });
  } catch (error) {
    if (!error.stdout) throw error;
    raw = error.stdout;
  }
  const data = JSON.parse(raw.slice(raw.indexOf("{")));
  if (!data.ok)
    throw Object.assign(new Error(data.error?.message), {
      code: data.error?.code,
    });
  return data.result;
}
const page = call([
  "tab",
  "create",
  "--url",
  "http://127.0.0.1:4329/",
]).browserPageId;
function evaluate(expression) {
  const value = call([
    "eval",
    "--page",
    page,
    "--expression",
    expression,
  ]).result;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function press(selector) {
  evaluate("document.querySelector(" + JSON.stringify(selector) + ").click()");
}
function wait(selector) {
  call(["wait", "--page", page, "--selector", selector]);
}
function overflow(label) {
  const sizes = evaluate(
    "({width:app.clientWidth,scroll:app.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth})",
  );
  assert.ok(sizes.scroll <= sizes.width + 1, label + " panel overflow");
  assert.ok(sizes.body <= sizes.viewport + 1, label + " body overflow");
}
async function shot(name) {
  evaluate("document.activeElement?.blur()");
  const rect = evaluate(
    "(()=>{const r=app.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}})()",
  );
  const result = call(["screenshot", "--page", page]);
  const target = path.join(out, name + ".png");
  if (process.platform === "darwin")
    execFileSync(
      "sips",
      [
        "--cropToHeightWidth",
        String(rect.h),
        String(rect.w),
        "--cropOffset",
        String(rect.y),
        String(rect.x),
        result.path,
        "--out",
        target,
      ],
      { stdio: "ignore" },
    );
  else await copyFile(result.path, target);
  return target;
}
const report = [];
const accordionOnly = process.argv.includes("--accordion");
const startersOnly = process.argv.includes("--starters");
const imagesOnly = process.argv.includes("--images");
const createdStarterIds = [];
function checkAccordion() {
  const first = ".story-card:nth-child(1) .row-title";
  const second = ".story-card:nth-child(2) .row-title";
  const firstId = evaluate(
    "document.querySelector(" + JSON.stringify(first) + ").dataset.item",
  );
  const secondId = evaluate(
    "document.querySelector(" + JSON.stringify(second) + ").dataset.item",
  );
  const expectExpanded = (id) => {
    assert.equal(
      evaluate('document.querySelectorAll(".story-card.expanded").length'),
      1,
    );
    assert.equal(
      evaluate('document.querySelector(".story-card.expanded").dataset.story'),
      id,
    );
  };
  press(first);
  expectExpanded(firstId);
  press('[data-focus^="ask-agent-"]');
  wait("#ask-workspace");
  press(second);
  expectExpanded(secondId);
  assert.ok(evaluate('!document.querySelector(".inline-ask")'));
  assert.equal(
    evaluate(
      "document.querySelector(" +
        JSON.stringify(first) +
        ').getAttribute("aria-expanded")',
    ),
    false,
  );
  press(first);
  expectExpanded(firstId);
  assert.ok(
    evaluate('!document.querySelector(".inline-ask")'),
    "previous agent form stays closed",
  );
  press(first);
  assert.equal(
    evaluate('document.querySelectorAll(".story-card.expanded").length'),
    0,
  );
  evaluate("document.querySelector(" + JSON.stringify(second) + ").focus()");
  call(["keypress", "--page", page, "--key", "Enter"]);
  expectExpanded(secondId);
  evaluate("document.querySelector(" + JSON.stringify(first) + ").focus()");
  call(["keypress", "--page", page, "--key", "Enter"]);
  expectExpanded(firstId);
  call(["keypress", "--page", page, "--key", "Escape"]);
  assert.equal(
    evaluate('document.querySelectorAll(".story-card.expanded").length'),
    0,
  );
  report.push("opening another story closes the previous card and agent form");
  report.push("accordion switching with Enter and collapse with Escape");
}
try {
  wait(".story-card");
  if (imagesOnly)
    evaluate(
      "window.imageFixture = " +
        JSON.stringify(
          "data:image/png;base64," +
            (
              await readFile(path.join(root, "tests/fixtures/preview.png"))
            ).toString("base64"),
        ),
    );
  // Exercise the native request branch against the preview service, with the
  // bridge's strict JSON checks before HTTP can silently omit undefined fields.
  evaluate(`(() => {
    const isJson = value => value === null || typeof value === 'string' ||
      typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
      (Array.isArray(value) ? value.every(isJson) :
        typeof value === 'object' && Object.values(value).every(isJson));
    window.bridgeChecks = { requests: 0, rejected: 0, asks: [], adds: [], previews: [] };
    window.orca = { plugin: { request: async (name, input, options) => {
      window.bridgeChecks.requests++;
      if (name === 'news.workspaces' && window.failWorkspaceOnce) {
        window.failWorkspaceOnce = false;
        throw new Error('Workspace lookup temporarily unavailable');
      }
      if (name === 'news.ask') {
        window.bridgeChecks.asks.push(input);
        if (window.simulatedAgentReceipt) return window.simulatedAgentReceipt;
      }
      if (name === 'sources.preview') window.bridgeChecks.previews.push(input);
      if (name === 'sources.add') window.emptyLibrary = false;
      if (name === 'items.image' && window.imageFixture) {
        window.imageRequests = (window.imageRequests ?? 0) + 1;
        const offset = input.offset ?? 0, end = offset + 512;
        return {chunk: input.id === window.imageItemId ? window.imageFixture.slice(offset,end) : null, nextOffset: end < window.imageFixture.length ? end : null, key: 'fixture'};
      }
      if (!isJson(input)) {
        window.bridgeChecks.rejected++;
        throw new Error('input: Invalid input');
      }
      const response = await fetch('/api', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, input }), signal: options?.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (name === 'sources.add') window.bridgeChecks.adds.push(body.result.source);
      if (name === 'feeds.snapshot' && window.emptyLibrary) return {...body.result, sources: [], items: [], total: 0, unread: 0, saved: 0, hasMore: false};
      if (name === 'feeds.snapshot' && window.imageFixture) {
        window.imageItemId = body.result.items[0].id;
        return {...body.result, items: body.result.items.map((item,i) => ({...item,imageUrl:i<2 ? 'https://images.example.org/preview-'+i+'.png' : undefined}))};
      }
      return body.result;
    } } };
  })()`);
  assert.ok(
    evaluate(
      '(async () => { await document.fonts.load("13px Geist"); return document.fonts.check("13px Geist"); })()',
    ),
    "bundled UI font loads",
  );
  assert.ok(
    evaluate(
      '[...app.querySelectorAll("h1,h2,h3,button,input,select,textarea")].every(node => getComputedStyle(node).fontFamily.includes("Geist"))',
    ),
  );
  evaluate(
    'document.documentElement.style.setProperty("--orca-font-family", "monospace")',
  );
  assert.ok(
    evaluate(
      '[...app.querySelectorAll("h1,h2,h3,button,input,select,textarea")].every(node => getComputedStyle(node).fontFamily.includes("monospace"))',
    ),
  );
  evaluate(
    'document.documentElement.style.removeProperty("--orca-font-family")',
  );
  report.push(
    "Orca default font loads; headings and controls inherit the font token",
  );
  if (imagesOnly) {
    evaluate(
      'window.orca.plugin.request("preferences.update", {compact:false})',
    );
    press('[data-focus="filter-all"]');
    wait(".story-preview.loaded img");
    wait(".story-card:nth-child(2):not(:has(.story-preview))");
    assert.ok(
      evaluate(
        'document.querySelector(".story-preview img").src.startsWith("data:image/png;base64,")',
      ),
    );
    assert.equal(
      evaluate('document.querySelector(".story-preview img").naturalWidth'),
      320,
    );
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      overflow(width + " image card");
    }
    await shot("image-cards-light");
    press(".story-card:first-child .row-title");
    wait(".expanded .story-preview.loaded");
    assert.equal(
      evaluate(
        'getComputedStyle(document.querySelector(".expanded .story-preview img")).objectFit',
      ),
      "contain",
    );
    evaluate(
      'document.documentElement.classList.add("dark");document.documentElement.classList.remove("light")',
    );
    await shot("image-card-expanded-dark");
    press(".story-card:nth-child(2) .row-title");
    assert.equal(
      evaluate('document.querySelectorAll(".story-card.expanded").length'),
      1,
    );
    press(".story-card:nth-child(2) .row-title");
    press('[data-focus="manage-sources"]');
    wait('[data-focus="compact"]');
    press('[data-focus="compact"]');
    wait(".app.compact");
    press('[data-focus="back"]');
    wait(".story-card");
    assert.equal(
      evaluate('document.querySelectorAll(".story-preview").length'),
      0,
    );
    press(".story-card:first-child .row-title");
    wait(".expanded .story-preview.loaded");
    press('[data-focus="manage-sources"]');
    press('[data-focus="compact"]');
    report.push(
      "image previews load through worker data URLs; unavailable images collapse",
    );
    report.push(
      "image cards fit 240/320/440 px; expanded images preserve their full frame",
    );
    report.push(
      "accordion stays intact; compact cards show images only when expanded",
    );
  } else if (startersOnly) {
    evaluate("window.emptyLibrary = true");
    press('[data-focus="filter-all"]');
    wait(".welcome .starter-feeds");
    assert.equal(
      evaluate('document.querySelectorAll(".welcome .starter-rss").length'),
      3,
    );
    assert.equal(evaluate("window.bridgeChecks.adds.length"), 0);
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      overflow(width + " welcome starter choices");
    }
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","320px")',
    );
    await shot("welcome-starters-light-320");
    press('[data-focus="add-source"]');
    wait('[data-focus="follow-github-blog"]');
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","440px");document.documentElement.style.setProperty("--preview-height","860px")',
    );
    await shot("rss-suggestions-light");
    evaluate(
      'document.documentElement.style.setProperty("--preview-height","760px")',
    );
    press('[data-focus="back"]');
    wait(".welcome .starter-feeds");
    report.push(
      "empty library offers three starter choices without subscribing",
    );
    for (const [id, label, url] of [
      ["lobsters", "Lobsters", "https://lobste.rs/rss"],
      ["cloudflare", "Cloudflare", "https://blog.cloudflare.com/rss/"],
      [
        "typescript",
        "TypeScript",
        "https://devblogs.microsoft.com/typescript/feed/",
      ],
      ["github-blog", "GitHub Blog", "https://github.blog/feed/"],
      ["mozilla-hacks", "Mozilla Hacks", "https://hacks.mozilla.org/feed/"],
      [
        "stackoverflow-blog",
        "Stack Overflow Blog",
        "https://stackoverflow.blog/feed/",
      ],
    ]) {
      if (id !== "lobsters") {
        press('[data-focus="add-source"]');
        wait('[data-focus="follow-' + id + '"]');
      }
      press('[data-focus="follow-' + id + '"]');
      wait("#feed-list .story-card");
      const added = evaluate("window.bridgeChecks.adds.at(-1)");
      createdStarterIds.push(added.id);
      assert.equal(added.label, label);
      assert.equal(added.url, url);
      assert.equal(evaluate("window.bridgeChecks.previews.at(-1).url"), url);
      assert.equal(
        evaluate("window.bridgeChecks.adds.length"),
        createdStarterIds.length,
      );
      report.push("one-click follow: " + label);
      press('[data-focus="add-source"]');
      wait('[data-focus="follow-' + id + '"]');
      assert.ok(
        evaluate(
          'document.querySelector("[data-focus=follow-' + id + ']").disabled',
        ),
      );
      press('[data-focus="back"]');
      wait("#feed-list .story-card");
    }
    press('[data-focus="add-source"]');
    press('[data-focus="type-reddit"]');
    wait("#subreddit");
    assert.equal(
      evaluate('document.querySelectorAll(".starter-reddit").length'),
      6,
    );
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      overflow(width + " subreddit suggestions");
    }
    evaluate(
      'document.documentElement.style.setProperty("--preview-height","860px")',
    );
    await shot("reddit-suggestions-light");
    evaluate(
      'document.documentElement.style.setProperty("--preview-height","760px")',
    );
    evaluate(
      'document.querySelector("#reddit-sort").value="new";document.querySelector("#reddit-sort").dispatchEvent(new Event("change",{bubbles:true}))',
    );
    press('[data-focus="follow-reddit-webdev"]');
    wait("#feed-list .story-card");
    const community = evaluate("window.bridgeChecks.adds.at(-1)");
    createdStarterIds.push(community.id);
    assert.equal(community.kind, "reddit");
    assert.equal(community.subreddit, "webdev");
    assert.equal(community.sort, "new");
    assert.equal(community.label, "r/webdev");
    press('[data-focus="add-source"]');
    press('[data-focus="type-reddit"]');
    evaluate(
      'document.querySelector("#reddit-sort").value="new";document.querySelector("#reddit-sort").dispatchEvent(new Event("change",{bubbles:true}))',
    );
    wait('[data-focus="follow-reddit-webdev"]');
    assert.ok(
      evaluate(
        'document.querySelector("[data-focus=follow-reddit-webdev]").disabled',
      ),
    );
    evaluate(
      'document.querySelector("#reddit-sort").value="hot";document.querySelector("#reddit-sort").dispatchEvent(new Event("change",{bubbles:true}))',
    );
    assert.ok(
      evaluate(
        '!document.querySelector("[data-focus=follow-reddit-webdev]").disabled',
      ),
    );
    report.push(
      "Reddit suggests six tech communities; one-click following honors listing and prevents duplicates",
    );
  } else if (accordionOnly) {
    press('[data-focus="filter-rss"]');
    wait(".source-type.rss");
    checkAccordion();
  } else {
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      for (const theme of ["light", "dark"]) {
        evaluate(
          'document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(' +
            JSON.stringify(theme) +
            ")",
        );
        overflow(width + " " + theme);
        await shot("feeds-" + theme + "-" + width);
        report.push(width + "px " + theme + " layout");
        press(".row-title");
        wait(".story-card.expanded");
        overflow(width + " " + theme + " expanded card");
        assert.equal(
          evaluate(
            'document.querySelector(".row-title").getAttribute("aria-expanded")',
          ),
          true,
        );
        assert.ok(
          evaluate(
            '!!document.querySelector("#feed-list .story-card .card-actions")',
          ),
        );
        await shot("expanded-" + theme + "-" + width);
        press(".row-title");
        wait('.row-title[aria-expanded="false"]');
        report.push(width + "px " + theme + " inline expansion");
      }
    }
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","320px");document.documentElement.classList.remove("dark");document.documentElement.classList.add("light")',
    );
    press('[data-focus="filter-rss"]');
    wait(".source-type.rss");
    assert.equal(
      evaluate(
        'document.querySelectorAll(".source-type.hn,.source-type.reddit").length',
      ),
      0,
    );
    report.push("provider filtering");
    checkAccordion();
    evaluate('document.querySelector(".row-title").focus()');
    call(["keypress", "--page", page, "--key", "ArrowDown"]);
    assert.ok(
      evaluate('document.activeElement.classList.contains("row-title")'),
    );
    report.push("physical keyboard navigation");
    const snapshot = call(["snapshot", "--page", page, "--interactive"]).refs;
    const searchRef = Object.entries(snapshot).find(
      ([, v]) => v.name === "Search headlines",
    )[0];
    call([
      "fill",
      "--page",
      page,
      "--element",
      "@" + searchRef,
      "--value",
      "network",
    ]);
    wait(".row-title");
    assert.equal(evaluate('document.querySelectorAll(".row-title").length'), 1);
    assert.ok(
      evaluate(
        'document.querySelector(".row-title").textContent.includes("network")',
      ),
    );
    report.push("search");
    evaluate('document.querySelector(".row-title").focus()');
    call(["keypress", "--page", page, "--key", "Enter"]);
    wait(".story-card.expanded");
    assert.ok(
      evaluate(
        '!!document.querySelector("#feed-list [data-focus^=ask-agent-]")',
      ),
    );
    const expandedId = evaluate(
      'document.querySelector(".story-card.expanded").dataset.story',
    );
    await shot("expanded-rss-light-320");
    const wasRead = evaluate(
      'document.querySelector(".story-card.expanded").classList.contains("read")',
    );
    press('[data-focus^="card-read-"]');
    wait(
      wasRead ? ".story-card.expanded:not(.read)" : ".story-card.expanded.read",
    );
    assert.equal(
      evaluate('document.querySelector(".story-card.expanded").dataset.story'),
      expandedId,
    );
    press('[data-focus^="card-read-"]');
    wait(
      wasRead ? ".story-card.expanded.read" : ".story-card.expanded:not(.read)",
    );
    report.push("keyboard expansion and inline read/unread controls");
    const wasSaved = evaluate(
      'document.querySelector("[data-focus^=card-save-]").getAttribute("aria-pressed")==="true"',
    );
    press('[data-focus^="card-save-"]');
    wait(
      wasSaved
        ? '[data-focus^="card-save-"][aria-pressed="false"]'
        : '[data-focus^="card-save-"][aria-pressed="true"]',
    );
    press('[data-focus^="card-save-"]');
    wait(
      wasSaved
        ? '[data-focus^="card-save-"][aria-pressed="true"]'
        : '[data-focus^="card-save-"][aria-pressed="false"]',
    );
    report.push("save and unsave");
    evaluate("window.failWorkspaceOnce = true");
    press('[data-focus^="ask-agent-"]');
    wait(".notice");
    assert.ok(
      evaluate(
        'document.querySelector(".notice").textContent.includes("Workspace lookup temporarily unavailable")',
      ),
    );
    press('[data-focus^="ask-agent-"]');
    press('[data-focus^="ask-agent-"]');
    wait("#ask-workspace");
    report.push("inline agent form retries a failed workspace lookup");
    assert.ok(
      evaluate(
        '!!document.querySelector("#feed-list .story-card.expanded .inline-ask #ask-workspace")',
      ),
    );
    press(".question-chip");
    assert.ok(
      evaluate(
        'document.querySelector("#news-question").value.includes("Explain")',
      ),
    );
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      overflow(width + " inline agent form");
    }
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","320px");document.querySelector(".inline-ask").scrollIntoView({block:"start"})',
    );
    await shot("ask-inline-light-320");
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","440px");document.documentElement.style.setProperty("--preview-height","860px");document.querySelector(".inline-ask").scrollIntoView({block:"end"})',
    );
    await shot("ask-inline-light-440");
    evaluate(
      'document.documentElement.style.setProperty("--preview-width","320px");document.documentElement.style.setProperty("--preview-height","760px")',
    );
    press('[data-focus="launch-agent"]');
    wait(".notice");
    assert.ok(
      evaluate(
        'document.querySelector(".notice").textContent.includes("does not start agents")',
      ),
    );
    report.push("Ask an agent form; preview never launches a real agent");
    const sent = evaluate("window.bridgeChecks.asks[0]");
    assert.equal(
      sent.id,
      expandedId,
      "agent question targets the expanded story",
    );
    assert.ok(sent.question.includes("Explain"));
    press('[data-focus^="ask-agent-"]');
    assert.ok(evaluate('!document.querySelector(".inline-ask")'));
    press('[data-focus^="ask-agent-"]');
    wait("#news-question");
    assert.ok(
      evaluate(
        'document.querySelector("#news-question").value.includes("Explain")',
      ),
    );
    press('[data-focus="launch-agent"]');
    wait(".notice");
    assert.equal(
      evaluate("window.bridgeChecks.asks.at(-1).requestId"),
      sent.requestId,
      "same question reuses its launch request after a failed reply",
    );
    evaluate(`(() => {
      window.simulatedAgentReceipt = {kind:'chat',handle:'simulated-agent',sessionId:'simulated-chat',delivery:'journaled',detail:'Simulated successful launch'};
      const question = document.querySelector('#news-question');
      question.value = 'Give me the history behind this story.';
      question.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    press('[data-focus="launch-agent"]');
    call(["wait", "--page", page, "--text", "Your conversation is open"]);
    assert.notEqual(
      evaluate("window.bridgeChecks.asks.at(-1).requestId"),
      sent.requestId,
    );
    assert.ok(
      evaluate(
        'document.querySelector(".inline-ask").textContent.includes("fresh codex chat")',
      ),
    );
    for (const width of [240, 320, 440]) {
      evaluate(
        'document.documentElement.style.setProperty("--preview-width",' +
          JSON.stringify(width + "px") +
          ")",
      );
      overflow(width + " confirmed agent receipt");
    }
    press('[data-focus^="ask-agent-"]');
    press('[data-focus^="ask-agent-"]');
    assert.ok(
      evaluate(
        'document.querySelector(".inline-ask").textContent.includes("Your conversation is open")',
      ),
    );
    assert.equal(evaluate("window.bridgeChecks.asks.length"), 3);
    report.push(
      "agent failure retries preserve request ID; changed question creates a new request",
    );
    report.push(
      "confirmed chat receipt renders at all panel widths and survives form reopening",
    );
    call(["keypress", "--page", page, "--key", "Escape"]);
    assert.ok(evaluate('!document.querySelector(".inline-ask")'));
    assert.ok(evaluate('!!document.querySelector(".story-card.expanded")'));
    call(["keypress", "--page", page, "--key", "Escape"]);
    assert.ok(evaluate('!document.querySelector(".story-card.expanded")'));
    assert.ok(
      evaluate('document.activeElement.classList.contains("row-title")'),
    );
    report.push(
      "inline form preserves question; Escape closes form then collapses card",
    );
    press('[data-focus="manage-sources"]');
    wait(".source-card");
    overflow("sources");
    await shot("sources-light-320");
    press('[data-focus="compact"]');
    wait(".app.compact");
    press('[data-focus="compact"]');
    wait(".app:not(.compact)");
    report.push("source management and density preference");
    press('[data-focus="sources-add"]');
    wait("#feed-url");
    const refs = call(["snapshot", "--page", page, "--interactive"]).refs;
    const urlRef = Object.entries(refs).find(
      ([, v]) => v.name === "Feed URL",
    )[0];
    call([
      "fill",
      "--page",
      page,
      "--element",
      "@" + urlRef,
      "--value",
      "https://example.org/browser-check.xml",
    ]);
    press('[data-focus="preview-source"]');
    wait('[data-focus="follow-source"]');
    assert.ok(
      evaluate(
        'document.querySelector(".preview-count").textContent.includes("stories")',
      ),
    );
    report.push("source preview");
    const bridge = evaluate("window.bridgeChecks");
    assert.ok(bridge.requests >= 10, "native request branch exercised");
    assert.equal(bridge.rejected, 0, "all panel request payloads are JSON");
    report.push("native bridge JSON payload validation");
    press('[data-focus="back"]');
    wait(".story-card");
    press('[data-focus="manage-sources"]');
    wait('[data-focus="language"]');
    evaluate(`(() => {
      const language = document.querySelector('[data-focus="language"]');
      language.value = 'zh-CN';
      language.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    call(["wait", "--page", page, "--text", "整理你的订阅角落"]);
    assert.equal(evaluate("document.documentElement.lang"), "zh-CN");
    assert.equal(evaluate("document.title"), "订阅");
    assert.equal(
      evaluate(
        'document.querySelector(\'[data-focus="refresh"]\').getAttribute("aria-label")',
      ),
      "刷新订阅",
    );
    assert.equal(
      evaluate('document.querySelector(\'[data-focus="language"]\').value'),
      "zh-CN",
    );
    evaluate("location.reload(); true");
    wait(".story-card");
    press('[data-focus="manage-sources"]');
    call(["wait", "--page", page, "--text", "整理你的订阅角落"]);
    assert.equal(
      evaluate('document.querySelector(\'[data-focus="language"]\').value'),
      "zh-CN",
    );
    evaluate(`(() => {
      const language = document.querySelector('[data-focus="language"]');
      language.value = 'en';
      language.dispatchEvent(new Event('change', {bubbles:true}));
    })()`);
    call(["wait", "--page", page, "--text", "Curate your corner"]);
    assert.equal(evaluate("document.documentElement.lang"), "en");
    report.push("English and Chinese switch immediately and persist across reload");
  }
  const consoleResult = call(["console", "--page", page, "--limit", "50"]);
  await writeFile(
    path.join(
      out,
      imagesOnly
        ? "images-report.json"
        : startersOnly
          ? "starters-report.json"
          : accordionOnly
            ? "accordion-report.json"
            : "browser-report.json",
    ),
    JSON.stringify({ checks: report, console: consoleResult }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, checks: report, captures: out }));
} finally {
  for (const id of createdStarterIds) {
    const response = await fetch("http://127.0.0.1:4329/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "sources.remove", input: { id } }),
    });
    if (!response.ok)
      console.warn("Preview cleanup could not remove starter", id);
  }
  try {
    call(["tab", "close", "--page", page]);
  } catch (error) {
    if (error.code !== "browser_tab_not_found")
      console.warn("Preview cleanup:", error.message);
  }
}
