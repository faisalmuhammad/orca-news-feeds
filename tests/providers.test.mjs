import test from "node:test";
import assert from "node:assert/strict";
import {
  parseFeed,
  plainText,
  normalizeDraft,
  fetchSource,
  retryAfter,
  validUrl,
} from "../.orca/tests/core.mjs";
const now = 1731000000000,
  source = {
    id: "s1",
    kind: "rss",
    url: "https://example.org/feed",
    identity: "rss:https://example.org/feed",
    label: "Example",
    enabled: true,
    version: 1,
    createdAt: now,
  };
const cache = {
  items: [],
  checkedAt: 0,
  successAt: 0,
  failures: 0,
  retryAt: 0,
  loaded: 0,
  hasMore: false,
};
test("RSS namespaces, CDATA, duplicate GUIDs, relative links and unknown dates", () => {
  const xml =
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>News &amp; ideas</title><item><title>First &amp; second</title><guid isPermaLink="false">id-1</guid><link>/story</link><dc:creator>Alex</dc:creator><content:encoded><![CDATA[<p>Hello <b>world</b>.</p><script>ignore me</script><p>Next paragraph.</p>]]></content:encoded><pubDate>unknown</pubDate></item><item><title>Duplicate</title><guid isPermaLink="false">id-1</guid></item></channel></rss>';
  const first = parseFeed(xml, source, source.url, now);
  assert.equal(first.title, "News & ideas");
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].url, "https://example.org/story");
  assert.equal(first.items[0].author, "Alex");
  assert.equal(first.items[0].summary, "Hello world.\n\nNext paragraph.");
  assert.equal(first.items[0].publishedAt, null);
  const later = parseFeed(xml, source, source.url, now + 10000, first.items);
  assert.equal(later.items[0].firstSeenAt, now);
});
test("Lobsters comment-only excerpts are omitted while useful text is retained", () => {
  const result = parseFeed(
    '<rss><channel><title>Lobsters</title><item><title>Headline</title><description><![CDATA[<a href="https://lobste.rs/s/story">Comments</a>]]></description></item><item><title>Another headline</title><description>A discussion about comments in code.</description></item></channel></rss>',
    source,
    source.url,
    now,
  );
  assert.equal(result.items[0].summary, "");
  assert.equal(result.items[1].summary, "A discussion about comments in code.");
});
test("Atom xml:base and alternate link select the article rather than self feed", () => {
  const xml =
    '<feed xmlns="http://www.w3.org/2005/Atom" xml:base="https://example.org/articles/"><title>Atom</title><entry xml:base="notes/"><id>one</id><title>One</title><link rel="self" href="entry.xml"/><link rel="alternate" href="one"/><published>2024-11-07T10:00:00Z</published><summary>&lt;p&gt;A summary.&lt;/p&gt;</summary><author><name>Editor</name></author></entry></feed>';
  const result = parseFeed(xml, source, source.url, now);
  assert.equal(result.items[0].url, "https://example.org/articles/notes/one");
  assert.equal(result.items[0].summary, "A summary.");
  assert.equal(result.items[0].author, "Editor");
  assert.ok(result.items[0].publishedAt);
});
test("RSS 1.0 RDF items are read beside the channel", () => {
  const r = parseFeed(
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>RDF</title></channel><item rdf:about="https://example.org/a"><title>RDF story</title><link>https://example.org/a</link></item></rdf:RDF>',
    source,
    source.url,
    now,
  );
  assert.equal(r.items.length, 1);
});
test("RSS image metadata supports thumbnails, media groups and enclosures", () => {
  for (const [markup, expected] of [
    [
      '<media:thumbnail url="/thumb.png"/><media:content url="/full.jpg" type="image/jpeg"/>',
      "https://example.org/thumb.png",
    ],
    [
      '<media:group><media:content url="/photo.jpg" medium="image"/></media:group>',
      "https://example.org/photo.jpg",
    ],
    [
      '<enclosure url="/audio.mp3" type="audio/mpeg"/><enclosure url="/cover.jpg" type="image/jpeg"/>',
      "https://example.org/cover.jpg",
    ],
    [
      '<media:thumbnail url="javascript:alert(1)"/><description><![CDATA[<img src="../excerpt.png">Text]]></description>',
      "https://example.org/excerpt.png",
    ],
    [
      '<description><![CDATA[<img src="https://user:secret@example.org/img"><img src="data:image/png;base64,aaa">]]></description>',
      undefined,
    ],
  ]) {
    const result = parseFeed(
      '<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><title>Images</title><item><title>Story</title>' +
        markup +
        "<description>Fallback excerpt</description>" +
        "</item></channel></rss>",
      source,
      source.url,
      now,
    );
    assert.equal(result.items[0].imageUrl, expected);
    if (markup.includes("media:content"))
      assert.equal(result.items[0].summary, "Fallback excerpt");
  }
});
test("Atom and Reddit excerpt images resolve against entry base without inserting HTML", () => {
  const xml =
    '<feed xmlns="http://www.w3.org/2005/Atom"><title>Images</title><entry xml:base="https://example.org/posts/"><title>Story</title><id>one</id><content type="html">&lt;p&gt;Hello&lt;img src="../thumb.jpg?a=1&amp;amp;b=2"&gt;&lt;/p&gt;</content></entry></feed>';
  const result = parseFeed(xml, { ...source, kind: "reddit" }, source.url, now);
  assert.equal(
    result.items[0].imageUrl,
    "https://example.org/thumb.jpg?a=1&b=2",
  );
  assert.equal(result.items[0].summary, "Hello");
  const enclosure = parseFeed(
    '<feed><title>Images</title><entry><title>Photo</title><link rel="enclosure" type="image/png" href="/photo.png"/></entry></feed>',
    source,
    source.url,
    now,
  );
  assert.equal(enclosure.items[0].imageUrl, "https://example.org/photo.png");
});
test("malformed XML, websites, DTDs and deep XML fail with useful messages", () => {
  for (const xml of [
    "<rss><channel>",
    "<html><body>website</body></html>",
    '<!DOCTYPE rss [<!ENTITY x "bad">]><rss/>',
    "<rss><channel>" +
      "<a>".repeat(130) +
      "</a>".repeat(130) +
      "</channel></rss>",
  ])
    assert.throws(() => parseFeed(xml, source, source.url, now));
});
test("GitHub Blog HTML doctypes inside CDATA are excerpt text, not XML declarations", () => {
  const result = parseFeed(
    '<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>GitHub Blog</title><item><title>News</title><content:encoded><![CDATA[<!DOCTYPE html><html><body><p>Developer news.</p></body></html>]]></content:encoded></item></channel></rss>',
    source,
    source.url,
    now,
  );
  assert.equal(result.items[0].summary, "Developer news.");
});
test("titles and summaries are plain text and unsafe item links are omitted", () => {
  assert.equal(
    plainText("<style>hide</style>Read <b>this</b><script>bad()</script>"),
    "Read this",
  );
  const r = parseFeed(
    '<rss><channel><title>Test</title><item><title>Title</title><guid isPermaLink="false">g</guid><link>javascript:alert(1)</link></item></channel></rss>',
    source,
    source.url,
    now,
  );
  assert.equal(r.items[0].url, null);
});
test("source validation canonicalizes subreddits and refuses credentials or invalid categories", () => {
  assert.equal(
    normalizeDraft({ kind: "reddit", subreddit: "/r/Programming", sort: "new" })
      .subreddit,
    "programming",
  );
  assert.equal(
    normalizeDraft({ kind: "rss", url: "https://example.org/feed#fragment" })
      .url,
    "https://example.org/feed",
  );
  for (const raw of [
    "file:///tmp/rss",
    "https://user:secret@example.org/rss",
    "",
  ])
    assert.throws(() => validUrl(raw));
  assert.throws(() => normalizeDraft({ kind: "hn", category: "anything" }));
  assert.throws(() =>
    normalizeDraft({ kind: "reddit", subreddit: "hello/world" }),
  );
});
test("HN hydrates a bounded first page, preserves ranking and skips dead/null items", async () => {
  let calls = 0;
  const transport = async (url) => {
    calls++;
    if (url.includes("stories"))
      return {
        url,
        status: 200,
        text: JSON.stringify(Array.from({ length: 60 }, (_, i) => i + 1)),
      };
    const id = Number(url.match(/item\/(\d+)/)[1]);
    return {
      url,
      status: 200,
      text: JSON.stringify(
        id === 2
          ? null
          : {
              id,
              type: "story",
              dead: id === 3,
              title: "Story " + id,
              time: 1000 + id,
              score: id,
              descendants: 4,
            },
      ),
    };
  };
  const r = await fetchSource(
    { ...source, kind: "hn", category: "top" },
    cache,
    transport,
    now,
  );
  assert.equal(calls, 31);
  assert.equal(r.items.length, 28);
  assert.equal(r.items[0].id, "hn:1");
  assert.equal(r.items[1].id, "hn:4");
  assert.equal(r.items[0].url, r.items[0].discussionUrl);
  assert.equal(r.hasMore, true);
});
test("conditional Atom responses keep cached content", async () => {
  const items = [{ id: "old" }];
  const r = await fetchSource(
    source,
    { ...cache, items, etag: "a" },
    async (url, opts) => {
      assert.equal(opts.etag, "a");
      return { url, status: 304, text: "" };
    },
    now,
  );
  assert.deepEqual(r.items, items);
  assert.equal(r.notModified, true);
});
test("Retry-After accepts seconds or HTTP dates with a one-day ceiling", () => {
  assert.equal(retryAfter("120", now), 120000);
  assert.equal(retryAfter(new Date(now + 60000).toUTCString(), now), 60000);
  assert.equal(retryAfter("9999999", now), 86400000);
});
