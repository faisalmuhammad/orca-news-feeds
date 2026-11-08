import type {} from "orca/frame";
import type {
  FeedQuery,
  Kind,
  Preview,
  Snapshot,
  SourceDraft,
  SourceView,
  ViewItem,
  NewsLaunchReceipt,
  ImagePart,
} from "../shared/model";
import { icon } from "./icons";
import { usefulExcerpt } from "../shared/model";
type AgentOptions = {
  workspaces: { id: string; name: string; hostId: string | null }[];
  suggestedId: string | null;
  truncated: boolean;
};
const app = document.getElementById("app")!,
  announcer = document.getElementById("announcer")!;
const previewMode =
  !globalThis.orca && ["localhost", "127.0.0.1"].includes(location.hostname);
const state = {
  view: "list" as "list" | "sources" | "add",
  expanded: new Set<string>(),
  askOpen: false,
  filter: "all" as FeedQuery["filter"],
  sourceId: "",
  query: "",
  unread: false,
  order: "latest" as "latest" | "source",
  limit: 50,
  snapshot: null as Snapshot | null,
  item: null as ViewItem | null,
  error: "",
  message: "",
  working: false,
  loading: true,
  closed: false,
  editId: "",
  editLabel: "",
  draft: {
    kind: "rss",
    url: "",
    category: "top",
    subreddit: "",
    sort: "hot",
  } as SourceDraft,
  preview: null as Preview | null,
  sourceLabel: "",
  fetching: false,
  followingStarter: "",
  agentOptions: null as AgentOptions | null,
  workspacesLoading: false,
  question: "",
  agent: "codex",
  workspaceId: "",
  askId: "",
  askResult: null as NewsLaunchReceipt | null,
  askFingerprint: "",
  askPending: false,
  scroll: 0,
};
let sequence = 0,
  searchTimer: ReturnType<typeof setTimeout> | undefined,
  changeTimer: ReturnType<typeof setTimeout> | undefined,
  previewController: AbortController | undefined;
const previewImages = new Map<string, string>();
const pendingImages = new Map<string, Promise<string | null>>();
let imageObserver: IntersectionObserver | undefined;
let imageQueue: HTMLElement[] = [];
let imageRequests = 0;
function renderImage(item: ViewItem): HTMLElement {
  const preview = el("div", undefined, "story-preview");
  preview.dataset.imageId = item.id;
  preview.dataset.imageUrl = item.imageUrl;
  preview.setAttribute("aria-hidden", "true");
  return preview;
}
async function loadImage(id: string): Promise<string | null> {
  let data = "",
    offset = 0,
    key: string | undefined;
  for (let part = 0; part < 12; part++) {
    const result = await request<ImagePart>("items.image", { id, offset, key });
    if (!result.chunk || (key && result.key !== key)) return null;
    data += result.chunk;
    if (data.length > 3 * 1024 * 1024) return null;
    key = result.key;
    if (result.nextOffset === null) return data;
    if (result.nextOffset !== data.length || result.nextOffset <= offset)
      return null;
    offset = result.nextOffset;
  }
  return null;
}
function drainImages() {
  while (imageRequests < 3 && imageQueue.length) {
    const preview = imageQueue.shift()!;
    if (!preview.isConnected || !preview.getClientRects().length) continue;
    const url = preview.dataset.imageUrl!,
      id = preview.dataset.imageId!;
    imageRequests++;
    let result = pendingImages.get(url);
    if (!result) {
      result = previewImages.has(url)
        ? Promise.resolve(previewImages.get(url)!)
        : loadImage(id)
            .then((dataUrl) => {
              if (
                dataUrl &&
                /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(
                  dataUrl,
                )
              ) {
                previewImages.set(url, dataUrl);
                while (previewImages.size > 8)
                  previewImages.delete(previewImages.keys().next().value!);
                return dataUrl;
              }
              return null;
            })
            .catch(() => null);
      pendingImages.set(url, result);
    }
    void result
      .then((dataUrl) => {
        if (!preview.isConnected) return;
        if (!dataUrl) {
          preview.remove();
          return;
        }
        const image = el("img");
        image.alt = "";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.onload = () => {
          if (image.naturalWidth < 40 || image.naturalHeight < 40)
            preview.remove();
          else preview.classList.add("loaded");
        };
        image.onerror = () => {
          previewImages.delete(url);
          preview.remove();
        };
        preview.append(image);
        image.src = dataUrl;
      })
      .finally(() => {
        pendingImages.delete(url);
        imageRequests--;
        drainImages();
      });
  }
}
function observeImages() {
  imageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          imageObserver?.unobserve(entry.target);
          imageQueue.push(entry.target as HTMLElement);
        }
      drainImages();
    },
    { root: app.querySelector("#feed-list"), rootMargin: "100px" },
  );
  for (const preview of app.querySelectorAll<HTMLElement>(".story-preview"))
    imageObserver.observe(preview);
}
async function request<T = any>(
  name: string,
  input: unknown = {},
  signal?: AbortSignal,
): Promise<T> {
  // The native bridge validates JSON before transport; optional undefined fields
  // must be omitted just as they are by the preview's HTTP serialization.
  const payload = JSON.parse(JSON.stringify(input));
  if (globalThis.orca)
    return orca.plugin.request(name, payload, {
      timeoutMs: name === "news.ask" ? 120000 : 60000,
      signal,
    }) as Promise<T>;
  if (!previewMode)
    throw new Error("Open Feeds in Orca to connect to your feed library.");
  const response = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, input: payload }),
    signal,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error ?? "This action could not be completed.");
  return body.result as T;
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  cls?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function button(
  text: string,
  action: () => unknown,
  cls = "button",
  glyph?: string,
  key?: string,
) {
  const b = el("button", undefined, cls);
  b.type = "button";
  if (glyph) b.append(icon(glyph));
  if (text) b.append(document.createTextNode(text));
  if (key) b.dataset.focus = key;
  b.onclick = () => void action();
  return b;
}
function iconButton(
  label: string,
  glyph: string,
  action: () => unknown,
  key?: string,
  active = false,
) {
  const b = button(
    "",
    action,
    "icon-btn" + (active ? " active" : ""),
    glyph,
    key,
  );
  b.setAttribute("aria-label", label);
  b.title = label;
  return b;
}
function announce(text: string) {
  announcer.textContent = "";
  requestAnimationFrame(() => (announcer.textContent = text));
}
function fail(error: unknown) {
  state.error =
    error instanceof Error
      ? error.message
      : "This action could not be completed.";
  announce(state.error);
  render();
}
function query(): FeedQuery {
  return {
    filter: state.filter,
    sourceId: state.sourceId || undefined,
    query: state.query,
    unread: state.unread,
    order: state.order,
  };
}
function remember() {
  try {
    sessionStorage.setItem(
      "feeds.view.v1",
      JSON.stringify({
        filter: state.filter,
        sourceId: state.sourceId,
        unread: state.unread,
        order: state.order,
      }),
    );
  } catch {}
}
function restore() {
  try {
    const s = JSON.parse(sessionStorage.getItem("feeds.view.v1") ?? "null");
    if (s && ["all", "rss", "hn", "reddit", "saved"].includes(s.filter)) {
      state.filter = s.filter;
      state.sourceId = typeof s.sourceId === "string" ? s.sourceId : "";
      state.unread = s.unread === true;
      state.order = s.order === "source" ? "source" : "latest";
    }
  } catch {}
}
function relative(at: number | null) {
  if (!at) return "Undated";
  const min = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (min < 1) return "now";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  return d < 7
    ? d + "d"
    : new Date(at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}
function domain(url: string | null) {
  try {
    const host = new URL(url!).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}
function sourceMark(kind: Kind) {
  const mark = el("span", undefined, "source-type " + kind);
  mark.append(icon(kind === "rss" ? "feed" : kind));
  return mark;
}
function captureFocus() {
  const active = document.activeElement as HTMLInputElement;
  return {
    key: active?.dataset?.focus,
    start: active?.selectionStart,
    end: active?.selectionEnd,
    scroll: app.querySelector(".scroll")?.scrollTop ?? 0,
  };
}
function restoreFocus(saved: ReturnType<typeof captureFocus>) {
  if (saved.key) {
    const target = [...app.querySelectorAll<HTMLElement>("[data-focus]")].find(
      (e) => e.dataset.focus === saved.key,
    );
    target?.focus({ preventScroll: true });
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    )
      try {
        if (saved.start != null)
          target.setSelectionRange(saved.start, saved.end ?? saved.start);
      } catch {}
  }
  const scroll = app.querySelector(".scroll");
  if (scroll) scroll.scrollTop = saved.scroll;
}
async function loadSnapshot() {
  const seq = ++sequence,
    selection = query();
  try {
    let snapshot: Snapshot | undefined;
    const items: ViewItem[] = [];
    for (let offset = 0; offset < state.limit;) {
      const page = await request<Snapshot>("feeds.snapshot", {
        ...selection,
        offset,
        limit: Math.min(50, state.limit - offset),
      });
      if (seq !== sequence || state.closed) return;
      snapshot ??= page;
      items.push(...page.items);
      snapshot.hasMore = page.hasMore;
      offset = page.nextOffset ?? offset + page.items.length;
      if (!page.hasMore || !page.items.length) break;
    }
    if (!snapshot) return;
    snapshot.items = items;
    state.snapshot = snapshot;
    if (snapshot.notice) state.error = snapshot.notice;
    if (
      state.sourceId &&
      !snapshot.sources.some((s) => s.id === state.sourceId)
    ) {
      state.sourceId = "";
      void loadSnapshot();
      return;
    }
    if (state.item) {
      const latest = items.find((i) => i.id === state.item!.id);
      if (latest) state.item = latest;
    }
    state.loading = false;
    render();
  } catch (error) {
    if (seq === sequence && !state.closed) {
      state.loading = false;
      fail(error);
    }
  }
}
async function perform(action: () => Promise<unknown>, message = "") {
  if (state.working) return;
  state.working = true;
  state.error = "";
  render();
  try {
    await action();
    if (message) {
      state.message = message;
      announce(message);
    }
    await loadSnapshot();
  } catch (error) {
    fail(error);
  } finally {
    state.working = false;
    if (!state.closed) render();
  }
}
async function refresh(sourceId?: string) {
  try {
    state.error = "";
    const result = await request<{ queued: number; blocked: number }>(
      "feeds.refresh",
      { sourceId, force: true },
    );
    state.message =
      result.blocked && !result.queued
        ? "This source needs a moment before another refresh."
        : !result.queued
          ? "Your sources are up to date."
          : "";
    await loadSnapshot();
  } catch (error) {
    fail(error);
  }
}
function back() {
  previewController?.abort();
  state.fetching = false;
  state.preview = null;
  state.view = "list";
  render();
  const scroll = app.querySelector(".scroll");
  if (scroll && state.view === "list") scroll.scrollTop = state.scroll;
  if (state.item && state.view === "list")
    [...app.querySelectorAll<HTMLElement>("[data-item]")]
      .find((e) => e.dataset.item === state.item!.id)
      ?.focus({ preventScroll: true });
}
function openAdd(kind: Kind = "rss") {
  if (state.view === "list")
    state.scroll = app.querySelector(".scroll")?.scrollTop ?? 0;
  state.view = "add";
  state.draft = { kind, url: "", category: "top", subreddit: "", sort: "hot" };
  state.preview = null;
  state.sourceLabel = "";
  state.error = "";
  render();
}
function switchFilter(filter: FeedQuery["filter"]) {
  state.filter = filter;
  state.sourceId = "";
  state.limit = 50;
  state.order = "latest";
  remember();
  void loadSnapshot();
}
function header() {
  const head = el("header", undefined, "header"),
    mark = el("span", undefined, "brandmark");
  mark.append(icon("feed"));
  const brand = el("div");
  brand.append(
    el("h1", "Feeds", "wordmark"),
    el("span", "A LITTLE PERSPECTIVE", "brand-sub"),
  );
  const actions = el("div", undefined, "header-actions");
  actions.append(
    iconButton("Refresh feeds", "refresh", () => refresh(), "refresh"),
  );
  if (state.snapshot?.busy)
    actions.firstElementChild?.classList.add("spinning");
  actions.append(
    iconButton("Add a source", "plus", () => openAdd(), "add-source"),
    iconButton(
      "Manage sources",
      "sources",
      () => {
        state.scroll = app.querySelector(".scroll")?.scrollTop ?? 0;
        state.view = "sources";
        state.error = "";
        render();
      },
      "manage-sources",
      state.view === "sources",
    ),
  );
  head.append(mark, brand, actions);
  return head;
}
function footer() {
  const s = state.snapshot,
    foot = el("footer", undefined, "footer");
  foot.append(icon(s?.busy ? "refresh" : "clock"));
  const failures =
      s?.sources.filter((x) => x.enabled && x.cache.error).length ?? 0,
    updated = s?.refreshedAt;
  foot.append(
    el(
      "span",
      s?.busy
        ? "Refreshing your sources…"
        : state.message ||
            (!updated
              ? "Your feeds, at your pace"
              : failures
                ? failures +
                  " source" +
                  (failures === 1 ? "" : "s") +
                  " could not update"
                : "Updated " +
                  (relative(updated) === "now"
                    ? "just now"
                    : relative(updated) + " ago")),
    ),
  );
  if (updated)
    foot.title =
      "Last successful update: " + new Date(updated).toLocaleString();
  if (failures)
    foot.append(
      button(
        "View sources",
        () => {
          state.view = "sources";
          render();
        },
        "text-button right",
      ),
    );
  else if (s)
    foot.append(
      el(
        "span",
        s.sources.length + " source" + (s.sources.length === 1 ? "" : "s"),
        "right",
      ),
    );
  return foot;
}
function render() {
  if (state.closed) return;
  const focus = captureFocus();
  imageObserver?.disconnect();
  imageQueue = [];
  app.replaceChildren();
  app.classList.toggle("compact", state.snapshot?.preferences.compact ?? false);
  app.append(header());
  if (state.loading && !state.snapshot) {
    const main = el("main", undefined, "scroll");
    main.append(el("div", "Opening your feeds…", "startup"));
    app.append(main);
  } else if (!state.snapshot) {
    const main = el("main", undefined, "scroll");
    main.append(
      empty(
        "Your feeds are taking a moment",
        "Try reconnecting to your library.",
        "feed",
        "Try again",
        () => loadSnapshot(),
      ),
    );
    app.append(main);
  } else if (state.view === "sources") renderSources();
  else if (state.view === "add") renderAdd();
  else renderList();
  if (state.error) {
    const notice = el("div", undefined, "notice");
    notice.setAttribute("role", "alert");
    notice.append(
      icon("alert"),
      el("p", state.error),
      iconButton(
        "Dismiss message",
        "close",
        () => {
          state.error = "";
          render();
        },
        "dismiss-error",
      ),
    );
    app.append(notice);
  }
  app.append(footer());
  restoreFocus(focus);
  observeImages();
}
function empty(
  title: string,
  description: string,
  glyph: string,
  actionLabel?: string,
  action?: () => unknown,
) {
  const box = el("div", undefined, "empty"),
    mark = el("div", undefined, "empty-icon");
  mark.append(icon(glyph));
  box.append(mark, el("h2", title), el("p", description));
  if (actionLabel && action)
    box.append(button(actionLabel, action, "button secondary"));
  return box;
}
function renderWelcome(main: HTMLElement) {
  const welcome = el("section", undefined, "welcome"),
    art = el("div", undefined, "welcome-art");
  art.setAttribute("aria-hidden", "true");
  art.append(el("div", undefined, "art-sheet second"));
  const sheet = el("div", undefined, "art-sheet front"),
    mark = el("div", undefined, "art-icon");
  mark.append(icon("feed"));
  sheet.append(
    mark,
    el("div", undefined, "art-line"),
    el("div", undefined, "art-line"),
    el("div", undefined, "art-line short"),
  );
  art.append(sheet);
  const spark = icon("plus");
  spark.classList.add("art-spark");
  art.append(spark);
  welcome.append(
    art,
    el("div", "MAKE ROOM FOR CURIOSITY", "eyebrow"),
    el("h2", "A little news. A wider perspective."),
    el(
      "p",
      "Follow the stories and communities you care about. Save a good read for later, or ask an agent to help you make sense of it.",
      "welcome-intro",
    ),
    renderStarterFeeds(starterFeeds.slice(0, 3)),
  );
  const starters = el("div", undefined, "starter-list");
  for (const [kind, title, subtitle] of [
    ["hn", "Start with Hacker News", "Top stories from the community"],
    ["rss", "Follow an RSS feed", "Your favorite publications, together"],
    ["reddit", "Add a subreddit", "A conversation worth following"],
  ] as const) {
    const b = button(
        "",
        () => openAdd(kind),
        "starter",
        undefined,
        "starter-" + kind,
      ),
      text = el("span");
    text.append(el("strong", title), el("small", subtitle));
    b.append(sourceMark(kind), text, icon("chevron"));
    starters.append(b);
  }
  welcome.append(
    starters,
    el(
      "p",
      "One quiet sidebar. Your subscriptions stay on this device.",
      "welcome-foot",
    ),
  );
  main.append(welcome);
}
const starterFeeds = [
  {
    id: "lobsters",
    label: "Lobsters",
    description: "Curated programming news",
    url: "https://lobste.rs/rss",
  },
  {
    id: "cloudflare",
    label: "Cloudflare",
    description: "Engineering, infrastructure & security",
    url: "https://blog.cloudflare.com/rss/",
  },
  {
    id: "typescript",
    label: "TypeScript",
    description: "Official language news & releases",
    url: "https://devblogs.microsoft.com/typescript/feed/",
  },
  {
    id: "github-blog",
    label: "GitHub Blog",
    description: "Developer tools & open source",
    url: "https://github.blog/feed/",
  },
  {
    id: "mozilla-hacks",
    label: "Mozilla Hacks",
    description: "Web standards & browser engineering",
    url: "https://hacks.mozilla.org/feed/",
  },
  {
    id: "stackoverflow-blog",
    label: "Stack Overflow Blog",
    description: "Programming, careers & software teams",
    url: "https://stackoverflow.blog/feed/",
  },
] as const;
const starterSubreddits = [
  { subreddit: "programming", description: "Programming news & discussions" },
  { subreddit: "webdev", description: "Web development & the tools behind it" },
  {
    subreddit: "javascript",
    description: "JavaScript news, libraries & projects",
  },
  {
    subreddit: "typescript",
    description: "TypeScript questions, tools & releases",
  },
  { subreddit: "rust", description: "Rust language & ecosystem" },
  {
    subreddit: "technology",
    description: "Technology news & wider perspectives",
  },
] as const;
type StarterChoice = {
  id: string;
  label: string;
  description: string;
  draft: SourceDraft;
};
function renderStarterFeeds(
  feeds: readonly (typeof starterFeeds)[number][] = starterFeeds,
) {
  return renderSourceSuggestions(
    "rss",
    "A few good feeds",
    "Free developer feeds. Follow the ones you like.",
    feeds.map((feed) => ({ ...feed, draft: { kind: "rss", url: feed.url } })),
  );
}
function renderStarterSubreddits() {
  const sort = state.draft.sort ?? "hot";
  return renderSourceSuggestions(
    "reddit",
    "Good communities to explore",
    "Programming and tech discussions. Follow " +
      (sort === "top" ? "today’s top" : sort) +
      " stories.",
    starterSubreddits.map((community) => ({
      id: "reddit-" + community.subreddit,
      label: "r/" + community.subreddit,
      description: community.description,
      draft: { kind: "reddit", subreddit: community.subreddit, sort },
    })),
  );
}
function renderSourceSuggestions(
  kind: "rss" | "reddit",
  title: string,
  intro: string,
  choices: StarterChoice[],
) {
  const section = el("section", undefined, "starter-feeds");
  section.setAttribute(
    "aria-label",
    kind === "rss" ? "Starter RSS feeds" : "Suggested subreddits",
  );
  section.append(el("h3", title), el("p", intro, "starter-intro"));
  const list = el("div", undefined, "starter-list");
  for (const feed of choices) {
    const followed = state.snapshot?.sources.some(
        (source) =>
          source.kind === kind &&
          (kind === "rss"
            ? source.url === feed.draft.url
            : source.subreddit === feed.draft.subreddit &&
              (source.sort ?? "hot") === feed.draft.sort),
      ),
      following = state.followingStarter === feed.id,
      choice = button(
        "",
        () => followStarter(feed),
        "starter starter-" + kind,
        undefined,
        "follow-" + feed.id,
      ),
      text = el("span", undefined, "starter-text");
    text.append(el("strong", feed.label), el("small", feed.description));
    choice.append(
      sourceMark(kind),
      text,
      el(
        "span",
        followed ? "Following" : following ? "Adding…" : "Follow",
        "starter-follow",
      ),
    );
    choice.setAttribute(
      "aria-label",
      (followed ? "Following " : "Follow ") + feed.label,
    );
    choice.disabled = followed || state.working;
    list.append(choice);
  }
  section.append(list);
  return section;
}
async function followStarter(feed: StarterChoice) {
  if (state.working) return;
  previewController?.abort();
  state.fetching = false;
  state.followingStarter = feed.id;
  await perform(
    async () => {
      const preview = await request<Preview>("sources.preview", feed.draft);
      const result = await request<{ source: { id: string } }>("sources.add", {
        token: preview.token,
        label: feed.label,
      });
      state.view = "list";
      state.filter = "all";
      state.sourceId = result.source.id;
      state.order = "source";
      state.query = "";
      state.unread = false;
      state.limit = 50;
      state.preview = null;
      remember();
    },
    "Following " + feed.label + ".",
  );
  state.followingStarter = "";
  render();
}
function renderList() {
  const s = state.snapshot!,
    main = el("main", undefined, "scroll");
  main.id = "feed-list";
  if (!s.sources.length && state.filter !== "saved") {
    renderWelcome(main);
    app.append(main);
    return;
  }
  const top = el("div", undefined, "topline");
  top.append(
    el(
      "span",
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      "eyebrow",
    ),
  );
  const count = el("span", undefined, "unread-badge");
  count.append(
    el("span", undefined, "tiny-dot"),
    document.createTextNode(s.unread + " unread"),
  );
  top.append(count);
  app.append(top);
  const tabs = el("nav", undefined, "tabs");
  tabs.setAttribute("aria-label", "Feed filters");
  for (const [value, label, glyph] of [
    ["all", "All", "all"],
    ["rss", "RSS", "feed"],
    ["hn", "HN", "hn"],
    ["reddit", "Reddit", "reddit"],
    ["saved", "Saved", "bookmark"],
  ] as const) {
    const b = button(
      label,
      () => switchFilter(value),
      "tab",
      glyph,
      "filter-" + value,
    );
    b.dataset.kind = value;
    b.setAttribute("aria-pressed", String(state.filter === value));
    tabs.append(b);
  }
  app.append(tabs);
  const toolbar = el("div", undefined, "toolbar"),
    line = el("div", undefined, "toolbar-line"),
    select = el("select", undefined, "source-select");
  select.dataset.focus = "source-select";
  select.setAttribute("aria-label", "Feed source");
  select.append(new Option("All sources", ""));
  for (const source of s.sources.filter(
    (x) =>
      state.filter === "all" ||
      state.filter === "saved" ||
      x.kind === state.filter,
  ))
    select.append(
      new Option(source.label + (source.enabled ? "" : " · paused"), source.id),
    );
  select.value = state.sourceId;
  select.onchange = () => {
    state.sourceId = select.value;
    state.order = state.sourceId ? "source" : "latest";
    state.limit = 50;
    remember();
    void loadSnapshot();
  };
  line.append(select);
  if (state.sourceId) {
    const order = el("select", undefined, "order-select");
    order.setAttribute("aria-label", "Story order");
    order.dataset.focus = "story-order";
    order.append(
      new Option("Source order", "source"),
      new Option("Newest", "latest"),
    );
    order.value = state.order;
    order.onchange = () => {
      state.order = order.value as "latest" | "source";
      remember();
      void loadSnapshot();
    };
    line.append(order);
  }
  toolbar.append(line);
  const searchLine = el("div", undefined, "toolbar-line"),
    box = el("div", undefined, "searchbox"),
    search = el("input");
  search.type = "search";
  search.placeholder = "Find a story…";
  search.value = state.query;
  search.maxLength = 300;
  search.setAttribute("aria-label", "Search headlines");
  search.dataset.focus = "search";
  search.oninput = () => {
    state.query = search.value;
    state.limit = 50;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void loadSnapshot(), 180);
  };
  box.append(icon("search"), search);
  const unread = button(
    "Unread",
    () => {
      state.unread = !state.unread;
      state.limit = 50;
      remember();
      void loadSnapshot();
    },
    "unread-toggle",
    "unread",
    "unread",
  );
  unread.setAttribute("aria-pressed", String(state.unread));
  searchLine.append(box, unread);
  toolbar.append(searchLine);
  app.append(toolbar);
  const info = el("div", undefined, "feed-info");
  info.append(
    el(
      "span",
      s.total + " " + (state.filter === "saved" ? "saved reads" : "stories"),
    ),
  );
  const markRead = button(
    "Mark read",
    () =>
      perform(async () => {
        const result = await request<{ count: number }>(
          "items.markRead",
          query(),
        );
        state.message = result.count + " items marked read.";
      }),
    "text-button",
    undefined,
    "mark-read",
  );
  markRead.title = "Mark all items matching these filters read";
  markRead.disabled = state.working || !s.total;
  info.append(markRead);
  app.append(info);
  if (!s.items.length) {
    const saved = state.filter === "saved";
    main.append(
      empty(
        saved
          ? "Your reading shelf"
          : state.query
            ? "No matching stories"
            : state.unread
              ? "All caught up"
              : "A moment between stories",
        saved
          ? "Save a headline and it will be waiting here, even after its feed moves on."
          : state.query
            ? "Try a different search or choose another source."
            : state.unread
              ? "There are no unread stories in this view."
              : "Refresh a source or add something new to follow.",
        saved ? "bookmark" : "feed",
        saved ? undefined : state.unread ? "Show all stories" : "Add a source",
        saved
          ? undefined
          : state.unread
            ? () => {
                state.unread = false;
                void loadSnapshot();
              }
            : () => openAdd(),
      ),
    );
  }
  if (s.items.length) {
    const list = el("div", undefined, "story-list");
    list.setAttribute("role", "list");
    list.setAttribute("aria-label", "News stories");
    for (const item of s.items) list.append(renderRow(item));
    main.append(list);
  }
  const source = s.sources.find((x) => x.id === state.sourceId);
  if (s.hasMore || source?.cache.hasMore) {
    const more = el("div", undefined, "load-more"),
      b = button(
        "More stories",
        () => {
          if (s.hasMore) {
            state.limit += 50;
            void loadSnapshot();
          } else if (source)
            void perform(() => request("feeds.more", { sourceId: source.id }));
        },
        "button",
        "arrow",
        "load-more",
      );
    b.disabled = state.working || source?.refreshing === true;
    more.append(b);
    main.append(more);
  }
  main.addEventListener("keydown", listKeys);
  app.append(main);
}
function renderRow(item: ViewItem) {
  const summary = usefulExcerpt(item.summary),
    expanded = state.expanded.has(item.id),
    row = el(
      "article",
      undefined,
      "story-card" + (item.read ? " read" : "") + (expanded ? " expanded" : ""),
    );
  row.dataset.story = item.id;
  row.setAttribute("role", "listitem");
  const body = el("div", undefined, "row-main"),
    source = el("div", undefined, "row-source");
  source.append(
    sourceMark(item.kind),
    el(
      "span",
      state.snapshot?.sources.find((s) => s.id === state.sourceId)?.label ??
        item.sourceLabel,
      "source-name",
    ),
  );
  if (!item.read) source.prepend(el("span", undefined, "tiny-dot"));
  if (item.saved) {
    const saved = icon("saved");
    saved.classList.add("saved-indicator");
    saved.removeAttribute("aria-hidden");
    saved.setAttribute("role", "img");
    saved.setAttribute("aria-label", "Saved story");
    source.append(saved);
  }
  const at = el(
    "time",
    relative(item.publishedAt ?? item.firstSeenAt),
    "timestamp",
  );
  at.title = item.publishedAt
    ? new Date(item.publishedAt).toLocaleString()
    : "Publication date unavailable; first seen " +
      new Date(item.firstSeenAt).toLocaleString();
  source.append(at);
  const title = button(
    "",
    () => toggleCard(item),
    "row-title",
    undefined,
    "item-" + item.id,
  );
  title.dataset.item = item.id;
  title.setAttribute("aria-expanded", String(expanded));
  title.setAttribute("aria-controls", "details-" + item.id);
  const heading = el("span", item.title),
    chevron = icon("chevron");
  chevron.classList.add("card-chevron");
  title.append(heading, chevron);
  const storyHeading = el("h2", undefined, "story-heading");
  storyHeading.append(title);
  body.append(source);
  if (item.imageUrl && (!state.snapshot?.preferences.compact || expanded))
    body.append(renderImage(item));
  body.append(storyHeading);
  if (summary && !expanded) body.append(el("p", summary, "row-summary"));
  const bottom = el("div", undefined, "row-bottom");
  if (item.score !== undefined) {
    const metric = el("span", undefined, "metric");
    metric.append(icon("up"), document.createTextNode(String(item.score)));
    metric.title = item.score + " points on Hacker News";
    bottom.append(metric);
  }
  if (item.kind === "reddit")
    bottom.append(el("span", "Community thread", "domain"));
  else if (item.url) bottom.append(el("span", domain(item.url), "domain"));
  body.append(bottom);
  const details = renderDetails(item);
  details.hidden = !expanded;
  row.append(body, details);
  return row;
}
function toggleCard(item: ViewItem) {
  const expanding = !state.expanded.has(item.id);
  state.expanded.clear();
  if (expanding) state.expanded.add(item.id);
  state.askOpen = false;
  state.error = "";
  render();
  [...app.querySelectorAll<HTMLElement>(".row-title")]
    .find((title) => title.dataset.item === item.id)
    ?.scrollIntoView({ block: "nearest" });
  announce(expanding ? "Story expanded." : "Story collapsed.");
}
function toggleSaved(item: ViewItem) {
  void perform(
    async () => {
      await request("items.setSaved", { id: item.id, saved: !item.saved });
      if (state.item?.id === item.id) state.item.saved = !item.saved;
    },
    item.saved ? "Removed from saved reads." : "Added to your reading shelf.",
  );
}
async function openLink(item: ViewItem, url: string) {
  try {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error("This story does not have a valid web link.");
    const opening = globalThis.orca
      ? orca.shell?.openExternal(url)
      : Promise.resolve({
          opened: !!window.open(url, "_blank", "noopener,noreferrer"),
        });
    const result = await opening;
    if (!result?.opened) {
      state.message = "Link opening cancelled.";
      render();
      return;
    }
    if (!item.read)
      await perform(() =>
        request("items.setRead", { id: item.id, read: true }),
      );
  } catch (error) {
    fail(error);
  }
}
function listKeys(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (!target.classList.contains("row-title")) return;
  const titles = [...app.querySelectorAll<HTMLElement>(".row-title")],
    at = titles.indexOf(target);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    titles[
      Math.max(
        0,
        Math.min(titles.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)),
      )
    ].focus();
  }
  if (event.key.toLowerCase() === "s" && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    const item = state.snapshot?.items.find(
      (i) => i.id === target.dataset.item,
    );
    if (item) toggleSaved(item);
  }
}
function backbar(label = "Back to feeds", eyebrow = "") {
  const bar = el("div", undefined, "backbar");
  bar.append(button(label, back, "", "back", "back"));
  if (eyebrow) bar.append(el("span", eyebrow, "eyebrow"));
  app.append(bar);
}
function renderDetails(item: ViewItem) {
  const summary = usefulExcerpt(item.summary);
  const details = el("div", undefined, "card-details");
  details.id = "details-" + item.id;
  // Collapsed cards do not need action controls or a second copy of the excerpt.
  if (!state.expanded.has(item.id)) return details;
  details.append(
    el(
      "p",
      (item.author ? "By " + item.author + " · " : "") +
        (item.publishedAt
          ? new Date(item.publishedAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "Publication date unavailable"),
      "byline",
    ),
  );
  details.append(
    el(
      "p",
      summary ||
        "This feed shares the headline. Open the source for the full story, or ask an agent to explore it with you.",
      "full-summary" + (summary ? "" : " no-summary"),
    ),
  );
  const actions = el("div", undefined, "card-actions");
  if (item.url)
    actions.append(
      button(
        item.kind === "reddit" ? "Open the discussion" : "Read the full story",
        () => openLink(item, item.url!),
        "button primary full",
        "external",
        "read-link-" + item.id,
      ),
    );
  if (item.discussionUrl && item.discussionUrl !== item.url)
    actions.append(
      button(
        "Join the discussion",
        () => openLink(item, item.discussionUrl!),
        "button full",
        "comments",
        "discussion-link-" + item.id,
      ),
    );
  const asking = state.askOpen && state.item?.id === item.id,
    ask = button(
      asking ? "Close agent form" : "Ask an agent",
      () => (asking ? closeAsk() : openAsk(item)),
      "button secondary full",
      "all",
      "ask-agent-" + item.id,
    );
  ask.setAttribute("aria-expanded", String(asking));
  ask.setAttribute("aria-controls", "ask-" + item.id);
  ask.disabled = state.askPending && !asking;
  actions.append(ask);
  const inline = el("div", undefined, "inline-actions"),
    save = button(
      item.saved ? "Saved" : "Save for later",
      () => toggleSaved(item),
      "button",
      item.saved ? "saved" : "bookmark",
      "card-save-" + item.id,
    );
  save.disabled = state.working;
  save.setAttribute("aria-pressed", String(item.saved));
  const read = button(
    item.read ? "Mark unread" : "Mark read",
    () =>
      perform(async () => {
        await request("items.setRead", { id: item.id, read: !item.read });
        if (state.item?.id === item.id) state.item.read = !item.read;
      }),
    "button",
    "unread",
    "card-read-" + item.id,
  );
  read.disabled = state.working;
  inline.append(save, read);
  actions.append(inline);
  details.append(actions);
  if (asking) details.append(renderAsk(item));
  return details;
}
function switchButton(
  label: string,
  checked: boolean,
  action: () => unknown,
  key: string,
) {
  const b = button("", action, "switch", undefined, key);
  b.setAttribute("role", "switch");
  b.setAttribute("aria-label", label);
  b.setAttribute("aria-checked", String(checked));
  b.disabled = state.working;
  return b;
}
function renderSources() {
  backbar();
  const main = el("main", undefined, "scroll"),
    section = el("section", undefined, "section");
  section.append(
    el("h2", "Curate your corner."),
    el(
      "p",
      "Keep the sources you love. Pause the ones you need a little less of.",
      "section-intro",
    ),
  );
  const list = el("div", undefined, "sources-list");
  for (const s of state.snapshot!.sources) {
    const card = el(
        "article",
        undefined,
        "source-card" + (s.enabled ? "" : " disabled"),
      ),
      top = el("div", undefined, "source-card-top"),
      title = el("div", undefined, "source-card-title");
    title.append(
      el("strong", s.label),
      el(
        "small",
        s.kind === "rss"
          ? domain(s.url ?? null)
          : s.kind === "hn"
            ? "Hacker News · " + s.category
            : s.subreddit + " · " + s.sort,
      ),
    );
    top.append(
      sourceMark(s.kind),
      title,
      switchButton(
        "Enable " + s.label,
        s.enabled,
        () =>
          perform(() =>
            request("sources.update", { id: s.id, enabled: !s.enabled }),
          ),
        "enable-" + s.id,
      ),
      iconButton(
        "Edit " + s.label,
        "more",
        () => {
          state.editId = state.editId === s.id ? "" : s.id;
          state.editLabel = s.label;
          render();
        },
        "edit-" + s.id,
      ),
    );
    card.append(top);
    const bottom = el("div", undefined, "source-card-bottom");
    bottom.append(
      el("span", s.count + " stories"),
      el("span", s.unread + " unread"),
    );
    if (!s.enabled) bottom.append(el("span", "Paused"));
    else if (s.refreshing) bottom.append(el("span", "Refreshing…"));
    else {
      const retry = button(
        s.cache.retryAt > Date.now() ? "Try later" : "Refresh",
        () => refresh(s.id),
        "text-button",
        undefined,
        "retry-" + s.id,
      );
      retry.disabled = s.cache.retryAt > Date.now();
      bottom.append(retry);
    }
    card.append(bottom);
    if (s.cache.error) card.append(el("p", s.cache.error, "source-error"));
    if (s.cache.notice) card.append(el("p", s.cache.notice, "source-notice"));
    if (state.editId === s.id) {
      const edit = el("div", undefined, "source-edit");
      edit.append(
        textField(
          "Source name",
          state.editLabel,
          "source-name-edit",
          (v) => (state.editLabel = v),
          80,
        ),
      );
      const buttons = el("div", undefined, "inline-actions"),
        save = button(
          "Save name",
          () =>
            perform(async () => {
              await request("sources.update", {
                id: s.id,
                label: state.editLabel,
              });
              state.editId = "";
            }),
          "button",
          undefined,
          "save-source-name",
        );
      save.disabled = state.working;
      buttons.append(
        save,
        button(
          "Remove",
          () => confirmRemove(s),
          "button danger",
          "trash",
          "remove-source",
        ),
      );
      edit.append(buttons);
      card.append(edit);
    }
    list.append(card);
  }
  if (!state.snapshot!.sources.length)
    list.append(
      el("p", "Your next favorite source is waiting.", "section-intro"),
    );
  section.append(list);
  const add = button(
    "Add a source",
    () => openAdd(),
    "button full",
    "plus",
    "sources-add",
  );
  add.style.marginTop = "14px";
  section.append(add);
  const prefs = el("section", undefined, "preferences");
  prefs.append(el("h3", "Make it yours"));
  const row = el("div", undefined, "preference-row"),
    label = el("label", "Auto refresh");
  label.htmlFor = "refresh-interval";
  const select = el("select");
  select.id = "refresh-interval";
  select.dataset.focus = "refresh-interval";
  for (const [v, t] of [
    [0, "Manual"],
    [5, "Every 5 min"],
    [10, "Every 10 min"],
    [30, "Every 30 min"],
    [60, "Every hour"],
  ] as const)
    select.append(new Option(t, String(v)));
  select.value = String(state.snapshot!.preferences.refreshMinutes);
  select.disabled = state.working;
  select.onchange = () =>
    void perform(() =>
      request("preferences.update", { refreshMinutes: Number(select.value) }),
    );
  row.append(label, select);
  const compact = el("div", undefined, "preference-row");
  compact.append(
    el("span", "Compact headlines"),
    switchButton(
      "Compact headlines",
      state.snapshot!.preferences.compact,
      () =>
        perform(() =>
          request("preferences.update", {
            compact: !state.snapshot!.preferences.compact,
          }),
        ),
      "compact",
    ),
  );
  prefs.append(
    row,
    compact,
    el(
      "p",
      "Automatic refresh runs while you are focused in this panel. Saved stories stay available when a source is paused or removed.",
      "preference-note",
    ),
  );
  section.append(prefs);
  main.append(section);
  app.append(main);
}
function confirmRemove(source: SourceView) {
  const dialog = el("dialog");
  dialog.append(
    el("h2", "Remove this source?"),
    el(
      "p",
      "You’ll stop following " +
        source.label +
        ". Your saved stories will stay on your reading shelf.",
    ),
  );
  const actions = el("div", undefined, "inline-actions"),
    cancel = button("Keep source", () => dialog.close());
  actions.append(
    cancel,
    button(
      "Remove source",
      () => {
        dialog.close();
        void perform(async () => {
          await request("sources.remove", { id: source.id });
          state.editId = "";
        }, "Source removed. Saved stories kept.");
      },
      "button danger",
    ),
  );
  dialog.append(actions);
  dialog.onclose = () => dialog.remove();
  document.body.append(dialog);
  dialog.showModal();
  cancel.focus();
}
function textField(
  label: string,
  value: string,
  key: string,
  change: (v: string) => void,
  max = 4096,
  placeholder = "",
) {
  const field = el("div", undefined, "field"),
    name = el("label", label),
    input = el("input");
  name.htmlFor = key;
  input.id = key;
  input.dataset.focus = key;
  input.value = value;
  input.maxLength = max;
  input.placeholder = placeholder;
  input.oninput = () => change(input.value);
  field.append(name, input);
  return field;
}
function selectField(
  label: string,
  key: string,
  value: string,
  options: readonly (readonly [string, string])[],
  change: (v: string) => void,
) {
  const field = el("div", undefined, "field"),
    name = el("label", label),
    select = el("select");
  name.htmlFor = key;
  select.id = key;
  select.dataset.focus = key;
  for (const [v, t] of options) select.append(new Option(t, v));
  select.value = value;
  select.onchange = () => change(select.value);
  field.append(name, select);
  return field;
}
function renderAdd() {
  backbar("Back to feeds", "FOLLOW A SOURCE");
  const main = el("main", undefined, "scroll"),
    section = el("section", undefined, "section");
  section.append(
    el("h2", "Follow your curiosity."),
    el(
      "p",
      "Follow a starter feed, or preview a source of your own.",
      "section-intro",
    ),
  );
  if (!state.preview) {
    const tabs = el("div", undefined, "type-tabs");
    for (const [kind, label, glyph] of [
      ["rss", "RSS / Atom", "feed"],
      ["hn", "Hacker News", "hn"],
      ["reddit", "Reddit", "reddit"],
    ] as const) {
      const b = button(
        label,
        () => {
          previewController?.abort();
          state.fetching = false;
          state.draft.kind = kind;
          state.error = "";
          render();
        },
        "tab",
        glyph,
        "type-" + kind,
      );
      b.setAttribute("aria-pressed", String(state.draft.kind === kind));
      tabs.append(b);
    }
    section.append(tabs);
    const form = el("form");
    form.onsubmit = (e) => {
      e.preventDefault();
      void previewSource();
    };
    if (state.draft.kind === "rss") {
      section.append(renderStarterFeeds());
      const field = textField(
        "Feed URL",
        state.draft.url ?? "",
        "feed-url",
        (v) => (state.draft.url = v),
        4096,
        "https://example.com/feed.xml",
      );
      field.append(
        el(
          "small",
          "Paste an RSS or Atom address from a publication you follow.",
        ),
      );
      form.append(field);
    } else if (state.draft.kind === "hn")
      form.append(
        selectField(
          "Hacker News category",
          "hn-category",
          state.draft.category ?? "top",
          [
            ["top", "Top stories"],
            ["new", "New stories"],
            ["best", "Best stories"],
            ["ask", "Ask HN"],
            ["show", "Show HN"],
          ],
          (v) => (state.draft.category = v as SourceDraft["category"]),
        ),
      );
    else {
      section.append(renderStarterSubreddits());
      form.append(
        textField(
          "Subreddit",
          state.draft.subreddit ?? "",
          "subreddit",
          (v) => (state.draft.subreddit = v),
          24,
          "programming",
        ),
        selectField(
          "Listing",
          "reddit-sort",
          state.draft.sort ?? "hot",
          [
            ["hot", "Hot"],
            ["new", "New"],
            ["top", "Top today"],
          ],
          (v) => {
            state.draft.sort = v as SourceDraft["sort"];
            render();
          },
        ),
      );
      form.append(
        el(
          "p",
          "Public communities only. The discussion opens on Reddit.",
          "preference-note",
        ),
      );
    }
    const submit = button(
      "Preview source",
      () => previewSource(),
      "button primary full",
      "arrow",
      "preview-source",
    );
    submit.disabled = state.fetching;
    form.append(submit);
    if (state.fetching) {
      const fetching = el("div", undefined, "preview-fetch");
      fetching.setAttribute("role", "status");
      fetching.append(
        icon("refresh"),
        document.createTextNode("Finding a few good stories…"),
      );
      form.append(fetching);
    }
    section.append(form);
  } else {
    const preview = state.preview,
      card = el("div", undefined, "preview-card"),
      top = el("div", undefined, "row-source");
    top.append(sourceMark(preview.source.kind), el("h3", preview.source.label));
    card.append(
      top,
      el(
        "p",
        preview.count +
          " " +
          (preview.count === 1 ? "story" : "stories") +
          " found",
        "preview-count",
      ),
    );
    for (const item of preview.items)
      card.append(el("p", item.title, "preview-headline"));
    if (!preview.items.length)
      card.append(
        el(
          "p",
          "This feed is valid and currently has no entries.",
          "preview-headline",
        ),
      );
    if (preview.notice) card.append(el("p", preview.notice, "source-notice"));
    section.append(
      card,
      textField(
        "Name in your sidebar",
        state.sourceLabel,
        "new-source-label",
        (v) => (state.sourceLabel = v),
        80,
      ),
    );
    const actions = el("div", undefined, "add-actions"),
      add = button(
        "Follow this source",
        () =>
          perform(async () => {
            const result = await request<{ source: { id: string } }>(
              "sources.add",
              { token: preview.token, label: state.sourceLabel },
            );
            state.view = "list";
            state.filter = preview.source.kind;
            state.sourceId = result.source.id;
            state.order = "source";
            state.limit = 50;
            state.preview = null;
            remember();
          }, "Added to your feeds."),
        "button primary full",
        "check",
        "follow-source",
      );
    add.disabled = state.working;
    actions.append(
      add,
      button(
        "Choose another source",
        () => {
          state.preview = null;
          render();
        },
        "button full",
        undefined,
        "change-source",
      ),
    );
    section.append(actions);
  }
  main.append(section);
  app.append(main);
}
async function previewSource() {
  if (state.fetching) return;
  previewController?.abort();
  const controller = (previewController = new AbortController());
  state.fetching = true;
  state.error = "";
  render();
  try {
    const preview = await request<Preview>(
      "sources.preview",
      state.draft,
      controller.signal,
    );
    if (controller.signal.aborted || state.view !== "add") return;
    state.preview = preview;
    state.sourceLabel = preview.source.label;
    announce(preview.count + " stories found.");
  } catch (error) {
    if (!controller.signal.aborted) fail(error);
  } finally {
    if (previewController === controller) {
      state.fetching = false;
      render();
    }
  }
}
async function openAsk(item: ViewItem) {
  if (state.askPending) return;
  state.askOpen = true;
  if (state.item?.id !== item.id || !state.askId) {
    state.item = { ...item };
    state.question = "";
    state.askId = requestId();
    state.askFingerprint = "";
    state.askResult = null;
    state.agentOptions = null;
    state.workspacesLoading = false;
  }
  state.error = "";
  const askId = state.askId;
  render();
  app.querySelector<HTMLElement>("#news-question")?.focus();
  if (state.agentOptions || state.workspacesLoading) return;
  state.workspacesLoading = true;
  try {
    const options = await request<AgentOptions>("news.workspaces");
    if (state.askId !== askId || state.closed) return;
    state.agentOptions = options;
    state.workspaceId = state.agentOptions.suggestedId ?? "";
    render();
  } catch (error) {
    if (state.askId === askId && !state.closed) fail(error);
  } finally {
    if (state.askId === askId) state.workspacesLoading = false;
  }
}
function closeAsk() {
  state.askOpen = false;
  render();
  if (state.item)
    [...app.querySelectorAll<HTMLElement>("[data-focus]")]
      .find((e) => e.dataset.focus === "ask-agent-" + state.item!.id)
      ?.focus({ preventScroll: true });
}
function requestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
function renderAsk(item: ViewItem) {
  const section = el("section", undefined, "inline-ask");
  section.id = "ask-" + item.id;
  section.setAttribute("aria-label", "Ask about " + item.title);
  section.append(
    el("h3", "A little more context."),
    el("p", "Start a fresh conversation about this story.", "section-intro"),
  );
  if (state.askResult) {
    section.append(
      empty(
        "Your conversation is open",
        "Your question was sent to a fresh " +
          state.agent +
          (state.askResult.kind === "chat"
            ? " chat in the selected workspace."
            : " terminal session in the selected workspace."),
        "comments",
      ),
      button("Close agent form", closeAsk, "button secondary full"),
    );
  } else {
    const field = el("div", undefined, "field"),
      label = el("label", "What would you like to know?");
    label.htmlFor = "news-question";
    const textarea = el("textarea");
    textarea.id = "news-question";
    textarea.dataset.focus = "news-question";
    textarea.rows = 3;
    textarea.maxLength = 4000;
    textarea.value = state.question;
    textarea.placeholder = "Why does this matter? What is the bigger picture?";
    textarea.oninput = () => (state.question = textarea.value);
    textarea.disabled = state.askPending;
    field.append(label, textarea);
    section.append(field);
    const suggestions = el("div", undefined, "question-suggestions");
    for (const question of [
      "Explain the story",
      "Why does it matter?",
      "Check the claims",
    ]) {
      const suggestion = button(
        question,
        () => {
          state.question =
            question === "Explain the story"
              ? "Explain this story and give me the useful context."
              : question === "Why does it matter?"
                ? "Why does this story matter, and who is affected?"
                : "Check the key claims in this story against reliable sources.";
          render();
        },
        "question-chip",
      );
      suggestion.disabled = state.askPending;
      suggestions.append(suggestion);
    }
    section.append(suggestions);
    const options = state.agentOptions;
    if (options) {
      section.append(
        selectField(
          "Workspace",
          "ask-workspace",
          state.workspaceId,
          [
            ["", "Choose a workspace"],
            ...options.workspaces.map(
              (w) =>
                [
                  w.id,
                  w.name +
                    (w.hostId && w.hostId !== "local" ? " · remote" : ""),
                ] as [string, string],
            ),
          ],
          (v) => (state.workspaceId = v),
        ),
      );
      if (options.truncated)
        section.append(
          el(
            "p",
            "Orca returned a partial workspace list. Choose a listed workspace.",
            "preference-note",
          ),
        );
    } else
      section.append(el("p", "Loading your workspaces…", "preference-note"));
    section.append(
      selectField(
        "Agent",
        "ask-agent-choice",
        state.agent,
        [
          ["codex", "Codex"],
          ["claude", "Claude"],
          ["gemini", "Gemini"],
        ],
        (v) => {
          state.agent = v;
          render();
        },
      ),
    );
    section.append(
      el(
        "p",
        "The selected agent must be set up in Orca. Opens a fresh conversation using its Chat or CLI setting.",
        "preference-note",
      ),
    );
    const launch = button(
      state.askPending
        ? "Starting your agent…"
        : "Ask " + state.agent[0].toUpperCase() + state.agent.slice(1),
      () => askAgent(),
      "button primary full",
      "arrow",
      "launch-agent",
    );
    launch.style.marginTop = "18px";
    launch.disabled = state.askPending || !options?.workspaces.length;
    section.append(launch);
  }
  if (state.askPending)
    section
      .querySelectorAll<HTMLSelectElement>("select")
      .forEach((select) => (select.disabled = true));
  return section;
}
async function askAgent() {
  if (state.askPending || !state.item) return;
  if (!state.question.trim()) {
    state.error = "Enter a question or choose one above.";
    render();
    app.querySelector<HTMLElement>("#news-question")?.focus();
    return;
  }
  if (!state.workspaceId) {
    state.error = "Choose where to start the agent.";
    render();
    return;
  }
  state.askPending = true;
  const fingerprint = JSON.stringify([
    state.item.id,
    state.question,
    state.workspaceId,
    state.agent,
  ]);
  if (state.askFingerprint && state.askFingerprint !== fingerprint)
    state.askId = requestId();
  state.askFingerprint = fingerprint;
  state.error = "";
  render();
  try {
    state.askResult = await request<NewsLaunchReceipt>("news.ask", {
      id: state.item.id,
      question: state.question,
      workspaceId: state.workspaceId,
      agent: state.agent,
      requestId: state.askId,
    });
    announce("Your agent session has started.");
  } catch (error) {
    fail(error);
  } finally {
    state.askPending = false;
    render();
  }
}
function setupPreview() {
  if (!previewMode) return;
  document.body.dataset.preview = "true";
  const params = new URLSearchParams(location.search);
  document.documentElement.style.setProperty(
    "--preview-width",
    (params.get("width") ?? "320") + "px",
  );
  document.documentElement.style.setProperty(
    "--preview-height",
    (params.get("height") ?? "760") + "px",
  );
  document.documentElement.classList.add(
    params.get("theme") === "dark" ? "dark" : "light",
  );
  const toolbar = el("div", undefined, "preview-toolbar");
  toolbar.append(
    el("span", "Feeds preview · sample headlines"),
    button(
      "Switch theme",
      () => {
        const dark = document.documentElement.classList.toggle("dark");
        document.documentElement.classList.toggle("light", !dark);
      },
      "",
    ),
  );
  const width = el("select");
  width.setAttribute("aria-label", "Preview width");
  for (const n of [240, 320, 440])
    width.append(new Option(n + "px", String(n)));
  width.value = params.get("width") ?? "320";
  width.onchange = () =>
    document.documentElement.style.setProperty(
      "--preview-width",
      width.value + "px",
    );
  toolbar.append(width);
  document.body.prepend(toolbar);
}
setupPreview();
restore();
const subscription = globalThis.orca?.plugin.on("feeds.changed", () => {
  clearTimeout(changeTimer);
  changeTimer = setTimeout(() => void loadSnapshot(), 50);
});
const autoRefresh = setInterval(() => {
  if (
    !state.closed &&
    state.snapshot?.preferences.refreshMinutes &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  )
    void request("feeds.refresh", { force: false })
      .then(() => loadSnapshot())
      .catch(fail);
}, 60000);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  const card = (event.target as HTMLElement).closest<HTMLElement>(
    ".story-card",
  );
  if (state.view === "list" && card) {
    event.preventDefault();
    if (state.askOpen && state.item?.id === card.dataset.story) closeAsk();
    else {
      const item = state.snapshot?.items.find(
        (item) => item.id === card.dataset.story,
      );
      if (item && state.expanded.has(item.id)) {
        toggleCard(item);
        [...app.querySelectorAll<HTMLElement>(".row-title")]
          .find((e) => e.dataset.item === item.id)
          ?.focus({ preventScroll: true });
      }
    }
    return;
  }
  if (state.view !== "list") {
    event.preventDefault();
    back();
  }
});
window.addEventListener("pagehide", () => {
  state.closed = true;
  imageObserver?.disconnect();
  imageQueue = [];
  subscription?.dispose();
  clearInterval(autoRefresh);
  clearTimeout(searchTimer);
  clearTimeout(changeTimer);
  previewController?.abort();
});
void loadSnapshot();
