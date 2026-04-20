import type {
  Callsite,
  Confidence,
  NormalizedUsage,
  PricingCatalog,
  UsageMapping,
  UsageRecord,
} from "../types.js";
import { estimateCost } from "../pricing/estimateCost.js";
import { findPricing } from "../pricing/loadPricing.js";

export interface UsageAggregate {
  /** Monthly cost for each usage record (normalized to 30 days). */
  perRecordMonthlyCost: number[];
  /** Sum monthly cost. */
  totalMonthlyCost: number;
  /** Mapping per-record back to callsite (may be undefined). */
  mappings: UsageMapping[];
  /** Per-provider cost. */
  perProvider: Record<string, number>;
  /** Per-model cost. */
  perModel: Record<string, number>;
  /** Per-callsite cost (only mapped). */
  perCallsite: Record<string, number>;
}

/**
 * Returns a per-record cost + a mapping onto callsites.
 */
export function aggregateUsage(
  usage: NormalizedUsage,
  callsites: Callsite[],
  pricing: PricingCatalog,
): UsageAggregate {
  const monthlyFactor = 30 / Math.max(1, usage.days_covered);
  const perRecord: number[] = new Array(usage.records.length).fill(0);
  const mappings: UsageMapping[] = [];
  const perProvider: Record<string, number> = {};
  const perModel: Record<string, number> = {};
  const perCallsite: Record<string, number> = {};

  usage.records.forEach((rec, i) => {
    let cost = 0;
    if (rec.cost_usd !== undefined && !Number.isNaN(rec.cost_usd)) {
      cost = rec.cost_usd;
    } else {
      const model = findPricing(pricing, rec.provider, rec.model);
      if (model) {
        cost = estimateCost(model, {
          input_tokens: rec.input_tokens,
          output_tokens: rec.output_tokens,
          cached_input_tokens: rec.cached_input_tokens,
        });
      }
    }
    const monthlyCost = cost * monthlyFactor;
    perRecord[i] = monthlyCost;

    const providerKey = rec.provider || "unknown";
    perProvider[providerKey] = (perProvider[providerKey] ?? 0) + monthlyCost;
    const modelKey = `${providerKey}/${rec.model}`;
    perModel[modelKey] = (perModel[modelKey] ?? 0) + monthlyCost;

    const mapping = mapRecord(rec, callsites);
    mappings.push({
      usage_index: i,
      callsite_id: mapping?.callsite.id,
      confidence: mapping?.confidence ?? "low",
      reason: mapping?.reason ?? "no match",
      monthly_cost_usd: monthlyCost,
    });

    if (mapping) {
      perCallsite[mapping.callsite.id] =
        (perCallsite[mapping.callsite.id] ?? 0) + monthlyCost;
    }
  });

  const totalMonthlyCost = perRecord.reduce((a, b) => a + b, 0);

  return {
    perRecordMonthlyCost: perRecord,
    totalMonthlyCost,
    mappings,
    perProvider,
    perModel,
    perCallsite,
  };
}

interface Mapped {
  callsite: Callsite;
  confidence: Confidence;
  reason: string;
}

/**
 * Try to map a usage record to a code callsite.
 * High: explicit source_callsite_id or (route matches file path segment and model matches)
 * Medium: provider+model match with route loosely matching file path or feature/function name
 * Low: provider+model match only, and there's exactly one candidate
 */
function mapRecord(rec: UsageRecord, callsites: Callsite[]): Mapped | undefined {
  if (rec.source_callsite_id) {
    const cs = callsites.find((c) => c.id === rec.source_callsite_id);
    if (cs) return { callsite: cs, confidence: "high", reason: "source_callsite_id" };
  }

  const sameModel = callsites.filter((cs) => {
    if (!cs.model || !rec.model) return false;
    const a = cs.model.toLowerCase();
    const b = rec.model.toLowerCase();
    return a === b || a.startsWith(b) || b.startsWith(a);
  });

  // Route match
  if (rec.route) {
    const routeKey = rec.route.toLowerCase().replace(/\\/g, "/");
    const routeCandidates = sameModel.filter((cs) => {
      const fileLow = cs.file.toLowerCase().replace(/\\/g, "/");
      const rh = (cs.route_hint ?? "").toLowerCase();
      return (
        fileLow.includes(routeKey) ||
        rh.includes(routeKey) ||
        routeKey.includes(rh) ||
        fileLow.split("/").some((seg) => seg === routeKey.split("/").pop())
      );
    });
    if (routeCandidates.length === 1)
      return {
        callsite: routeCandidates[0],
        confidence: "high",
        reason: `route ${rec.route} and model match`,
      };
    if (routeCandidates.length > 1)
      return {
        callsite: routeCandidates[0],
        confidence: "medium",
        reason: `route ${rec.route} matched ${routeCandidates.length} callsites`,
      };
  }

  // Feature match (function name / file name)
  if (rec.feature) {
    const featureKey = rec.feature.toLowerCase();
    const featureCandidates = sameModel.filter((cs) => {
      const fileLow = cs.file.toLowerCase();
      const fn = (cs.function_name ?? "").toLowerCase();
      return fileLow.includes(featureKey) || fn.includes(featureKey);
    });
    if (featureCandidates.length === 1)
      return {
        callsite: featureCandidates[0],
        confidence: "high",
        reason: `feature ${rec.feature} and model match`,
      };
    if (featureCandidates.length > 1)
      return {
        callsite: featureCandidates[0],
        confidence: "medium",
        reason: `feature ${rec.feature} matched ${featureCandidates.length} callsites`,
      };
  }

  // Fallback: same model only; unique -> medium, otherwise low
  if (sameModel.length === 1)
    return {
      callsite: sameModel[0],
      confidence: "medium",
      reason: "unique model match",
    };
  if (sameModel.length > 1)
    return {
      callsite: sameModel[0],
      confidence: "low",
      reason: `model matched ${sameModel.length} callsites`,
    };

  return undefined;
}
