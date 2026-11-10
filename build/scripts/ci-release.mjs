import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PLUGIN } from "./paths.mjs";
import path from "node:path";

export function releaseInfo(version, changelog, tag = "") {
  assert.match(
    version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    "Use a stable major.minor.patch release version",
  );
  if (tag) assert.equal(tag, "v" + version, "Tag must match orca-plugin.json version");
  const sections = changelog.replace(/\r\n/g, "\n").split(/^## /m);
  const entry = sections.slice(1).find((section) =>
    section.startsWith(version + " ") || section.startsWith(version + "\n"));
  assert.ok(entry, "Missing changelog entry for " + version);
  const notes = entry.slice(entry.indexOf("\n") + 1).trim();
  assert.ok(notes && entry.includes("\n"), "Empty changelog entry for " + version);
  return { version, tag: "v" + version, notes: notes + "\n" };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const read = (name) => readFileSync(path.join(PLUGIN, name), "utf8");
  const manifest = JSON.parse(read("orca-plugin.json"));
  for (const file of ["package.json", "build/package.json", "build/package-lock.json"]) {
    const pkg = JSON.parse(read(file));
    assert.equal(pkg.version, manifest.version, file + " version must match manifest");
    if (file.endsWith("package-lock.json"))
      assert.equal(pkg.packages[""].version, manifest.version, "Lockfile root version must match manifest");
  }
  const info = releaseInfo(manifest.version, read("CHANGELOG.md"), process.env.RELEASE_TAG);
  if (process.argv[2]) writeFileSync(process.argv[2], info.notes);
  console.log("Release metadata valid: " + info.tag);
}
