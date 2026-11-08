import { validUrl } from "../providers";
const MAX_BYTES = 2 * 1024 * 1024;
// Raster formats only; never send feed-provided HTML or SVG into the frame.
function imageType(bytes: Buffer): string | null {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString()))
    return "image/gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function fetchImage(
  raw: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  try {
    let url = validUrl(raw);
    const abort = AbortSignal.any([
      AbortSignal.timeout(8000),
      ...(signal ? [signal] : []),
    ]);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(url, {
        signal: abort,
        redirect: "manual",
        credentials: "omit",
        headers: {
          Accept: "image/webp,image/png,image/jpeg,image/gif",
          "User-Agent": "OrcaFeeds/0.1 (desktop feed reader)",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        if (redirects === 3) return null;
        url = validUrl(response.headers.get("location"), url);
        continue;
      }
      if (
        !response.ok ||
        !response.body ||
        Number(response.headers.get("content-length")) > MAX_BYTES
      ) {
        await response.body?.cancel();
        return null;
      }
      const reader = response.body.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const bytes = Buffer.concat(chunks),
        type = imageType(bytes);
      return type
        ? "data:" + type + ";base64," + bytes.toString("base64")
        : null;
    }
  } catch {}
  return null;
}
export class ImageCache {
  private cache = new Map<string, { value: string | null; expires: number }>();
  private pending = new Map<string, Promise<string | null>>();
  private abort = new AbortController();
  private active = 0;
  constructor(private load = fetchImage) {}
  async get(url: string): Promise<string | null> {
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) {
      this.cache.delete(url);
      this.cache.set(url, cached);
      return cached.value;
    }
    const pending = this.pending.get(url);
    if (pending) return pending;
    if (this.active >= 4 || this.abort.signal.aborted) return null;
    this.active++;
    const request = this.load(url, this.abort.signal)
      .then((value) => {
        this.cache.set(url, {
          value,
          expires: Date.now() + (value ? 30 * 60000 : 60000),
        });
        // At most 22 MiB of encoded previews in memory; nothing added to feed storage.
        while (this.cache.size > 8)
          this.cache.delete(this.cache.keys().next().value!);
        return value;
      })
      .catch(() => null)
      .finally(() => {
        this.active--;
        this.pending.delete(url);
      });
    this.pending.set(url, request);
    return request;
  }
  dispose() {
    this.abort.abort();
    this.cache.clear();
  }
}
