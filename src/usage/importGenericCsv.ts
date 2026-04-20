import { parse } from "csv-parse/sync";
import { readText } from "../utils/filesystem.js";
import type { UsageRecord } from "../types.js";
import { shortHash } from "../utils/hashing.js";

/**
 * Required columns: provider, model, input_tokens, output_tokens.
 * Optional: timestamp, route, feature, cached_input_tokens, requests, cost_usd.
 */
export function importGenericCsv(filePath: string): UsageRecord[] {
  const raw = readText(filePath);
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const records: UsageRecord[] = [];

  for (const row of rows) {
    const provider = (row.provider ?? row.Provider ?? "").trim();
    const model = (row.model ?? row.Model ?? "").trim();
    const input = num(row.input_tokens ?? row.prompt_tokens);
    const output = num(row.output_tokens ?? row.completion_tokens);

    if (!provider || !model) continue;
    if (Number.isNaN(input) || Number.isNaN(output)) continue;

    const rec: UsageRecord = {
      id: shortHash(
        `${provider}|${model}|${row.timestamp ?? ""}|${row.route ?? ""}|${row.feature ?? ""}|${input}|${output}`,
      ),
      provider,
      model,
      input_tokens: input,
      output_tokens: output,
    };

    if (row.timestamp) rec.timestamp = row.timestamp;
    if (row.route) rec.route = row.route;
    if (row.feature) rec.feature = row.feature;
    const cached = num(row.cached_input_tokens);
    if (!Number.isNaN(cached)) rec.cached_input_tokens = cached;
    const reqs = num(row.requests);
    if (!Number.isNaN(reqs)) rec.requests = reqs;
    const cost = num(row.cost_usd);
    if (!Number.isNaN(cost)) rec.cost_usd = cost;

    records.push(rec);
  }

  return records;
}

function num(v: string | undefined): number {
  if (v === undefined || v === null || v === "") return NaN;
  const cleaned = String(v).replace(/[$,]/g, "").trim();
  if (cleaned === "") return NaN;
  const n = Number(cleaned);
  return n;
}
