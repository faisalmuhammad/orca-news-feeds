import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLUGIN } from "../build/scripts/paths.mjs";

test("a fresh checkout typechecks without generated Orca files", () => {
  const fixture = mkdtempSync(path.join(tmpdir(), "feeds-typecheck-"));
  try {
    mkdirSync(path.join(fixture, "build"));
    cpSync(path.join(PLUGIN, "tsconfig.json"), path.join(fixture, "tsconfig.json"));
    for (const name of ["src", "types"])
      cpSync(path.join(PLUGIN, "build", name), path.join(fixture, "build", name), { recursive: true });
    symlinkSync(path.join(PLUGIN, "build/node_modules"), path.join(fixture, "build/node_modules"), "junction");
    assert.equal(existsSync(path.join(fixture, ".orca")), false);
    execFileSync(process.execPath, [
      path.join(PLUGIN, "build/node_modules/typescript/bin/tsc"),
      "--noEmit", "-p", fixture,
    ], { cwd: fixture, stdio: "pipe" });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
