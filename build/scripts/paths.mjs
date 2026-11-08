import { fileURLToPath } from "node:url";
import path from "node:path";
export const PLUGIN = fileURLToPath(new URL("../../", import.meta.url));
export const RELEASE = path.resolve(PLUGIN, "../news-feeds-release");
export const at = (file) => path.join(PLUGIN, file);
