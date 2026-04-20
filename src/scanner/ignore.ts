import path from "node:path";
import ignore, { type Ignore } from "ignore";
import { exists, readText } from "../utils/filesystem.js";

/**
 * Build an `ignore` instance that respects the repo's `.gitignore` plus user
 * excludes from the config.
 */
export function buildIgnore(repoRoot: string, extraExcludes: string[] = []): Ignore {
  const ig = ignore();
  const gitignorePath = path.join(repoRoot, ".gitignore");
  if (exists(gitignorePath)) {
    try {
      ig.add(readText(gitignorePath));
    } catch {
      // ignore — best-effort
    }
  }
  ig.add(extraExcludes);
  // Always ignore our own output directory
  ig.add(".agentspend/");
  return ig;
}
