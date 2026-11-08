# Artwork and screenshot provenance

Original editable SVG artwork follows the sibling plugins’ branded covers, signal/orbit motifs and large typography. Deep slate blue and cool gray backgrounds pair with Feeds’ copper RSS mark. The artwork uses no stock images or third-party brand marks and is MIT licensed.

| Asset                  | Dimensions  | Source                                                          |
| ---------------------- | ----------- | --------------------------------------------------------------- |
| icon.png / icon.svg    | 512 × 512   | Original RSS mark and copper gradient                           |
| cover.png              | 1600 × 1000 | Slate-blue signal artwork and actual dark sample-list capture   |
| screenshot-reading.png | 1600 × 1000 | Dark list and expanded RSS row                                  |
| screenshot-agent.png   | 1600 × 1000 | Actual inline question form with a mock workspace, on cool gray |
| Release social.png     | 1200 × 750  | Resized cover                                                   |

The two-image gallery focuses on reading and agent questions. Captures use Orca 1.4.253’s embedded browser and the actual compiled Feeds panel against build/scripts/preview.mjs. Headlines/provider replies come from labeled fixtures in build/scripts/demo-data.mjs.

The agent image shows the actual form with a preview workspace. No real conversation, response or user library appears in public artwork.

Raw captures are re-encoded before publication to strip EXIF, XMP and IPTC metadata. Local diagnostic captures remain outside the plugin folder; they are not release artwork inputs.

Sheets add original backgrounds, captions and borders. Panel content is preserved and scaled proportionally. The four raw capture inputs and their composition map, capture-index.json, are committed under build/assets/captures/. Editable vectors are regenerated locally under build/assets/artwork/ and ignored by Git. Both folders are excluded from the runtime ZIP; final listing PNGs and assets/icon.svg are committed.

## Reproduce

Install build dependencies, run npm run preview, then npm run release:shots and npm run release:art with Orca open. ORCA_CLI_COMMAND can select the installed CLI. Browser verification still covers source suggestions and image loading; those checks are not part of the public gallery.

For artwork-only regeneration from committed captures:

```sh
npm run release:shots -- --from-captures
npm run release:art
```

This needs Node.js 22+ and pinned Sharp, but no browser or live providers. SVG text uses Helvetica Neue / Helvetica / Arial and rendering may vary by platform. The actual UI captures use the bundled Geist font under its [OFL](../panel/Geist-OFL.txt).
