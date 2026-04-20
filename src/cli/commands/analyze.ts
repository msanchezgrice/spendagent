import path from "node:path";
import { loadConfig } from "../../config/loadConfig.js";
import { loadPricing } from "../../pricing/loadPricing.js";
import { analyze } from "../../analysis/analyze.js";
import { readJson, writeJson, exists } from "../../utils/filesystem.js";
import { log } from "../../utils/logger.js";
import type {
  AnalysisResult,
  NormalizedUsage,
  ScanResult,
} from "../../types.js";

export interface AnalyzeOptions {
  repo: string;
  scanPath?: string;
  usagePath?: string;
  pricingPath?: string;
  out?: string;
  monthlyRequests?: number;
  avgInputTokens?: number;
  avgOutputTokens?: number;
}

export function runAnalyze(opts: AnalyzeOptions): AnalysisResult {
  const root = path.resolve(opts.repo);
  const config = loadConfig(root);
  const scanPath =
    opts.scanPath ?? path.join(root, ".agentspend", "scan.json");
  if (!exists(scanPath)) {
    throw new Error(
      `No scan.json at ${scanPath}. Run \`agentspend scan --repo ${opts.repo}\` first.`,
    );
  }
  const scan = readJson<ScanResult>(scanPath);
  const pricingPathResolved =
    opts.pricingPath ?? path.join(root, ".agentspend", "pricing.models.json");
  const pricing = loadPricing(root, pricingPathResolved);
  const pricingSource = exists(pricingPathResolved)
    ? pricingPathResolved
    : "(built-in seed catalog)";

  let usage: NormalizedUsage | undefined;
  if (opts.usagePath) {
    if (!exists(opts.usagePath)) {
      throw new Error(`Usage file not found: ${opts.usagePath}`);
    }
    usage = readJson<NormalizedUsage>(opts.usagePath);
  }

  log.step("Analyzing scan + usage data");
  const result = analyze({
    scan,
    usage,
    pricing,
    config,
    pricingSource,
    monthlyRequests: opts.monthlyRequests,
    avgInputTokens: opts.avgInputTokens,
    avgOutputTokens: opts.avgOutputTokens,
  });

  const outPath =
    opts.out ?? path.join(root, ".agentspend", "analysis.json");
  writeJson(outPath, result);

  log.ok(
    `analysis complete — ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}`,
  );
  log.dim(`  wrote ${outPath}`);
  return result;
}
