import path from "node:path";
import { readJson, exists } from "../../utils/filesystem.js";
import {
  EXAMPLE_HARDWARE_PROFILE,
  hardwareBreakEven,
  type HardwareProfile,
} from "../../analysis/hardwareBreakEven.js";
import { log } from "../../utils/logger.js";
import type { AnalysisResult } from "../../types.js";

export interface HardwareOptions {
  repo: string;
  hardwarePath?: string;
  analysisPath?: string;
  monthlyApiCost?: number;
}

export function runHardware(opts: HardwareOptions): void {
  const root = path.resolve(opts.repo);
  const hwPath =
    opts.hardwarePath ??
    path.join(root, ".agentspend", "hardware.example.json");
  const profile: HardwareProfile = exists(hwPath)
    ? readJson<HardwareProfile>(hwPath)
    : EXAMPLE_HARDWARE_PROFILE;

  let monthly = opts.monthlyApiCost;
  if (monthly === undefined) {
    const analysisPath =
      opts.analysisPath ?? path.join(root, ".agentspend", "analysis.json");
    if (exists(analysisPath)) {
      const a = readJson<AnalysisResult>(analysisPath);
      monthly = a.summary.estimated_current_monthly_cost_usd ?? 0;
    } else {
      monthly = 0;
    }
  }

  const result = hardwareBreakEven(profile, monthly);
  log.bold(`Hardware break-even (${profile.name})`);
  log.raw(`  Current API cost:        $${result.monthly_api_cost_usd}/mo`);
  log.raw(`  Hardware amortized:      $${result.monthly_amortized_cost_usd}/mo`);
  log.raw(`  Electricity:             $${result.monthly_electricity_cost_usd}/mo`);
  log.raw(`  Ops:                     $${result.monthly_ops_cost_usd}/mo`);
  log.raw(`  Total hardware:          $${result.monthly_hardware_cost_usd}/mo`);
  log.raw("");
  log.raw(`  Break-even: ${result.break_even}`);
  log.dim(result.notes);
}
