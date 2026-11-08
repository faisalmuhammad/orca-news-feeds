import { readFile, readdir, writeFile } from "node:fs/promises";
import { at } from "./paths.mjs";
const lock = JSON.parse(await readFile(at("build/package-lock.json"), "utf8"));
let output =
  "# Bundled dependency notices\n\nOriginal Feeds code and artwork use [MIT](LICENSE). Runtime packages bundled in worker/main.mjs retain the notices below. This conservatively includes all production dependencies in the lockfile; unused exports are removed by the bundler. Sharp, esbuild, TypeScript and their development dependencies are local tooling, not runtime dependencies.\n\n";
for (const [relative, info] of Object.entries(lock.packages).sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  if (!relative || info.dev) continue;
  const folder = at("build/" + relative),
    pkg = JSON.parse(await readFile(folder + "/package.json", "utf8"));
  const file = (await readdir(folder)).find((name) =>
    /^licen[cs]e(?:\.|$)/i.test(name),
  );
  let license;
  if (file) license = await readFile(folder + "/" + file, "utf8");
  else if (pkg.name === "@nodable/entities")
    license = await readFile(
      at("build/licenses/nodable-entities-MIT.txt"),
      "utf8",
    );
  else throw new Error("No license text found: " + pkg.name);
  output +=
    "## " +
    pkg.name +
    " " +
    pkg.version +
    "\n\nDeclared license: " +
    pkg.license +
    ".\n\n";
  if (!file)
    output +=
      "The npm package omits a license file. Text retrieved from https://github.com/nodable/val-parsers/blob/main/LICENSE on 2026-11-08 and retained under build/licenses/.\n\n";
  output += "~~~text\n" + license.trimEnd() + "\n~~~\n\n";
}
output +=
  "## Geist variable font\n\nBundled locally in panel/Geist-Variable.woff2, from the Vercel Geist distribution. SIL Open Font License 1.1; the complete license also ships as panel/Geist-OFL.txt.\n\n~~~text\n" +
  (await readFile(at("build/assets/Geist-OFL.txt"), "utf8")).trimEnd() +
  "\n~~~\n";
await writeFile(at("THIRD_PARTY_NOTICES.md"), output);
console.log("Updated runtime dependency notices and Geist OFL.");
