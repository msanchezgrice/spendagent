import path from "node:path";
import YAML from "yaml";
import { readText, exists } from "../utils/filesystem.js";
import type { AgentSpendConfig } from "../types.js";
import { DEFAULT_CONFIG } from "./defaultConfig.js";

export function loadConfig(repoRoot: string): AgentSpendConfig {
  const cfgPath = path.join(repoRoot, ".agentspend", "config.yml");
  if (!exists(cfgPath)) return DEFAULT_CONFIG;
  try {
    const raw = readText(cfgPath);
    const parsed = YAML.parse(raw) as Partial<AgentSpendConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      repo: {
        ...DEFAULT_CONFIG.repo,
        ...(parsed.repo ?? {}),
      },
      analysis: {
        ...DEFAULT_CONFIG.analysis,
        ...(parsed.analysis ?? {}),
      },
      recommendations: {
        ...DEFAULT_CONFIG.recommendations,
        ...(parsed.recommendations ?? {}),
      },
      privacy: {
        ...DEFAULT_CONFIG.privacy,
        ...(parsed.privacy ?? {}),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
