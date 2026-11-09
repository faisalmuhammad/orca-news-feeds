import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const at = (p) => path.join(root, p);
for (const dir of ["worker", "panel", ".orca/tests"])
  await mkdir(at(dir), { recursive: true });
await Promise.all([
  build({
    entryPoints: [at("build/src/worker/main.ts")],
    outfile: at("worker/main.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["orca", "orca/*"],
    sourcemap: "external",
  }),
  build({
    entryPoints: [at("build/src/worker/core.ts")],
    outfile: at(".orca/tests/core.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: [at("build/src/worker/launch.ts")],
    outfile: at(".orca/tests/launch.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: [at("build/src/worker/images.ts")],
    outfile: at(".orca/tests/images.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: [at("build/src/panel/i18n.ts")],
    outfile: at(".orca/tests/i18n.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
  }),
  build({
    entryPoints: [at("build/src/panel/app.ts")],
    outfile: at("panel/app.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2022",
    minify: true,
    sourcemap: "external",
  }),
  ...["index.html", "styles.css"].map((f) =>
    copyFile(at("build/src/panel/" + f), at("panel/" + f)),
  ),
  copyFile(
    at("build/assets/Geist-Variable.woff2"),
    at("panel/Geist-Variable.woff2"),
  ),
  copyFile(at("build/assets/Geist-OFL.txt"), at("panel/Geist-OFL.txt")),
]);
console.log("Built Feeds panel, worker, and test bundle.");
