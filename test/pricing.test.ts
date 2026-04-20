import { describe, it, expect } from "vitest";
import { SEED_PRICING } from "../src/pricing/models.seed.js";
import { findPricing } from "../src/pricing/loadPricing.js";
import { estimateCost } from "../src/pricing/estimateCost.js";

describe("pricing", () => {
  it("resolves claude-sonnet alias", () => {
    const p = findPricing(SEED_PRICING, "anthropic", "claude-3-5-sonnet-latest");
    expect(p?.model).toBe("claude-3-5-sonnet");
  });

  it("resolves gpt-4o-mini", () => {
    const p = findPricing(SEED_PRICING, "openai", "gpt-4o-mini");
    expect(p?.model).toBe("gpt-4o-mini");
    expect(p?.quality_tier).toBe("cheap");
  });

  it("estimateCost math sanity", () => {
    const p = findPricing(SEED_PRICING, "openai", "gpt-4o-mini")!;
    // 1M input @ 0.15 + 1M output @ 0.6 = 0.75
    const cost = estimateCost(p, { input_tokens: 1_000_000, output_tokens: 1_000_000 });
    expect(cost).toBeCloseTo(0.75, 6);
  });

  it("picks longest alias match", () => {
    const p = findPricing(SEED_PRICING, "anthropic", "claude-3-opus-latest");
    expect(p?.model).toBe("claude-3-opus");
  });
});
