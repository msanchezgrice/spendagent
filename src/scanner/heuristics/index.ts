import type { Callsite } from "../../types.js";
import { detectLoop } from "./loopDetection.js";
import { detectCache } from "./cacheDetection.js";
import { detectRetry } from "./retryDetection.js";
import { classifyTask } from "./taskClassifier.js";
import { detectMaxTokens, detectLargeContext } from "./promptSize.js";
import { isPremiumModel } from "./premiumModel.js";

/**
 * Apply all heuristic risk flags + task hints to callsites in place.
 * `readFile` returns the full text of a repo-relative file, or "" if missing.
 */
export function applyHeuristics(
  callsites: Callsite[],
  readFile: (relPath: string) => string,
): void {
  // Group by file to avoid re-reading
  const byFile = new Map<string, string>();
  for (const cs of callsites) {
    if (!byFile.has(cs.file)) byFile.set(cs.file, readFile(cs.file));
  }

  for (const cs of callsites) {
    const src = byFile.get(cs.file) ?? "";

    if (detectLoop(src, cs)) cs.risk_flags.push("inside_loop");
    if (!detectCache(src, cs)) cs.risk_flags.push("no_cache_detected");
    if (detectRetry(src, cs)) cs.risk_flags.push("retry_without_limit");

    const hint = classifyTask(src, cs);
    if (hint) cs.task_hint = hint;

    if (cs.operation === "chat" || cs.operation === "responses" ||
        cs.operation === "completion") {
      if (!detectMaxTokens(src, cs)) cs.risk_flags.push("no_max_tokens");
    }

    if (detectLargeContext(src, cs)) cs.risk_flags.push("large_prompt_context");

    if (cs.model && isPremiumModel(cs.model)) cs.risk_flags.push("premium_model");

    if (cs.operation === "embedding" && cs.risk_flags.includes("inside_loop")) {
      cs.risk_flags.push("embedding_recompute_risk");
    }

    // Telemetry tags
    const hasMetadata = /\bmetadata\s*[:=]|\btags\s*[:=]|\buser\s*[:=]|\bfeature\s*[:=]/.test(
      src.slice(
        Math.max(0, indexFromLine(src, cs.line) - 400),
        indexFromLine(src, cs.line) + 400,
      ),
    );
    if (!hasMetadata) cs.risk_flags.push("missing_usage_tags");

    // Upgrade confidence: if we have a model AND a task hint AND a premium flag,
    // we're fairly confident this is worth investigating.
    if (cs.model && cs.task_hint && cs.risk_flags.length > 0) {
      cs.confidence = "high";
    } else if (cs.model || cs.task_hint) {
      cs.confidence = "medium";
    }
  }
}

function indexFromLine(source: string, line: number): number {
  let i = 0;
  let current = 1;
  while (i < source.length && current < line) {
    if (source.charCodeAt(i) === 10) current++;
    i++;
  }
  return i;
}
