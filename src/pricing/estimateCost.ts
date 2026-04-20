import type { PricingModel } from "../types.js";

export interface TokenBundle {
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
}

/**
 * Compute USD cost for a token bundle under the given pricing model.
 */
export function estimateCost(
  pricing: PricingModel,
  bundle: TokenBundle,
): number {
  const inputCost = (bundle.input_tokens / 1_000_000) * pricing.input_per_1m;
  const outputCost = (bundle.output_tokens / 1_000_000) * pricing.output_per_1m;
  const cached = bundle.cached_input_tokens ?? 0;
  const cachedCost =
    (cached / 1_000_000) * (pricing.cached_input_per_1m ?? pricing.input_per_1m);
  return inputCost + outputCost + cachedCost;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
