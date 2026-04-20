import path from "node:path";
import { DEFAULT_CONFIG_YAML } from "../../config/defaultConfig.js";
import { SEED_PRICING } from "../../pricing/models.seed.js";
import { EXAMPLE_HARDWARE_PROFILE } from "../../analysis/hardwareBreakEven.js";
import { writeText, writeJson, exists } from "../../utils/filesystem.js";
import { log } from "../../utils/logger.js";

export interface InitOptions {
  repo: string;
  force?: boolean;
}

export function runInit(opts: InitOptions): void {
  const root = path.resolve(opts.repo);
  const dir = path.join(root, ".agentspend");
  const configPath = path.join(dir, "config.yml");
  const pricingPath = path.join(dir, "pricing.models.json");
  const hardwarePath = path.join(dir, "hardware.example.json");

  const created: string[] = [];
  const skipped: string[] = [];

  if (!exists(configPath) || opts.force) {
    writeText(configPath, DEFAULT_CONFIG_YAML);
    created.push(configPath);
  } else skipped.push(configPath);

  if (!exists(pricingPath) || opts.force) {
    writeJson(pricingPath, SEED_PRICING);
    created.push(pricingPath);
  } else skipped.push(pricingPath);

  if (!exists(hardwarePath) || opts.force) {
    writeJson(hardwarePath, EXAMPLE_HARDWARE_PROFILE);
    created.push(hardwarePath);
  } else skipped.push(hardwarePath);

  log.bold("AgentSpend init");
  for (const f of created) log.ok(`created ${rel(root, f)}`);
  for (const f of skipped)
    log.dim(`  skipped (exists): ${rel(root, f)}  (use --force to overwrite)`);
  log.raw("");
  log.dim(
    "Review .agentspend/pricing.models.json before trusting dollar estimates.",
  );
}

function rel(root: string, p: string): string {
  return path.relative(root, p) || p;
}
