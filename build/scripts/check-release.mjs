import sharp from "sharp";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { PLUGIN } from "./paths.mjs";
const root = process.argv[2] ? path.resolve(process.argv[2]) : PLUGIN;
const files = new Map(),
  ignored = new Set([
    ".git",
    ".orca",
    "node_modules",
    ".cache",
    ".DS_Store",
    "Thumbs.db",
  ]);
const privacyRules = [
  [
    "local user directory",
    /\/(?:Users|home)\/[A-Za-z0-9_.-]+(?:\/|\b)|[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s"'<>]+/i,
  ],
  [
    "credential token",
    /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/,
  ],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "live agent identifier",
    /\b(?:term_[a-f0-9]{8}-[a-f0-9-]{27,}|codex_[a-f0-9]{8}_[a-f0-9_]{27,})\b/i,
  ],
];
function collect(dir, prefix = "") {
  for (const name of readdirSync(dir).sort()) {
    if (ignored.has(name)) continue;
    const file = path.join(dir, name),
      relative = prefix + name,
      stat = lstatSync(file);
    assert.ok(!stat.isSymbolicLink(), "Symlink refused: " + relative);
    if (stat.isDirectory()) collect(file, relative + "/");
    else files.set(relative, readFileSync(file));
  }
}
collect(root);
if (existsSync(path.join(root, ".git"))) {
  for (const name of execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)) {
    const file = path.join(root, name);
    assert.ok(!lstatSync(file).isSymbolicLink(), "Tracked symlink: " + name);
    assert.ok(
      !name.split("/").some((p) => ignored.has(p)),
      "Tracked generated file: " + name,
    );
    files.set(name, readFileSync(file));
  }
}
const manifest = JSON.parse(files.get("orca-plugin.json").toString());
for (const file of [
  "README.md",
  "CHANGELOG.md",
  "COMPATIBILITY.md",
  "RELEASE.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  manifest.main,
  ...manifest.contributes.panels.map((p) => p.entry),
  "panel/app.js",
  "panel/styles.css",
  "panel/Geist-OFL.txt",
  "panel/Geist-Variable.woff2",
  "assets/SCREENSHOTS.md",
])
  assert.ok(files.has(file), "Required release file missing: " + file);
const decoder = new TextDecoder("utf-8", { fatal: true }),
  entries = new Set([
    manifest.main,
    ...manifest.contributes.panels.map((p) => p.entry),
  ]);
let total = 0;
for (const [name, data] of files) {
  total += data.length;
  if (entries.has(name))
    assert.ok(data.length <= 10 * 1024 * 1024, name + ": 10 MiB entry limit");
  if (/\.(ts|tsx|mts|jsx)$/.test(name))
    assert.ok(data.length <= 1024 * 1024, name + ": 1 MiB transpilation limit");
  if (/\.(png|jpe?g|webp|gif)$/.test(name)) {
    const info = await sharp(data).metadata();
    assert.ok(
      !info.exif && !info.xmp && !info.iptc,
      name + ": remove embedded image metadata before release",
    );
    continue;
  }
  if (
    [
      "panel/Geist-Variable.woff2",
      "build/assets/Geist-Variable.woff2",
    ].includes(name)
  ) {
    assert.equal(
      data.subarray(0, 4).toString("ascii"),
      "wOF2",
      name + ": expected WOFF2",
    );
    assert.ok(
      files
        .get(name.replace("Geist-Variable.woff2", "Geist-OFL.txt"))
        ?.includes("SIL OPEN FONT LICENSE"),
      "Font license missing",
    );
    continue;
  }
  const source = decoder.decode(data);
  // Source maps are local, ignored build output; publication uses compiled scripts.
  if (!name.endsWith(".map")) {
    for (const [kind, pattern] of privacyRules)
      assert.ok(!pattern.test(source), name + ": contains " + kind);
  }
  assert.ok(!data.includes(0), "Unexpected binary file: " + name);
}
assert.ok(files.size <= 2000, "2,000-file Orca limit");
assert.ok(total <= 50 * 1024 * 1024, "50 MiB Orca limit");
assert.ok(
  !manifest.publisher,
  "Let Orca derive the publisher from the repository owner",
);
assert.ok(
  manifest.author?.name && manifest.repository && manifest.cover?.alt,
  "Listing metadata missing",
);
assert.ok(manifest.screenshots.length <= 6, "At most six screenshots");
let imageBytes = 0;
const images = [];
for (const [kind, item] of [
  ["icon", { path: manifest.icon }],
  ["cover", manifest.cover],
  ...manifest.screenshots.map((s) => ["screenshot", s]),
]) {
  const data = files.get(item.path);
  assert.ok(data, "Missing listing image: " + item.path);
  const info = await sharp(data).metadata();
  assert.ok(
    ["png", "jpeg", "webp"].includes(info.format) && (info.pages ?? 1) === 1,
    "Listing image must be static PNG/JPEG/WebP",
  );
  const [w, h, max] =
    kind === "icon"
      ? [128, 128, 256 * 1024]
      : kind === "cover"
        ? [800, 500, 1024 * 1024]
        : [1280, 800, 1.5 * 1024 * 1024];
  assert.ok(
    info.width >= w && info.height >= h && data.length <= max,
    "Listing dimensions/size: " + item.path,
  );
  if (kind === "icon")
    assert.equal(info.width, info.height, "Square icon required");
  else assert.ok(item.alt, "Listing alt text required: " + item.path);
  imageBytes += data.length;
  images.push({
    path: item.path,
    width: info.width,
    height: info.height,
    bytes: data.length,
  });
}
assert.ok(imageBytes <= 8 * 1024 * 1024, "8 MiB combined listing images limit");
if (files.has("package.json")) {
  const pkg = JSON.parse(files.get("package.json"));
  const build = JSON.parse(files.get("build/package.json")),
    lock = JSON.parse(files.get("build/package-lock.json"));
  assert.equal(pkg.version, manifest.version);
  assert.equal(build.version, manifest.version);
  const notices = files.get("THIRD_PARTY_NOTICES.md").toString();
  for (const [name, info] of Object.entries(lock.packages)) {
    if (!name || info.dev) continue;
    const pkgName = name.slice(name.lastIndexOf("node_modules/") + 13);
    assert.ok(
      notices.includes("## " + pkgName + " " + info.version),
      "Stale dependency notice: " + pkgName,
    );
  }
}
const normalizeLicense = (data) =>
  data
    .toString()
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
assert.ok(
  normalizeLicense(files.get("THIRD_PARTY_NOTICES.md")).includes(
    normalizeLicense(files.get("panel/Geist-OFL.txt")),
  ),
  "Complete font license required",
);
console.log(
  JSON.stringify(
    {
      ok: true,
      folder: root,
      files: files.size,
      totalBytes: total,
      listingImageBytes: imageBytes,
      privacyChecks:
        "No local user paths, credential tokens, private keys or live agent identifiers in release text files",
      images,
    },
    null,
    2,
  ),
);
