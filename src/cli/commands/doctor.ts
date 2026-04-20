import path from "node:path";
import chalk from "chalk";
import { runScan } from "./scan.js";
import { runImportUsage } from "./importUsage.js";
import { runAnalyze } from "./analyze.js";
import { runReport } from "./report.js";
import { log } from "../../utils/logger.js";
import { exists } from "../../utils/filesystem.js";
import type { AnalysisResult } from "../../types.js";

export interface DoctorOptions {
  repo: string;
  usage?: string;
  monthlyRequests?: number;
  avgInputTokens?: number;
  avgOutputTokens?: number;
}

export async function runDoctor(opts: DoctorOptions): Promise<AnalysisResult> {
  const root = path.resolve(opts.repo);
  log.bold(`AgentSpend`);
  log.raw("");

  const scan = await runScan({ repo: root });

  let usagePath: string | undefined;
  if (opts.usage) {
    if (!exists(opts.usage)) throw new Error(`Usage file not found: ${opts.usage}`);
    const normalized = runImportUsage({ repo: root, input: opts.usage });
    usagePath = path.join(root, ".agentspend", "usage.normalized.json");
    void normalized;
  }

  const analysis = runAnalyze({
    repo: root,
    usagePath,
    monthlyRequests: opts.monthlyRequests,
    avgInputTokens: opts.avgInputTokens,
    avgOutputTokens: opts.avgOutputTokens,
  });
  runReport({ repo: root });

  /* ---------- Terminal summary ---------- */
  log.raw("");
  log.raw(chalk.bold("Summary"));
  const s = analysis.summary;
  log.raw(
    `  ${s.llm_callsites} LLM · ${s.embedding_callsites} embedding · ${s.vector_db_callsites} vector DB · ${s.agent_config_files} agent configs`,
  );
  if (s.estimated_current_monthly_cost_usd !== undefined) {
    log.raw(
      `  Estimated current monthly spend: ${chalk.bold(fmtUsd(s.estimated_current_monthly_cost_usd))}`,
    );
    if (
      s.estimated_potential_monthly_savings_low_usd !== undefined &&
      s.estimated_potential_monthly_savings_high_usd !== undefined
    ) {
      log.raw(
        `  Potential savings: ${chalk.green(
          `${fmtUsd(s.estimated_potential_monthly_savings_low_usd)}–${fmtUsd(s.estimated_potential_monthly_savings_high_usd)}/mo`,
        )}`,
      );
    }
  } else {
    log.raw(`  Estimated current monthly spend: ${chalk.dim("unknown")}`);
    log.dim(
      `    Run with --usage usage.csv for dollar estimates and mapped savings.`,
    );
  }

  const top = analysis.findings.slice(0, 3);
  if (top.length) {
    log.raw("");
    log.raw(chalk.bold(`Top ${top.length} finding${top.length === 1 ? "" : "s"}:`));
    for (const f of top) {
      const save =
        f.estimated_monthly_savings_usd && f.estimated_monthly_savings_usd > 0
          ? ` — saves ~${fmtUsd(f.estimated_monthly_savings_usd)}/mo`
          : "";
      log.raw(`  ${f.id} ${f.title}${chalk.green(save)}`);
    }
  }

  log.raw("");
  log.raw(chalk.dim(`Full report: ${path.join(root, ".agentspend", "AGENT_SPEND_REPORT.md")}`));
  return analysis;
}

function fmtUsd(n: number): string {
  if (Math.abs(n) < 1) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
