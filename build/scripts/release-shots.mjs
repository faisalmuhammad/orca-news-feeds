import { execFileSync } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import sharp from "sharp";
import { PLUGIN, at } from "./paths.mjs";
import {
  svg,
  backdrop,
  brand,
  text,
  capture,
  footer,
  exportArt,
} from "./artwork.mjs";
// Regenerating committed captures needs no browser or live subscriptions.
if (!process.argv.includes("--from-captures")) {
  for (const mode of [[], ["--starters"], ["--images"]])
    execFileSync(
      process.execPath,
      [at("build/scripts/browser-test.mjs"), ...mode],
      { cwd: PLUGIN, stdio: "inherit" },
    );
  await mkdir(at("build/assets/captures"), { recursive: true });
  for (const file of [
    "feeds-dark-320.png",
    "feeds-dark-440.png",
    "expanded-rss-light-320.png",
    "ask-inline-light-440.png",
  ])
    await sharp(at(".orca/shots/" + file))
      .png({ compressionLevel: 9 })
      .toFile(at("build/assets/captures/" + file));
}
const sheets = [
  {
    file: "screenshot-reading",
    light: false,
    kicker: "01 / READ & EXPLORE",
    title: ["Open a story.", "Stay in the flow."],
    lines: [
      "RSS, Hacker News and Reddit, together.",
      "Expand a headline without leaving the list.",
      "Search, filter and save your next good read.",
    ],
    shots: [
      ["feeds-dark-320.png", 806, 114, 320],
      ["expanded-rss-light-320.png", 1164, 114, 320],
    ],
  },
  {
    file: "screenshot-agent",
    light: true,
    kicker: "02 / ASK AN AGENT",
    title: ["News worth", "a conversation."],
    lines: [
      "Ask about a story in a fresh agent session.",
      "Choose a question, workspace and agent.",
      "The headline, links and excerpt go with it.",
    ],
    shots: [["ask-inline-light-440.png", 1000, 104, 400]],
  },
];
// Retire only known generated gallery assets; keep the current inputs.
for (const file of [
  "screenshot-light",
  "screenshot-dark",
  "screenshot-sources",
  "screenshot-images",
]) {
  await rm(at("assets/" + file + ".png"), { force: true });
  await rm(at("build/assets/artwork/" + file + ".svg"), { force: true });
}
for (const file of [
  "feeds-light-320.png",
  "welcome-starters-light-320.png",
  "rss-suggestions-light.png",
  "reddit-suggestions-light.png",
  "image-cards-light.png",
  "image-card-expanded-dark.png",
])
  await rm(at("build/assets/captures/" + file), { force: true });
for (const s of sheets) {
  const ink = s.light ? "#233848" : "#f4f7fa",
    quiet = s.light ? "#53677c" : "#b5c7d8";
  let body =
    backdrop(s.light) +
    brand(s.light) +
    text(96, 271, s.kicker, 17, quiet, { "letter-spacing": 2.4 });
  s.title.forEach((line, i) => {
    body += text(92, 379 + i * 85, line, 72, ink, {
      "font-weight": 500,
      "letter-spacing": -2.5,
    });
  });
  s.lines.forEach((line, i) => {
    body += text(96, 572 + i * 39, line, 24, quiet);
  });
  body +=
    text(96, 784, "REAL PANEL CAPTURES", 14, quiet, { "letter-spacing": 2 }) +
    text(96, 817, "Labeled sample data · Desktop browser preview", 18, quiet);
  for (const shot of s.shots) body += await capture(...shot);
  body += footer(
    s.file === "screenshot-agent"
      ? "The preview shows the form; it never starts real agents."
      : "A little news. A wider perspective.",
    s.light,
  );
  await exportArt(s.file, svg(body));
}
await writeFile(
  at("build/assets/captures/capture-index.json"),
  JSON.stringify(
    {
      capturedWith: "Orca 1.4.253 embedded Chromium, local Feeds preview",
      fixtures: "build/scripts/demo-data.mjs",
      note: "Sample data and bridge mocks; no user library or agent conversation appears.",
      sheets: sheets.map(({ file, shots }) => ({
        file: "assets/" + file + ".png",
        captures: shots.map(([file]) => file),
      })),
    },
    null,
    2,
  ) + "\n",
);
