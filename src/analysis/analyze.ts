import type {
  AgentSpendConfig,
  AnalysisResult,
  NormalizedUsage,
  PricingCatalog,
  ScanResult,
  UsageRecord,
} from "../types.js";
import { aggregateUsage } from "./mapUsageToCallsites.js";
import {
  generateFindings,
  resetRecommendationState,
} from "./recommendationEngine.js";
import { round2 } from "../pricing/estimateCost.js";

export interface AnalyzeInput {
  scan: ScanResult;
  usage?: NormalizedUsage;
  pricing: PricingCatalog;
  config: AgentSpendConfig;
  monthlyRequests?: number;
  avgInputTokens?: number;
  avgOutputTokens?: number;
  pricingSource: string;
}

export function analyze(input: AnalyzeInput): AnalysisResult {
  resetRecommendationState();

  const {
    scan,
    usage,
    pricing,
    config,
    pricingSource,
  } = input;

  const hasUsage = !!usage && usage.records.length > 0;
  const aggregate = hasUsage
    ? aggregateUsage(usage!, scan.callsites, pricing)
    : undefined;

  // Build per-callsite mapping index for recommendations
  const usageMappingsByCallsite: Record<
    string,
    { records: UsageRecord[]; monthlyCost: number }
  > = {};
  if (aggregate && usage) {
    for (const mapping of aggregate.mappings) {
      if (!mapping.callsite_id) continue;
      const entry =
        usageMappingsByCallsite[mapping.callsite_id] ??
        (usageMappingsByCallsite[mapping.callsite_id] = {
          records: [],
          monthlyCost: 0,
        });
      entry.records.push(usage.records[mapping.usage_index]);
      entry.monthlyCost += mapping.monthly_cost_usd;
    }
  }

  const findings = generateFindings({
    callsites: scan.callsites,
    agentConfigs: scan.agent_configs,
    usage,
    pricing,
    monthlyRequestsDefault:
      input.monthlyRequests ?? config.analysis.monthly_request_default,
    avgInputTokensDefault:
      input.avgInputTokens ?? config.analysis.avg_input_tokens_default,
    avgOutputTokensDefault:
      input.avgOutputTokens ?? config.analysis.avg_output_tokens_default,
    perCallsiteCost: aggregate?.perCallsite ?? {},
    perModelCost: aggregate?.perModel ?? {},
    usageMappingsByCallsite,
    hasUsageData: hasUsage,
  });

  const totalSavings = findings.reduce(
    (sum, f) => sum + (f.estimated_monthly_savings_usd ?? 0),
    0,
  );
  const totalSavingsLow = findings.reduce(
    (sum, f) => sum + (f.savings_low_usd ?? f.estimated_monthly_savings_usd ?? 0),
    0,
  );
  const totalSavingsHigh = findings.reduce(
    (sum, f) => sum + (f.savings_high_usd ?? f.estimated_monthly_savings_usd ?? 0),
    0,
  );

  const summary = {
    llm_callsites: scan.callsites.filter((c) =>
      ["chat", "responses", "completion"].includes(c.operation),
    ).length,
    embedding_callsites: scan.callsites.filter(
      (c) => c.operation === "embedding",
    ).length,
    vector_db_callsites: scan.callsites.filter(
      (c) => c.operation === "vector_db",
    ).length,
    agent_config_files: scan.agent_configs.length,
    estimated_current_monthly_cost_usd: aggregate
      ? round2(aggregate.totalMonthlyCost)
      : undefined,
    estimated_potential_monthly_savings_low_usd: hasUsage
      ? round2(totalSavingsLow)
      : undefined,
    estimated_potential_monthly_savings_high_usd: hasUsage
      ? round2(totalSavingsHigh)
      : undefined,
  };

  const usageConfidenceNote = usage
    ? usage.days_covered < 28
      ? `Usage file covers ${usage.days_covered} days. Monthly estimates are normalized to 30 days; confidence is reduced.`
      : undefined
    : "No usage data provided. All cost numbers are directional scenarios, not measured spend.";

  return {
    generated_at: new Date().toISOString(),
    repo: scan.repo,
    mode: hasUsage ? "static-and-usage" : "static-only",
    pricing_source: pricingSource,
    summary,
    per_provider_cost_usd: aggregate
      ? roundRecord(aggregate.perProvider)
      : undefined,
    per_model_cost_usd: aggregate ? roundRecord(aggregate.perModel) : undefined,
    per_callsite_cost_usd: aggregate
      ? roundRecord(aggregate.perCallsite)
      : undefined,
    usage_mappings: aggregate?.mappings,
    usage_confidence_note: usageConfidenceNote,
    findings,
    callsites: scan.callsites,
    agent_configs: scan.agent_configs,
  };
}

function roundRecord(r: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(r)) out[k] = round2(v);
  return out;
}
