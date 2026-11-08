import { PLUGIN, RELEASE } from "./paths.mjs";
process.chdir(PLUGIN);
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { execFileSync } from "node:child_process";
const manifest = JSON.parse(readFileSync("orca-plugin.json", "utf8"));
if (
  manifest.id !== "news-feeds" ||
  !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(manifest.version)
)
  throw new Error("Unexpected release identity");
const release = manifest.id + "-" + manifest.version;
const folder = join(RELEASE, release);
rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });
const roots = [
  "orca-plugin.json",
  "panel",
  "worker",
  "assets",
  "README.md",
  "CHANGELOG.md",
  "RELEASE.md",
  "COMPATIBILITY.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];
for (const root of roots) {
  if (!existsSync(root)) throw new Error("Missing distribution file: " + root);
  mkdirSync(dirname(join(folder, root)), { recursive: true });
  cpSync(root, join(folder, root), {
    recursive: true,
    filter: (path) => {
      if (lstatSync(path).isSymbolicLink())
        throw new Error("Symlink refused: " + path);
      return (
        ![".DS_Store", "Thumbs.db", "social.png"].includes(basename(path)) &&
        !path.endsWith(".map")
      );
    },
  });
}
const files = [];
function collect(dir, prefix = "") {
  for (const name of readdirSync(dir).sort()) {
    if ([".DS_Store", "Thumbs.db"].includes(name)) continue;
    const path = join(dir, name);
    const stat = lstatSync(path);
    const relative = prefix + name;
    if (stat.isSymbolicLink()) throw new Error("Symlink refused: " + relative);
    if (stat.isDirectory()) collect(path, relative + "/");
    else
      files.push({ name: release + "/" + relative, data: readFileSync(path) });
  }
}
execFileSync(
  process.execPath,
  [join(PLUGIN, "build/scripts/check-release.mjs"), folder],
  { stdio: "inherit" },
);
collect(folder);
const bytes = files.reduce((sum, file) => sum + file.data.length, 0);
const entries = new Set(
  [
    ...(manifest.contributes?.panels || []),
    ...(manifest.contributes?.customEditors || []),
  ].flatMap((item) =>
    typeof item.entry === "string" ? [release + "/" + item.entry] : [],
  ),
);
if (
  bytes > 50 * 1024 * 1024 ||
  files.length > 2000 ||
  files.some(
    (file) => entries.has(file.name) && file.data.length > 10 * 1024 * 1024,
  ) ||
  files.some(
    (file) =>
      /\.(ts|tsx|mts|jsx)$/.test(file.name) && file.data.length > 1024 * 1024,
  )
)
  throw new Error("Distribution exceeds Orca package limits");
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const local = [],
  central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name);
  const compressed = deflateRawSync(file.data, { level: 9 });
  const crc = crc32(file.data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(file.data.length, 22);
  header.writeUInt16LE(name.length, 26);
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(33, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(compressed.length, 20);
  entry.writeUInt32LE(file.data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  local.push(header, name, compressed);
  central.push(entry, name);
  offset += header.length + name.length + compressed.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
const archive = Buffer.concat([...local, directory, end]);
const filename = release + ".zip";
writeFileSync(join(RELEASE, filename), archive);
const digest = createHash("sha256").update(archive).digest("hex");
writeFileSync(join(RELEASE, "SHA256SUMS"), digest + "  " + filename + "\n");
const measurement = {
  version: manifest.version,
  files: files.length,
  unpackedBytes: bytes,
  archiveBytes: archive.length,
  largestScriptBytes: Math.max(
    ...files
      .filter((file) => /\.(m?js)$/.test(file.name))
      .map((file) => file.data.length),
  ),
  sha256: digest,
};
writeFileSync(
  join(RELEASE, "artifact.json"),
  JSON.stringify(measurement, null, 2) + "\n",
);
console.log(JSON.stringify(measurement, null, 2));
