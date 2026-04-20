import path from "node:path";
import { importGenericCsv } from "../../usage/importGenericCsv.js";
import { normalizeUsage } from "../../usage/normalizeUsage.js";
import { writeJson } from "../../utils/filesystem.js";
import { log } from "../../utils/logger.js";
import type { NormalizedUsage } from "../../types.js";

export interface ImportUsageOptions {
  input: string;
  out?: string;
  repo: string;
  format?: "generic-csv" | "litellm" | "langfuse" | "helicone";
}

export function runImportUsage(opts: ImportUsageOptions): NormalizedUsage {
  const fmt = opts.format ?? detectFormat(opts.input);
  log.step(`Importing usage from ${opts.input} (${fmt})`);

  let records;
  switch (fmt) {
    case "generic-csv":
      records = importGenericCsv(opts.input);
      break;
    default:
      log.warn(
        `format "${fmt}" not implemented yet — falling back to generic-csv`,
      );
      records = importGenericCsv(opts.input);
  }

  const normalized = normalizeUsage(records);
  const outPath =
    opts.out ??
    path.join(
      path.resolve(opts.repo),
      ".agentspend",
      "usage.normalized.json",
    );
  writeJson(outPath, normalized);
  log.ok(
    `imported ${normalized.records.length} usage records (spanning ${normalized.days_covered} days)`,
  );
  log.dim(`  wrote ${outPath}`);
  return normalized;
}

function detectFormat(filePath: string): "generic-csv" {
  // Only generic-csv is implemented for v1. Keep extensible.
  if (filePath.toLowerCase().endsWith(".csv")) return "generic-csv";
  return "generic-csv";
}
