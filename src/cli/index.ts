#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { runInit } from "./commands/init.js";
import { runScan } from "./commands/scan.js";
import { runImportUsage } from "./commands/importUsage.js";
import { runAnalyze } from "./commands/analyze.js";
import { runReport } from "./commands/report.js";
import { runDoctor } from "./commands/doctor.js";
import { runHardware } from "./commands/hardware.js";
import { log, setVerbose } from "../utils/logger.js";

const program = new Command();

program
  .name("agentspend")
  .description(
    "Local AI/API spend auditor. Scans a repo for LLM usage, imports usage data, estimates spend, and ranks cost-saving opportunities.",
  )
  .version("0.1.0")
  .option("-v, --verbose", "print debug output", false);

program.hook("preAction", (cmd) => {
  if (cmd.optsWithGlobals().verbose) setVerbose(true);
});

program
  .command("init")
  .description("Create .agentspend/ config files")
  .option("--repo <dir>", "repo root", ".")
  .option("--force", "overwrite existing config files", false)
  .action((opts) => {
    try {
      runInit({ repo: opts.repo, force: opts.force });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("scan")
  .description("Scan a repo for LLM/API callsites and agent configs")
  .option("--repo <dir>", "repo root", ".")
  .option("--out <path>", "override output path")
  .option("--format <format>", "output format", "json")
  .action(async (opts) => {
    try {
      await runScan({ repo: opts.repo, out: opts.out, format: opts.format });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("import-usage <inputFile>")
  .description("Normalize a usage CSV/JSON into AgentSpend's internal format")
  .option("--repo <dir>", "repo root", ".")
  .option("--out <path>", "override output path")
  .option(
    "--format <format>",
    "usage format: generic-csv | litellm | langfuse | helicone",
    "generic-csv",
  )
  .action((inputFile, opts) => {
    try {
      runImportUsage({
        repo: opts.repo,
        input: inputFile,
        out: opts.out,
        format: opts.format,
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("analyze")
  .description("Combine scan + usage + pricing into an analysis.json")
  .option("--repo <dir>", "repo root", ".")
  .option("--scan <path>", "scan.json path")
  .option("--usage <path>", "normalized usage json path")
  .option("--pricing <path>", "pricing.models.json path")
  .option("--out <path>", "output analysis.json path")
  .option("--monthly-requests <n>", "assumed monthly request count", (v) =>
    Number(v),
  )
  .option("--avg-input-tokens <n>", "assumed average input tokens per request", (v) =>
    Number(v),
  )
  .option("--avg-output-tokens <n>", "assumed average output tokens per request", (v) =>
    Number(v),
  )
  .action((opts) => {
    try {
      runAnalyze({
        repo: opts.repo,
        scanPath: opts.scan,
        usagePath: opts.usage,
        pricingPath: opts.pricing,
        out: opts.out,
        monthlyRequests: opts.monthlyRequests,
        avgInputTokens: opts.avgInputTokens,
        avgOutputTokens: opts.avgOutputTokens,
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("report")
  .description("Render AGENT_SPEND_REPORT.md and report.json from analysis.json")
  .option("--repo <dir>", "repo root", ".")
  .option("--analysis <path>", "analysis.json path")
  .option("--out <path>", "markdown output path")
  .option("--json <path>", "json output path")
  .action((opts) => {
    try {
      runReport({
        repo: opts.repo,
        analysisPath: opts.analysis,
        mdOut: opts.out,
        jsonOut: opts.json,
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("doctor")
  .description("Run the full pipeline: scan → import usage → analyze → report")
  .option("--repo <dir>", "repo root", ".")
  .option("--usage <path>", "path to a usage CSV")
  .option("--monthly-requests <n>", "assumed monthly request count", (v) =>
    Number(v),
  )
  .option("--avg-input-tokens <n>", "assumed average input tokens per request", (v) =>
    Number(v),
  )
  .option("--avg-output-tokens <n>", "assumed average output tokens per request", (v) =>
    Number(v),
  )
  .action(async (opts) => {
    try {
      await runDoctor({
        repo: opts.repo,
        usage: opts.usage,
        monthlyRequests: opts.monthlyRequests,
        avgInputTokens: opts.avgInputTokens,
        avgOutputTokens: opts.avgOutputTokens,
      });
    } catch (err) {
      fail(err);
    }
  });

program
  .command("hardware")
  .description("Estimate hardware / self-hosting break-even vs API spend")
  .option("--repo <dir>", "repo root", ".")
  .option("--hardware <path>", "hardware profile JSON path")
  .option("--analysis <path>", "analysis.json path (to pull current spend)")
  .option("--monthly-api-cost <n>", "override monthly API cost", (v) =>
    Number(v),
  )
  .action((opts) => {
    try {
      runHardware({
        repo: opts.repo,
        hardwarePath: opts.hardware,
        analysisPath: opts.analysis,
        monthlyApiCost: opts.monthlyApiCost,
      });
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync().catch(fail);

function fail(err: unknown): never {
  const msg =
    err instanceof Error ? err.message : String(err ?? "unknown error");
  log.error(msg);
  if (process.env.AGENTSPEND_DEBUG && err instanceof Error && err.stack) {
    console.error(chalk.dim(err.stack));
  }
  process.exit(1);
}
