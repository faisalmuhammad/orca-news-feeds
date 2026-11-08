import test from "node:test";
import assert from "node:assert/strict";
import { fetchImage, ImageCache } from "../.orca/tests/images.mjs";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
test("image requests omit cookies and return only bounded raster data", async () => {
  let options;
  const value = await fetchImage(
    "https://example.org/photo",
    undefined,
    async (url, input) => {
      options = input;
      return new Response(png, { headers: { "content-type": "image/png" } });
    },
  );
  assert.equal(value, "data:image/png;base64," + png.toString("base64"));
  assert.equal(options.credentials, "omit");
  assert.equal(options.redirect, "manual");
  for (const content of [
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    "<html>not a photo</html>",
    Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]),
  ])
    assert.equal(
      await fetchImage(
        "https://example.org/img",
        undefined,
        async () =>
          new Response(content, { headers: { "content-type": "image/png" } }),
      ),
      null,
    );
});
test("unsafe image URLs and redirect destinations are rejected", async () => {
  let calls = 0;
  for (const url of [
    "file:///tmp/photo",
    "data:image/png;base64,aaa",
    "https://name:secret@example.org/image",
  ])
    assert.equal(
      await fetchImage(url, undefined, async () => {
        calls++;
        return new Response(png);
      }),
      null,
    );
  assert.equal(calls, 0);
  assert.equal(
    await fetchImage(
      "https://example.org/img",
      undefined,
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "file:///tmp/photo" },
        }),
    ),
    null,
  );
});
test("unavailable images stay optional and duplicate requests share one fetch", async () => {
  assert.equal(
    await fetchImage(
      "https://example.org/img",
      undefined,
      async () => new Response(null, { status: 404 }),
    ),
    null,
  );
  let calls = 0,
    release;
  const cache = new ImageCache(async () => {
    calls++;
    await new Promise((r) => (release = r));
    return "data:image/png;base64,abc";
  });
  const first = cache.get("https://example.org/img"),
    second = cache.get("https://example.org/img");
  release();
  assert.deepEqual(await Promise.all([first, second]), [
    "data:image/png;base64,abc",
    "data:image/png;base64,abc",
  ]);
  await cache.get("https://example.org/img");
  assert.equal(calls, 1);
  cache.dispose();
  assert.equal(await cache.get("https://other.org/img"), null);
});
