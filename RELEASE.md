# Release preparation

Prepared version: **0.2.0**, future tag **v0.2.0**. Proposed repository: **faisalmuhammad/orca-news-feeds**. This preparation does not create or publish a repository, push commits, tag or submit a catalog entry.

## What to upload

Use the contents of **news-feeds/** as the GitHub repository root. Include orca-plugin.json, compiled panel/ and worker/ files, assets/ with the icon/cover/two screenshots and provenance, build/ with source/scripts/lockfile/licenses/font inputs, tests/, package.json, tsconfig.json, all root documentation and licenses, .gitignore and .gitattributes. Keep **build/assets/captures/**: the artwork generators read its four sample captures. Keep Geist and its OFL in panel/ and build/assets/.

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

## Publish when ready

For a new public repository, sign in to the account owning faisalmuhammad/orca-news-feeds and run from this folder:

```sh
# Run from the directory containing orca-plugin.json.
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git --hostname github.com
npm run release:check
/Applications/Orca.app/Contents/Resources/bin/orca plugin validate . --json
git init -b main
git add .
git status --short
```

After reviewing the staged files:

```sh
git commit -m "Release Feeds 0.2.0"
gh repo create faisalmuhammad/orca-news-feeds --public --source=. --remote=origin --push
gh repo edit faisalmuhammad/orca-news-feeds --add-topic orca-plugin
git tag -a v0.2.0 -m "Feeds 0.2.0"
git push origin v0.2.0
gh release create v0.2.0 \
  --repo faisalmuhammad/orca-news-feeds \
  --verify-tag \
  --title "Feeds for Orca 0.2.0" \
  --notes "RSS, Hacker News and Reddit in Orca's sidebar. Read stories inline, save them for later, and ask an agent in a fresh conversation. Includes opt-in developer sources, feed-supplied images and refreshed artwork."
```

These commands publish when you run them; they have not been executed during preparation. If the repository already exists, use its existing clone/remote and push the commit instead of creating another repository. Leave publisher omitted so Orca derives identity from the repository owner.

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
