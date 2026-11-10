export type Kind = "rss" | "hn" | "reddit";
export type Category = "top" | "new" | "best" | "ask" | "show";
export type SourceDraft = {
  kind: Kind;
  url?: string;
  category?: Category;
  subreddit?: string;
  sort?: "hot" | "new" | "top";
};
export type Source = SourceDraft & {
  id: string;
  label: string;
  identity: string;
  enabled: boolean;
  version: number;
  createdAt: number;
};
export type Item = {
  id: string;
  kind: Kind;
  title: string;
  url: string | null;
  discussionUrl: string | null;
  author: string;
  publishedAt: number | null;
  firstSeenAt: number;
  summary: string;
  imageUrl?: string;
  score?: number;
  comments?: number;
  rank: number;
  sourceIds: string[];
  sourceLabel: string;
};
export type Cache = {
  items: Item[];
  checkedAt: number;
  successAt: number;
  etag?: string;
  modified?: string;
  error?: string;
  failures: number;
  retryAt: number;
  loaded: number;
  hasMore: boolean;
  notice?: string;
};
export type Preferences = {
  refreshMinutes: 0 | 5 | 10 | 30 | 60;
  compact: boolean;
  language: "en" | "zh-CN";
};
export type AskRecord = {
  fingerprint: string;
  state: "pending" | "started" | "unknown" | "refused";
  terminalId?: string;
  receipt?: NewsLaunchReceipt;
  operationId?: string;
  prompt?: string;
  at: number;
};
export type NewsLaunchReceipt = {
  kind: "chat" | "terminal";
  handle: string;
  sessionId?: string;
  operationId?: string;
  delivery: "journaled" | "handed-to-terminal";
  detail: string;
};
export type Store = {
  version: 1;
  revision: number;
  sources: Source[];
  caches: Record<string, Cache>;
  read: Record<string, number>;
  saved: Record<string, Item>;
  preferences: Preferences;
  asks: Record<string, AskRecord>;
};
export type FeedQuery = {
  filter?: "all" | Kind | "saved";
  sourceId?: string;
  query?: string;
  unread?: boolean;
  order?: "latest" | "source";
  offset?: number;
  limit?: number;
};
export type ViewItem = Item & { read: boolean; saved: boolean };
export type ImagePart = {
  chunk: string | null;
  nextOffset: number | null;
  key: string;
};
export const usefulExcerpt = (summary: string): string =>
  summary.trim().toLowerCase() === "comments" ? "" : summary;
export type SourceView = Source & {
  cache: Omit<Cache, "items">;
  count: number;
  unread: number;
  refreshing: boolean;
};
export type Snapshot = {
  revision: number;
  sources: SourceView[];
  items: ViewItem[];
  total: number;
  unread: number;
  saved: number;
  hasMore: boolean;
  nextOffset: number;
  preferences: Preferences;
  refreshedAt: number;
  busy: boolean;
  notice?: string;
};
export type Preview = {
  token: string;
  source: Source;
  items: Item[];
  count: number;
  notice?: string;
};
export type FetchResult = {
  items: Item[];
  title: string;
  etag?: string;
  modified?: string;
  notModified?: boolean;
  hasMore: boolean;
  notice?: string;
};
export const emptyCache = (): Cache => ({
  items: [],
  checkedAt: 0,
  successAt: 0,
  failures: 0,
  retryAt: 0,
  loaded: 0,
  hasMore: false,
});
export const emptyStore = (): Store => ({
  version: 1,
  revision: 0,
  sources: [],
  caches: {},
  read: {},
  saved: {},
  asks: {},
  preferences: { refreshMinutes: 0, compact: false, language: "en" },
});
export class FeedError extends Error {
  constructor(
    message: string,
    public code = "action_failed",
    public retryAfterMs = 0,
  ) {
    super(message);
    this.name = "FeedError";
  }
}
