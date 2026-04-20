import path from "node:path";
import { loadConfig } from "../../config/loadConfig.js";
import { scanRepo } from "../../scanner/scanRepo.js";
import { writeJson } from "../../utils/filesystem.js";
import { log } from "../../utils/logger.js";
import type { ScanResult } from "../../types.js";

export interface ScanOptions {
  repo: string;
  out?: string;
  format?: "json";
}

export async function runScan(opts: ScanOptions): Promise<ScanResult> {
  const root = path.resolve(opts.repo);
  const config = loadConfig(root);
  log.step(`Scanning ${root}`);
  const result = await scanRepo(root, config);
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(root, ".agentspend", "scan.json");
  writeJson(outPath, result);
  const llm = result.callsites.filter((c) =>
    ["chat", "responses", "completion"].includes(c.operation),
  ).length;
  const emb = result.callsites.filter((c) => c.operation === "embedding").length;
  const vdb = result.callsites.filter((c) => c.operation === "vector_db").length;
  log.ok(
    `scanned ${result.files_scanned} files — ${llm} LLM, ${emb} embedding, ${vdb} vector DB, ${result.agent_configs.length} agent/config files`,
  );
  log.dim(`  wrote ${path.relative(root, outPath) || outPath}`);
  return result;
}
