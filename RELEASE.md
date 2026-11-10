# Release preparation

Prepared version: **0.2.0**, future tag **v0.2.0**. Proposed repository: **faisalmuhammad/orca-news-feeds**. This preparation does not create or publish a repository, push commits, tag or submit a catalog entry.

## What to upload

Use the contents of **news-feeds/** as the GitHub repository root. Include orca-plugin.json, compiled panel/ and worker/ files, assets/ with the icon/cover/two screenshots and provenance, build/ with source/scripts/lockfile/licenses/font inputs and official SDK declarations, tests/, package.json, tsconfig.json, all root documentation and licenses, .github/ workflows and scripts, .gitignore and .gitattributes. Keep **build/assets/captures/**: the artwork generators read its four sample captures. Keep Geist and its OFL in panel/ and build/assets/.

The .gitignore follows the sibling plugins: dependencies, .orca/, build caches/browser reports, package directories, archives, logs, local environment files and OS/editor temporary files are ignored. Environment example templates remain allowed. Generated build/assets/artwork/ SVG exports, source maps and social images are also ignored. Commit final listing PNGs and assets/icon.svg. Artwork is reproducible from scripts and committed captures.

**The repository is the distribution.** Orca installs the compiled files directly from its release tag. Create a GitHub release pointing to that tag, with written release notes and no ZIP/checksum attachments. Keep the sibling news-feeds-release/ folder outside Git. Its social.png can be uploaded under **Settings → General → Social preview**.

Git ignores only untracked files. If an excluded file was previously tracked, remove that specific path from the index with git rm --cached.

## Verify

Use Node.js 22+ and Orca desktop 1.4.253+. From the plugin folder:

```sh
npm ci --prefix build
npm run typecheck
npm test
orca plugin test . --json
npm audit --prefix build
npm run release:notices
npm run release:check
orca plugin validate . --json
orca plugin check . --json
```

To refresh browser captures, run npm run preview, then in another terminal with Orca open:

```sh
npm run release:shots
npm run release:art
npm run release:check
```

Set ORCA_CLI_COMMAND to the installed executable if needed. Browser checks use the separate .orca/preview/ sample library, restore temporary subscriptions and never launch real agents. The browser-check script targets port 4329.

Re-render the committed captures without a browser:

```sh
npm run release:shots -- --from-captures
npm run release:art
```

Sharp is pinned in the lockfile. Four raw capture inputs are committed under build/assets/captures/; editable SVG exports are generated locally under ignored build/assets/artwork/. The slate-blue cover and two gallery sheets are **1600 × 1000**, icon **512 × 512**, social image **1200 × 750**. The agent sheet uses cool gray. [Screenshot provenance](assets/SCREENSHOTS.md).

The release check rejects symlinks, unexpected binaries, stale notices and version mismatches and checks Orca’s file/size and listing-image limits. Geist is explicitly allowed with its WOFF2 magic bytes and full OFL. Static checks do not render the panel; native startup and actual question delivery were separately verified on macOS/Orca 1.4.253. [Compatibility](COMPATIBILITY.md).

Privacy checks reject local user directory paths, credential tokens, private keys, live agent identifiers and embedded image metadata. Release artwork uses sample data; local diagnostic captures are not included.

## Automated checks and release

[.github/workflows/release.yml](.github/workflows/release.yml) runs on pull requests targeting main, pushes to main, version-tag pushes and manual workflow runs. It uses Node.js 22 and the official Orca 1.4.255 CLI on a GitHub-hosted macOS runner. The installer verifies pinned SHA-256 digests for both Intel and Apple Silicon archives and keeps Orca outside the plugin checkout.

The workflow installs the lockfile, typechecks against the committed official Orca SDK declarations, builds, runs logic and injected-host tests, audits dependencies, checks release files/artwork/licenses/privacy, and runs Orca's offline manifest validator. It rejects stale committed runtime files. These checks run without opening Orca or starting real agent sessions. Native browser and live agent checks remain local checks.

Before each release, update orca-plugin.json, package.json, build/package.json, both root version fields in build/package-lock.json, and the matching CHANGELOG.md entry. Rebuild and commit the compiled panel/ and worker/ files. The tag must be v followed by the manifest version, and its commit must be merged into main. This workflow accepts stable major.minor.patch releases.

Merge the localization changes and workflow into main before publishing 0.2.0. Then run from an existing repository clone:

```sh
git switch main
git pull --ff-only origin main
git tag -a v0.2.0 -m "Feeds 0.2.0"
git push origin v0.2.0
```

Pushing the tag runs all checks again, then creates **Feeds for Orca 0.2.0** with notes extracted from the 0.2.0 changelog section. There is no separate gh release command and no ZIP/checksum attachment. Existing releases are left unchanged on reruns. A manual Actions run performs checks only. The release job alone gets contents:write; it uses the built-in GITHUB_TOKEN and requires no personal token or other secrets. Keep GitHub Actions enabled for the repository.

Monitor the run:

```sh
gh run list --repo faisalmuhammad/orca-news-feeds --workflow release.yml
gh run watch --repo faisalmuhammad/orca-news-feeds
```

If a check fails, fix and commit the issue, merge it into main, and use a new version/tag for the release. Do not move a published tag.

After publication, install using:

```text
https://github.com/faisalmuhammad/orca-news-feeds#v0.2.0
```

Verify the Orca listing. Generate a catalog entry, if needed, from the actual published commit:

```sh
orca plugin release-entry . --json
```

## Optional local package tooling

npm run package remains available for local archive inspection. Its installation folder, deterministic ZIP, SHA256SUMS and artifact.json stay under news-feeds-release/ and are not uploaded to Git or attached to the GitHub release.
