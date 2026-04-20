import path from "node:path";
import { readJson, writeText, writeJson, exists } from "../../utils/filesystem.js";
import { renderMarkdownReport } from "../../report/markdown.js";
import { log } from "../../utils/logger.js";
import type { AnalysisResult } from "../../types.js";

export interface ReportOptions {
  repo: string;
  analysisPath?: string;
  mdOut?: string;
  jsonOut?: string;
}

export function runReport(opts: ReportOptions): AnalysisResult {
  const root = path.resolve(opts.repo);
  const analysisPath =
    opts.analysisPath ?? path.join(root, ".agentspend", "analysis.json");
  if (!exists(analysisPath)) {
    throw new Error(
      `No analysis.json at ${analysisPath}. Run \`agentspend analyze\` first.`,
    );
  }
  const analysis = readJson<AnalysisResult>(analysisPath);

  const mdOut =
    opts.mdOut ?? path.join(root, ".agentspend", "AGENT_SPEND_REPORT.md");
  const jsonOut =
    opts.jsonOut ?? path.join(root, ".agentspend", "report.json");

  const md = renderMarkdownReport(analysis);
  writeText(mdOut, md);
  writeJson(jsonOut, analysis);

  log.ok(`report written`);
  log.dim(`  ${mdOut}`);
  log.dim(`  ${jsonOut}`);
  return analysis;
}
