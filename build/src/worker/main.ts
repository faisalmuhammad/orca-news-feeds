import type { OrcaWorkerApi } from "orca/worker";
import { FeedService, type Storage } from "./core";
import type { FeedQuery, SourceDraft } from "../shared/model";
import {
  createOrcaLauncher,
  NewsLaunchError,
  type NewsLauncher,
} from "./launch";
export { createOrcaLauncher } from "./launch";
let service: FeedService | undefined;
export function createActivate(launch: NewsLauncher = createOrcaLauncher()) {
  return function activate(orca: OrcaWorkerApi) {
    service = new FeedService({
      storage: orca.storage as Storage,
      changed: () => orca.panels.post("feeds.changed", { changed: true }),
      workspaces: async () => {
        const result = await orca.host.call("workspace.list");
        return result.workspaces;
      },
      launch: (workspaceId, agent, prompt, operationId) => {
        if (!orca.grantedCapabilities.includes("agent:launch"))
          throw new NewsLaunchError(
            "Agent launching has not been approved for Feeds.",
            undefined,
            true,
          );
        return launch(workspaceId, agent, prompt, operationId);
      },
    });
    const feeds = service;
    const handlers: Record<
      string,
      (input: any, signal: AbortSignal) => Promise<unknown>
    > = {
      "feeds.snapshot": (input) => feeds.snapshot((input ?? {}) as FeedQuery),
      "feeds.refresh": (input) => feeds.refresh(input ?? {}),
      "feeds.more": (input) => feeds.more(input),
      "sources.preview": (input, signal) =>
        feeds.preview(input as SourceDraft, signal),
      "sources.add": (input) => feeds.add(input),
      "sources.update": (input) => feeds.update(input),
      "sources.remove": (input) => feeds.remove(input),
      "items.setRead": (input) => feeds.setRead(input),
      "items.markRead": (input) => feeds.markRead(input ?? {}),
      "items.setSaved": (input) => feeds.setSaved(input),
      "items.image": (input) => feeds.image(input),
      "preferences.update": (input) => feeds.preferences(input ?? {}),
      "news.ask": (input) => feeds.ask(input),
      "news.workspaces": async () => {
        if (!orca.host.has("workspace.list"))
          throw new Error(
            "This Orca version cannot launch agents from plugins.",
          );
        const [list, context] = await Promise.all([
          orca.host.call("workspace.list"),
          orca.host.call("workspace.readContext"),
        ]);
        const candidates = list.workspaces.filter(
          (w) =>
            w.name === context?.displayName &&
            (!context?.branch || w.branch === context.branch),
        );
        return {
          workspaces: list.workspaces,
          suggestedId:
            !list.truncated && candidates.length === 1
              ? candidates[0].id
              : null,
          truncated: list.truncated,
        };
      },
    };
    for (const [name, handler] of Object.entries(handlers))
      orca.panels.handle(name, async (input, { signal }) =>
        JSON.parse(JSON.stringify(await handler(input, signal))),
      );
  };
}
export default createActivate();
export async function deactivate() {
  await service?.dispose();
  service = undefined;
}
