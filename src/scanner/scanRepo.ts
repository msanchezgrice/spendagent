import path from "node:path";
import fg from "fast-glob";
import { buildIgnore } from "./ignore.js";
import { readText, detectLanguage } from "../utils/filesystem.js";
import { log } from "../utils/logger.js";
import type { AgentSpendConfig, Callsite, ScanResult, AgentConfigFinding } from "../types.js";
import { detectOpenAI } from "./detectors/openai.js";
import { detectAnthropic } from "./detectors/anthropic.js";
import { detectGemini } from "./detectors/gemini.js";
import { detectLiteLLM } from "./detectors/litellm.js";
import { detectVercelAi } from "./detectors/vercelAi.js";
import { detectLangChain } from "./detectors/langchain.js";
import { detectLlamaIndex } from "./detectors/llamaIndex.js";
import { detectVectorDb } from "./detectors/vectorDbs.js";
import { detectAgentConfig } from "./detectors/agentConfigs.js";
import { applyHeuristics } from "./heuristics/index.js";

const ALL_DETECTORS = [
  detectOpenAI,
  detectAnthropic,
  detectGemini,
  detectLiteLLM,
  detectVercelAi,
  detectLangChain,
  detectLlamaIndex,
  detectVectorDb,
];

export async function scanRepo(
  repoRoot: string,
  config: AgentSpendConfig,
): Promise<ScanResult> {
  const resolvedRoot = path.resolve(repoRoot);

  const files = await fg(config.repo.include, {
    cwd: resolvedRoot,
    dot: true,
    onlyFiles: true,
    ignore: config.repo.exclude,
    followSymbolicLinks: false,
    caseSensitiveMatch: false,
  });

  const ig = buildIgnore(resolvedRoot, config.repo.exclude);
  const filtered = files.filter((rel) => {
    const normalized = rel.replace(/\\/g, "/");
    try {
      return !ig.ignores(normalized);
    } catch {
      return true;
    }
  });

  const callsites: Callsite[] = [];
  const agentConfigs: AgentConfigFinding[] = [];

  for (const rel of filtered) {
    const abs = path.join(resolvedRoot, rel);
    let source: string;
    try {
      source = readText(abs);
    } catch {
      continue;
    }

    // Skip obviously huge files (avoid minified bundles etc.)
    if (source.length > 2_000_000) {
      log.debug(`skipping ${rel} (>2MB)`);
      continue;
    }

    const language = detectLanguage(rel);

    // Code detectors
    if (language !== "unknown") {
      for (const detector of ALL_DETECTORS) {
        try {
          const found = detector({
            file: rel,
            absPath: abs,
            source,
            language,
          });
          for (const cs of found) callsites.push(cs);
        } catch (err) {
          log.debug(`detector error in ${rel}: ${String(err)}`);
        }
      }
    }

    // Agent config inspection
    try {
      const ac = detectAgentConfig({ file: rel, source });
      if (ac) agentConfigs.push(ac);
    } catch (err) {
      log.debug(`agent config error in ${rel}: ${String(err)}`);
    }
  }

  // Apply risk-flag heuristics (loops, cache, retry, task hint, etc.)
  applyHeuristics(callsites, (file) => {
    try {
      return readText(path.join(resolvedRoot, file));
    } catch {
      return "";
    }
  });

  return {
    repo: resolvedRoot,
    generated_at: new Date().toISOString(),
    files_scanned: filtered.length,
    callsites,
    agent_configs: agentConfigs,
  };
}
