const paths: Record<string, string> = {
  feed: '<circle cx="5" cy="19" r="1" fill="currentColor" stroke="none"/><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5M6.2 6.2A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.8 5.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  saved: '<path d="M6 4h12v17l-6-4-6 4z" fill="currentColor"/>',
  all: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  hn: '<path d="m6 5 6 9 6-9M12 14v6"/>',
  reddit:
    '<ellipse cx="12" cy="15" rx="8" ry="6"/><path d="m12 9 2-6 5 1M8 18c2 1 6 1 8 0M4 11c-4-2-4 4 0 4M20 11c4-2 4 4 0 4"/><circle cx="20" cy="4" r="2"/><circle cx="8.5" cy="14" r=".8" fill="currentColor"/><circle cx="15.5" cy="14" r=".8" fill="currentColor"/>',
  sources:
    '<path d="M5 6h14M5 12h14M5 18h14"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M10 4H5v15h15v-5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m11 5-7 7 7 7M4 12h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  unread:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  comments: '<path d="M4 4h16v12H9l-5 4z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  up: '<path d="m6 14 6-7 6 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  edit: '<path d="m4 16 12-12 4 4-12 12H4zM13 7l4 4"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5M12 17v1"/>',
  layout:
    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16"/>',
};
export function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.6");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths[name] ?? paths.feed;
  return svg;
}
