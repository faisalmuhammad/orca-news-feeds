# Compatibility

Feeds 0.1.0 requires **Orca desktop 1.4.253+** and runs as a **trusted worker** with an HTML sidebar panel. JavaScript, CSS, runtime dependencies and Geist are packaged locally. End users do not need Node/npm or a feed account; developers need Node.js 22+.

## Host integration

- Open Feeds using the globe icon after approving its declared access.
- Fetches run in the Node worker because the isolated HTML frame cannot fetch arbitrary websites directly.
- Agent launching uses Orca’s bundled CLI, inert argument arrays and an exact workspace selector. It starts a fresh session, honors Chat/CLI preference and focuses the tab.
- Success requires confirmed question delivery to the chat or terminal agent. Operation IDs support replay without duplicate conversations.
- Floating-window creation is unavailable through the current public API/CLI.
- External links use the host’s consent flow.

Orca 1.4.253 does not forward its custom app-font setting to HTML plugin frames. Feeds matches Orca’s default Geist font locally and accepts --orca-font-family or --orca-font-sans when provided. Headings and controls inherit the panel font.

## Sources and limits

| Provider    | Support                                                        | Practical limits                                                                                 |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| RSS / Atom  | RSS 2.0, RSS 1.0/RDF, Atom, excerpts and common image metadata | Public feeds; XML DTD/entity declarations rejected; publisher availability varies                |
| Hacker News | Top, New, Best, Ask, Show; points and bounded pagination       | No API images; full discussion on the website                                                    |
| Reddit      | Public Atom feeds: Hot, New, Top today                         | Restrictions/rate limits; no scores, comment counts or nested threads in the panel               |
| Images      | Feed-supplied PNG, JPEG, WebP and GIF                          | 2 MiB download bound; lazy loading, temporary memory cache; no scraping or persisted image bytes |

Refresh is manual unless enabled. Scheduled refresh requires a visible, focused panel; requests in progress can finish after focus moves away. Failures retain the last successful cache. Saved snapshots survive cache eviction and source removal.

## Verification

Validated on **macOS with Orca 1.4.253**:

- 36 provider/storage/image/launch logic tests; 38 including injected-host coverage.
- Browser checks at 240/320/440 px in both themes: accordion expansion, keyboard navigation, search, read/save actions and inline agent forms.
- Six RSS starters, six subreddit suggestions, listing selection, duplicate detection and font loading.
- Thumbnail, expanded and compact image states, including bounded multipart replies.
- Native sidebar startup, real RSS/HN/Reddit fetching and a real fresh Codex chat receiving its question.

Automated tests use launch mocks and never create real agent sessions. Gallery images show the actual sample browser preview; no live agent conversation or user library appears.

Windows/Linux and other Orca versions have not been separately verified. Future host releases may extend font and floating-window support.
