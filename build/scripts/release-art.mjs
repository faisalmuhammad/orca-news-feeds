import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import { at, RELEASE } from "./paths.mjs";
import {
  svg,
  backdrop,
  brand,
  mark,
  text,
  tag,
  capture,
  footer,
  exportArt,
} from "./artwork.mjs";
const icon = svg(mark(0, 0, 512), 512, 512);
await writeFile(at("assets/icon.svg"), icon);
await exportArt("icon", icon);
const cover = svg(
  backdrop() +
    brand() +
    text(96, 256, "NEWS & COMMUNITY. WITHIN REACH.", 18, "#caa889", {
      "letter-spacing": 3,
    }) +
    text(86, 429, "Feeds", 178, "#fff4e3", {
      "font-weight": 600,
      "letter-spacing": -9,
    }) +
    text(536, 429, ".", 178, "#e4af7b", { "font-weight": 600 }) +
    text(96, 537, "A little news.", 52, "#f3dfc9", { "letter-spacing": -1.5 }) +
    text(96, 604, "A wider perspective.", 52, "#f3dfc9", {
      "letter-spacing": -1.5,
    }) +
    text(96, 686, "Follow your sources. Save a good read.", 25, "#b5c7d8") +
    text(
      96,
      725,
      "Ask an agent to help make sense of a story.",
      25,
      "#b5c7d8",
    ) +
    [
      [96, 100, "RSS / ATOM"],
      [218, 155, "HACKER NEWS"],
      [395, 94, "REDDIT"],
    ]
      .map(
        ([x, w, label]) =>
          tag("rect", {
            x,
            y: 786,
            width: w,
            height: 42,
            rx: 21,
            fill: "#302821",
            stroke: "#72553f",
          }) +
          text(x + w / 2, 813, label, 13, "#e7c4a1", {
            "text-anchor": "middle",
            "letter-spacing": 1,
          }),
      )
      .join("") +
    '<g transform="translate(740 50) rotate(-9)"><path d="M0 40a180 180 0 0 1 180 180M0 -85a305 305 0 0 1 305 305" fill="none" stroke="url(#copper)" stroke-opacity=".32" stroke-width="20" stroke-linecap="round"/><circle cy="220" r="15" fill="#dba571"/></g>' +
    (await capture("feeds-dark-440.png", 984, 128, 440)) +
    text(1204, 119, "THE ACTUAL FEEDS PANEL · SAMPLE STORIES", 12, "#c8ab8c", {
      "text-anchor": "middle",
      "letter-spacing": 1.1,
    }) +
    footer("Your reading corner, right inside Orca."),
);
await exportArt("cover", cover);
await mkdir(RELEASE, { recursive: true });
await sharp(at("assets/cover.png"))
  .resize(1200, 750)
  .png({ compressionLevel: 9 })
  .toFile(RELEASE + "/social.png");
console.log("Generated release social.png (1200 × 750).");
