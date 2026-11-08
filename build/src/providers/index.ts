import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Parser } from "htmlparser2";
import {
  FeedError,
  usefulExcerpt,
  type Cache,
  type FetchResult,
  type Item,
  type Source,
  type SourceDraft,
} from "../shared/model";
export const MAX_RESPONSE = 2 * 1024 * 1024;
export type Transport = (
  url: string,
  options?: { signal?: AbortSignal; etag?: string; modified?: string },
) => Promise<{
  text: string;
  status: number;
  url: string;
  etag?: string;
  modified?: string;
}>;
export const hash = (s: string) =>
  createHash("sha256").update(s).digest("hex").slice(0, 24);
export function validUrl(raw: unknown, base?: string): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 4096)
    throw new FeedError("Enter a valid HTTP or HTTPS URL.", "invalid_params");
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    throw new FeedError("Enter a valid HTTP or HTTPS URL.", "invalid_params");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new FeedError(
      "Use an HTTP or HTTPS URL without embedded credentials.",
      "invalid_params",
    );
  url.hash = "";
  if (url.href.length > 4096)
    throw new FeedError("This URL is too long.", "invalid_params");
  return url.href;
}
function optionalUrl(raw: unknown, base: string): string | null {
  try {
    const url = validUrl(raw, base);
    return url.length <= 2048 ? url : null;
  } catch {
    return null;
  }
}
export function plainText(value: unknown, max = 2000): string {
  const raw =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)["#text"]
      : value;
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  let text = "",
    hidden = 0;
  const parser = new Parser(
    {
      onopentag(name) {
        if (["script", "style", "iframe"].includes(name)) hidden++;
        if (
          ["p", "br", "div", "li", "h1", "h2", "h3"].includes(name) &&
          !hidden
        )
          text += "\n";
      },
      ontext(t) {
        if (!hidden && text.length < max * 2) text += t;
      },
      onclosetag(name) {
        if (["script", "style", "iframe"].includes(name))
          hidden = Math.max(0, hidden - 1);
        if (["p", "div", "li"].includes(name) && !hidden) text += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(String(raw).slice(0, 32768));
  parser.end();
  return text
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}
export function normalizeDraft(
  input: SourceDraft,
): Omit<Source, "id" | "enabled" | "version" | "createdAt"> {
  if (!input || typeof input !== "object")
    throw new FeedError("Choose a feed type.", "invalid_params");
  if (input.kind === "rss") {
    const url = validUrl(input.url);
    return {
      kind: "rss",
      url,
      label: new URL(url).hostname,
      identity: "rss:" + url,
    };
  }
  if (input.kind === "hn") {
    const category = input.category ?? "top";
    if (!["top", "new", "best", "ask", "show"].includes(category))
      throw new FeedError("Choose a Hacker News category.", "invalid_params");
    return {
      kind: "hn",
      category,
      label: "HN · " + category[0].toUpperCase() + category.slice(1),
      identity: "hn:" + category,
    };
  }
  if (input.kind === "reddit") {
    const subreddit = String(input.subreddit ?? "")
      .trim()
      .replace(/^(?:r\/|\/r\/)/i, "")
      .toLowerCase();
    if (!/^[a-z0-9_]{2,21}$/.test(subreddit))
      throw new FeedError(
        "Enter a subreddit name, such as programming.",
        "invalid_params",
      );
    const sort = input.sort ?? "hot";
    if (!["hot", "new", "top"].includes(sort))
      throw new FeedError("Choose a Reddit listing.", "invalid_params");
    return {
      kind: "reddit",
      subreddit,
      sort,
      label: "r/" + subreddit,
      identity: "reddit:" + subreddit + ":" + sort,
    };
  }
  throw new FeedError("Choose RSS, Hacker News, or Reddit.", "invalid_params");
}
export function retryAfter(raw: string | null, now = Date.now()): number {
  if (!raw) return 0;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, 86400000)
    : Math.max(0, Math.min(Date.parse(raw) - now || 0, 86400000));
}
export const fetchText: Transport = async (raw, options = {}) => {
  let url = validUrl(raw);
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  const headers: Record<string, string> = {
    "User-Agent": "OrcaFeeds/0.1 (desktop feed reader)",
    Accept:
      "application/atom+xml, application/rss+xml, application/xml, application/json, text/xml;q=0.9",
  };
  if (options.etag) headers["If-None-Match"] = options.etag;
  if (options.modified) headers["If-Modified-Since"] = options.modified;
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await fetch(url, {
        signal,
        headers,
        redirect: "manual",
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects === 5)
          throw new FeedError("This feed redirects too many times.");
        url = validUrl(response.headers.get("location"), url);
        delete headers["If-None-Match"];
        delete headers["If-Modified-Since"];
        continue;
      }
      if (response.status === 304) {
        await response.body?.cancel();
        return {
          text: "",
          status: 304,
          url,
          etag: response.headers.get("etag") ?? options.etag,
          modified: response.headers.get("last-modified") ?? options.modified,
        };
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new FeedError(
          response.status === 403
            ? "This source refused access. Cached items are still available."
            : response.status === 404
              ? "This feed could not be found. Check the source address."
              : response.status === 429
                ? "This source is asking us to slow down. Try again later."
                : "The source returned HTTP " + response.status + ".",
          response.status === 429 ? "rate_limited" : "http",
          retryAfter(response.headers.get("retry-after")),
        );
      }
      const reader = response.body?.getReader();
      let bytes = 0;
      const chunks: Uint8Array[] = [];
      if (reader)
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE) {
              await reader.cancel();
              throw new FeedError(
                "This feed is larger than the 2 MiB reading limit.",
                "too_large",
              );
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
      const buffer = Buffer.concat(chunks);
      let encoding = "utf-8";
      const charset = response.headers
        .get("content-type")
        ?.match(/charset=["']?([^;"' ]+)/i)?.[1];
      const declared = buffer
        .subarray(0, 150)
        .toString()
        .match(/encoding=["']([^"']+)/i)?.[1];
      if (charset || declared) encoding = charset ?? declared ?? "utf-8";
      let text: string;
      try {
        text = new TextDecoder(encoding).decode(buffer);
      } catch {
        text = buffer.toString("utf8");
      }
      return {
        text,
        status: response.status,
        url,
        etag: response.headers.get("etag") ?? undefined,
        modified: response.headers.get("last-modified") ?? undefined,
      };
    }
  } catch (error) {
    if (error instanceof FeedError) throw error;
    if (signal.aborted)
      throw new FeedError(
        options.signal?.aborted
          ? "Refresh cancelled."
          : "This source took too long to respond.",
        options.signal?.aborted ? "cancelled" : "timeout",
      );
    throw new FeedError(
      "Could not reach this source. Check your connection and try again.",
      "network",
    );
  }
  throw new FeedError("Could not load this feed.");
};
const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const date = (v: unknown): number | null => {
  const n = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
function feedImage(
  entry: Record<string, any>,
  base: string,
): string | undefined {
  // Namespace prefixes are removed by the XML parser (media:thumbnail → thumbnail).
  const groups = [entry, ...asArray(entry.group)].filter(
    (v) => v && typeof v === "object",
  );
  for (const group of groups) {
    for (const candidate of asArray<any>(group.thumbnail)) {
      const url = optionalUrl(candidate?.["@url"], base);
      if (url) return url;
    }
    for (const candidate of [
      ...asArray<any>(group.content),
      ...asArray<any>(group.enclosure),
      ...asArray<any>(group.link),
    ]) {
      if (!candidate || typeof candidate !== "object") continue;
      const type = candidate["@type"],
        medium = candidate["@medium"];
      if (
        medium !== "image" &&
        !(typeof type === "string" && /^image[/]/i.test(type))
      )
        continue;
      const url = optionalUrl(candidate["@url"] ?? candidate["@href"], base);
      if (url) return url;
    }
  }
  for (const content of [
    entry.encoded,
    entry.content,
    entry.description,
    entry.summary,
  ].flatMap((v) => asArray<any>(v))) {
    const raw = typeof content === "string" ? content : content?.["#text"];
    if (typeof raw !== "string") continue;
    let image: string | undefined;
    const parser = new Parser({
      onopentag(name, attrs) {
        if (name === "img" && !image)
          image =
            optionalUrl(attrs.src ?? attrs["data-src"], base) ?? undefined;
      },
    });
    parser.end(raw.slice(0, 32768));
    if (image) return image;
  }
  return undefined;
}
export function parseFeed(
  xml: string,
  source: Source,
  base: string,
  now: number,
  previous: Item[] = [],
): { title: string; items: Item[] } {
  if (Buffer.byteLength(xml) > MAX_RESPONSE)
    throw new FeedError(
      "This feed is larger than the 2 MiB reading limit.",
      "too_large",
    );
  const cleaned = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->/g, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(cleaned))
    throw new FeedError(
      "This feed contains unsupported XML entity declarations.",
    );
  let depth = 0;
  for (const match of cleaned.matchAll(/<\/?([A-Za-z_][\w:.-]*)\b[^>]*>/g)) {
    const tag = match[0];
    if (tag.startsWith("</")) depth--;
    else if (!tag.endsWith("/>")) depth++;
    if (depth > 128)
      throw new FeedError("This feed is nested too deeply.", "too_large");
  }
  if (XMLValidator.validate(xml) !== true)
    throw new FeedError("This source did not return a valid RSS or Atom feed.");
  const doc = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  }).parse(xml);
  const atom = doc.feed,
    root = atom ?? doc.rss?.channel ?? doc.RDF?.channel;
  if (!root)
    throw new FeedError(
      "No RSS or Atom feed found. Use the feed URL rather than the website homepage.",
    );
  const rootBase = optionalUrl(root["@base"], base) ?? base;
  const entries: Record<string, any>[] = asArray(
    atom ? root.entry : (doc.RDF?.item ?? root.item),
  ).slice(0, 200);
  const old = new Map(previous.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const entryBase = optionalUrl(entry["@base"], rootBase) ?? rootBase;
    const title = plainText(entry.title, 500);
    if (!title) continue;
    let url: string | null = null;
    if (atom) {
      const links = asArray<Record<string, any>>(entry.link);
      url = optionalUrl(
        (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ??
          links[0])?.["@href"],
        entryBase,
      );
    } else {
      url = optionalUrl(entry.link, entryBase);
      if (!url && entry.guid?.["@isPermaLink"] !== "false")
        url = optionalUrl(entry.guid?.["#text"] ?? entry.guid, entryBase);
    }
    const rawId =
      plainText(entry.id ?? entry.guid ?? entry["@about"], 1000) ||
      url ||
      title +
        "|" +
        plainText(entry.pubDate ?? entry.published ?? entry.date, 100);
    const id =
      source.kind === "reddit"
        ? "reddit:" + hash(rawId)
        : "rss:" + hash(source.identity) + ":" + hash(rawId);
    if (seen.has(id)) continue;
    seen.add(id);
    const discussionUrl =
      source.kind === "reddit" ? url : optionalUrl(entry.comments, entryBase);
    const summary =
      [entry.encoded, entry.content, entry.description, entry.summary]
        .flatMap((value) => asArray<any>(value))
        .map((value) => usefulExcerpt(plainText(value, 2000)))
        .find(Boolean) ?? "";
    items.push({
      id,
      kind: source.kind,
      title,
      url,
      discussionUrl,
      author: plainText(
        atom ? entry.author?.name : (entry.creator ?? entry.author),
        100,
      ),
      publishedAt: date(
        entry.published ?? entry.pubDate ?? entry.date ?? entry.updated,
      ),
      firstSeenAt: old.get(id)?.firstSeenAt ?? now,
      summary,
      imageUrl: feedImage(entry, entryBase),
      rank: items.length,
      sourceIds: [source.id],
      sourceLabel: source.label,
    });
  }
  return { title: plainText(root.title, 100) || source.label, items };
}
async function pool<T, R>(
  values: T[],
  limit: number,
  fn: (v: T, i: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(values[i], i) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    }),
  );
  return results;
}
export async function fetchSource(
  source: Source,
  cache: Cache,
  transport: Transport,
  now: number,
  signal?: AbortSignal,
  amount = 30,
): Promise<FetchResult> {
  if (source.kind !== "hn") {
    const url =
      source.kind === "rss"
        ? source.url!
        : "https://www.reddit.com/r/" +
          source.subreddit +
          (source.sort === "new"
            ? "/new"
            : source.sort === "top"
              ? "/top"
              : "") +
          "/.rss" +
          (source.sort === "top" ? "?t=day" : "");
    const result = await transport(url, {
      signal,
      etag: cache.etag,
      modified: cache.modified,
    });
    if (result.status === 304)
      return {
        title: source.label,
        items: cache.items,
        notModified: true,
        hasMore: false,
        etag: result.etag,
        modified: result.modified,
      };
    return {
      ...parseFeed(result.text, source, result.url, now, cache.items),
      etag: result.etag,
      modified: result.modified,
      hasMore: false,
    };
  }
  const base = "https://hacker-news.firebaseio.com/v0/";
  let ids: unknown;
  try {
    ids = JSON.parse(
      (await transport(base + source.category + "stories.json", { signal }))
        .text,
    );
  } catch (e) {
    if (e instanceof FeedError) throw e;
    throw new FeedError("Hacker News returned an unreadable story list.");
  }
  if (
    !Array.isArray(ids) ||
    !ids.every((id) => Number.isSafeInteger(id) && id > 0)
  )
    throw new FeedError("Hacker News returned an unexpected story list.");
  const selected = ids.slice(0, Math.min(200, amount));
  const old = new Map(cache.items.map((i) => [i.id, i]));
  const results = await pool(selected, 6, async (id, rank) => {
    const raw = JSON.parse(
      (await transport(base + "item/" + id + ".json", { signal })).text,
    );
    if (
      !raw ||
      raw.deleted ||
      raw.dead ||
      !["story", "job", "poll"].includes(raw.type)
    )
      return null;
    const key = "hn:" + id;
    const discussionUrl = "https://news.ycombinator.com/item?id=" + id;
    const item: Item = {
      id: key,
      kind: "hn",
      title: plainText(raw.title, 500),
      url: optionalUrl(raw.url, discussionUrl) ?? discussionUrl,
      discussionUrl,
      author: plainText(raw.by, 100),
      publishedAt:
        Number.isFinite(raw.time) && raw.time > 0 ? raw.time * 1000 : null,
      firstSeenAt: old.get(key)?.firstSeenAt ?? now,
      summary: plainText(raw.text, 2000),
      score: Number.isFinite(raw.score) ? raw.score : undefined,
      comments: Number.isFinite(raw.descendants) ? raw.descendants : undefined,
      rank,
      sourceIds: [source.id],
      sourceLabel: source.label,
    };
    return item.title ? item : null;
  });
  const items: Item[] = [];
  let failures = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value) items.push(r.value);
    } else {
      failures++;
      const cached = old.get("hn:" + selected[i]);
      if (cached) items.push({ ...cached, rank: i });
    }
  });
  if (failures === selected.length && selected.length)
    throw new FeedError(
      "Hacker News stories could not be loaded. Cached items are still available.",
    );
  return {
    title: source.label,
    items,
    hasMore: ids.length > selected.length && amount < 200,
    notice: failures
      ? failures + " stories could not update. Refresh to try again."
      : undefined,
  };
}
