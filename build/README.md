# Feeds build tooling

Runtime output is prebuilt in ../panel/ and ../worker/. This folder holds reproducible source and development tooling and is excluded from the runtime ZIP.

| Path                | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| src/shared/model.ts | Shared feed/story model                                        |
| src/providers/      | RSS/Atom, Hacker News and Reddit                               |
| src/worker/         | Storage, fetching, images and agent launching                  |
| src/panel/          | UI, styles and glyphs                                          |
| assets/             | Geist/OFL and committed captures; SVG exports are generated    |
| licenses/           | Upstream license omitted from an npm package                   |
| scripts/            | Build, preview, browser checks, notices, artwork and packaging |

## Develop

From the plugin root with Node.js 22+:

```sh
npm ci --prefix build
npm run typecheck
npm test
npm run preview
```

The build bundles a Node 22 ESM worker and browser IIFE panel, copies HTML/CSS/font assets and creates test bundles in .orca/tests/. End users never run npm. The preview has a separate library, sample data and a mock workspace; it refuses agent launches.

## Release tools

Run these scripts from the plugin root with npm run:

- **release:shots** runs general, starter and image browser checks, preserves the four artwork input captures and composes two gallery sheets.
- **release:shots -- --from-captures** recomposes committed captures without a browser.
- **release:art** generates the original icon, cover and social artwork with pinned Sharp.
- **release:notices** rebuilds production dependency notices from the lockfile/license texts and Geist OFL.
- **release:check** checks files, versions, licenses, symlinks and listing-image budgets.
- **package** optionally stages/checks a clean runtime folder and generates a local ZIP, checksum and measurements. GitHub releases use the repository tag without archive attachments.

See [RELEASE.md](../RELEASE.md). Output is in ../../news-feeds-release/. Dependencies and .orca/ stay local, ignored by Git. Do not include them in source publication or distribution.
