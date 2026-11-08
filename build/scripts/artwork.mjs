import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { at } from "./paths.mjs";
export const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export const tag = (name, attrs, body = "") =>
  "<" +
  name +
  " " +
  Object.entries(attrs)
    .map(([k, v]) => k + '="' + escape(v) + '"')
    .join(" ") +
  ">" +
  body +
  "</" +
  name +
  ">";
export const text = (x, y, label, size = 24, fill = "#f9efdf", attrs = {}) =>
  tag("text", { x, y, "font-size": size, fill, ...attrs }, escape(label));
export const mark = (x, y, size) =>
  tag(
    "g",
    { transform: "translate(" + x + " " + y + ") scale(" + size / 256 + ")" },
    '<rect width="256" height="256" rx="64" fill="url(#copper)"/><rect x="1" y="1" width="254" height="254" rx="63" fill="none" stroke="#ffe1b4" stroke-opacity=".5" stroke-width="2"/><g fill="none" stroke="#3e251b" stroke-width="13" stroke-linecap="round"><path d="M67 121a68 68 0 0 1 68 68M67 66a123 123 0 0 1 123 123"/></g><circle cx="72" cy="184" r="10" fill="#3e251b"/>',
  );
const defs =
  '<defs><linearGradient id="copper" x2="1" y2="1"><stop stop-color="#ffe0a7"/><stop offset=".48" stop-color="#e3a56e"/><stop offset="1" stop-color="#ad613f"/></linearGradient><radialGradient id="glow"><stop stop-color="#326d98" stop-opacity=".55"/><stop offset="1" stop-color="#102437" stop-opacity="0"/></radialGradient><linearGradient id="background" x2="1" y2="1"><stop stop-color="#102437"/><stop offset="1" stop-color="#183a52"/></linearGradient></defs>';
export const svg = (body, width = 1600, height = 1000) =>
  tag(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      "xmlns:xlink": "http://www.w3.org/1999/xlink",
      width,
      height,
      viewBox: "0 0 " + width + " " + height,
      "font-family": "Helvetica Neue, Helvetica, Arial, sans-serif",
    },
    defs + body,
  );
export function backdrop(light = false) {
  const dots = Array.from({ length: 21 }, (_, row) =>
    Array.from({ length: 33 }, (_, col) =>
      tag("circle", {
        cx: col * 50,
        cy: row * 50,
        r: 1,
        fill: light ? "#65778a" : "#bed0e0",
        opacity: 0.1,
      }),
    ).join(""),
  ).join("");
  return (
    tag("rect", {
      width: 1600,
      height: 1000,
      fill: light ? "#eef2f6" : "url(#background)",
    }) +
    tag("ellipse", {
      cx: 1170,
      cy: 490,
      rx: 760,
      ry: 720,
      fill: "url(#glow)",
      opacity: light ? 0.18 : 1,
    }) +
    dots +
    tag(
      "g",
      {
        fill: "none",
        stroke: light ? "#b5c4d2" : "#83a4c1",
        "stroke-opacity": 0.13,
      },
      [250, 400, 550, 700]
        .map((r) => tag("circle", { cx: 1190, cy: 490, r }))
        .join(""),
    )
  );
}
export const brand = (light = false) =>
  mark(96, 76, 58) +
  text(174, 116, "FEEDS / ORCA", 23, light ? "#344f66" : "#f5d1ad", {
    "font-weight": 600,
    "letter-spacing": 2,
  });
export const footer = (label, light = false) =>
  tag("path", { d: "M96 912H1504", stroke: light ? "#ccd6df" : "#345169" }) +
  text(96, 951, label, 19, light ? "#53677c" : "#a9bccd") +
  text(
    1504,
    951,
    "INDEPENDENT COMMUNITY PLUGIN",
    13,
    light ? "#53677c" : "#a9bccd",
    { "text-anchor": "end", "letter-spacing": 1.5 },
  );
export async function capture(file, x, y, width) {
  const raw = await readFile(at("build/assets/captures/" + file));
  const meta = await sharp(raw).metadata();
  const height = Math.round((width * meta.height) / meta.width),
    id = "clip-" + x + "-" + y;
  return (
    tag(
      "defs",
      {},
      tag("clipPath", { id }, tag("rect", { x, y, width, height, rx: 16 })),
    ) +
    tag("rect", {
      x: x - 5,
      y: y - 5,
      width: width + 10,
      height: height + 10,
      rx: 21,
      fill: "#181a1b",
      stroke: "#9d7957",
      "stroke-opacity": 0.5,
    }) +
    tag("rect", {
      x: x + 12,
      y: y + 16,
      width,
      height,
      rx: 16,
      fill: "#000",
      opacity: 0.16,
    }) +
    tag("image", {
      x,
      y,
      width,
      height,
      "clip-path": "url(#" + id + ")",
      "xlink:href": "data:image/png;base64," + raw.toString("base64"),
    })
  );
}
export async function exportArt(file, source) {
  await mkdir(at("build/assets/artwork"), { recursive: true });
  await mkdir(at("assets"), { recursive: true });
  await writeFile(at("build/assets/artwork/" + file + ".svg"), source);
  await sharp(Buffer.from(source))
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0 })
    .toFile(at("assets/" + file + ".png"));
  console.log("Generated " + file + ".png");
}
