import path from "node:path";
import { readJson, exists } from "../utils/filesystem.js";
import type { PricingCatalog, PricingModel } from "../types.js";
import { SEED_PRICING } from "./models.seed.js";

export function loadPricing(repoRoot: string, explicitPath?: string): PricingCatalog {
  const pricingPath =
    explicitPath ?? path.join(repoRoot, ".agentspend", "pricing.models.json");
  if (!exists(pricingPath)) return SEED_PRICING;
  try {
    return readJson<PricingCatalog>(pricingPath);
  } catch {
    return SEED_PRICING;
  }
}

/**
 * Find a pricing entry for a given provider + model string. Matches loosely
 * against the canonical model field and any aliases. Returns undefined if no
 * match.
 */
export function findPricing(
  catalog: PricingCatalog,
  provider: string | undefined,
  model: string | undefined,
): PricingModel | undefined {
  if (!model) return undefined;
  const m = model.toLowerCase();

  const matches = catalog.models.filter((pm) => {
    const sameProvider =
      !provider ||
      provider === "unknown" ||
      pm.provider === provider ||
      // Route vercel-ai / litellm / langchain / llamaindex to underlying provider
      (["vercel-ai", "litellm", "langchain", "llamaindex"].includes(provider) &&
        modelLooksLikeProvider(m, pm.provider));
    if (!sameProvider) return false;
    const candidates = [pm.model, ...(pm.aliases ?? [])].map((s) =>
      s.toLowerCase(),
    );
    return candidates.some((c) => m === c || m.startsWith(c));
  });

  if (matches.length === 0) return undefined;
  // Prefer longest match to disambiguate "claude-3-5-sonnet" vs "claude-3".
  matches.sort((a, b) => b.model.length - a.model.length);
  return matches[0];
}

function modelLooksLikeProvider(model: string, provider: string): boolean {
  if (provider === "openai")
    return model.startsWith("gpt-") || model.startsWith("o1") ||
      model.startsWith("o3") || model.startsWith("text-embedding-");
  if (provider === "anthropic") return model.startsWith("claude");
  if (provider === "gemini") return model.startsWith("gemini");
  return false;
}

/**
 * Crude quality tier ranking used when scoring alternatives.
 */
export function tierRank(tier: PricingModel["quality_tier"] | undefined): number {
  switch (tier) {
    case "frontier":
      return 4;
    case "premium":
      return 3;
    case "mid":
      return 2;
    case "cheap":
      return 1;
    case "oss":
      return 0;
    default:
      return 2;
  }
}

export function isPremiumTier(
  tier: PricingModel["quality_tier"] | undefined,
): boolean {
  return tier === "frontier" || tier === "premium";
}
