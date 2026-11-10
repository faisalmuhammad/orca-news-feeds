import test from "node:test";
import assert from "node:assert/strict";
import { releaseInfo } from "../build/scripts/ci-release.mjs";

const changelog = "# Changelog\n\n## 0.2.0 - Chinese localization\n- Translate the UI.\n\n## 0.1.0 — initial release\n- Read feeds.\n";

test("release notes contain only the tagged version's changelog entry", () => {
  assert.deepEqual(releaseInfo("0.2.0", changelog, "v0.2.0"), {
    version: "0.2.0", tag: "v0.2.0", notes: "- Translate the UI.\n",
  });
  assert.equal(releaseInfo("0.1.0", changelog.replace(/\n/g, "\r\n")).notes, "- Read feeds.\n");
});

test("a tag for a different version cannot be released", () => {
  assert.throws(() => releaseInfo("0.2.0", changelog, "v0.1.0"), /Tag must match/);
  assert.throws(() => releaseInfo("0.2.0", changelog, "0.2.0"), /Tag must match/);
});

test("missing, empty and similarly prefixed changelog entries fail", () => {
  assert.throws(() => releaseInfo("0.3.0", changelog), /Missing changelog/);
  assert.throws(() => releaseInfo("0.2.0", "## 0.2.01\n- Other version."), /Missing changelog/);
  assert.throws(() => releaseInfo("0.2.0", "## 0.2.0\n\n## 0.1.0\n- Old."), /Empty changelog/);
});

test("release versions cannot contain shell syntax or unsupported prerelease suffixes", () => {
  for (const version of ["0.2.0;echo injected", "0.2.0-beta.1", "00.2.0", "0.2"])
    assert.throws(() => releaseInfo(version, changelog), /stable major.minor.patch/);
});
