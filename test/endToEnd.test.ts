import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { scanRepo } from "../src/scanner/scanRepo.js";
import { DEFAULT_CONFIG } from "../src/config/defaultConfig.js";
import { importGenericCsv } from "../src/usage/importGenericCsv.js";
import { normalizeUsage } from "../src/usage/normalizeUsage.js";
import { SEED_PRICING } from "../src/pricing/models.seed.js";
import { analyze } from "../src/analysis/analyze.js";
import { renderMarkdownReport } from "../src/report/markdown.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtures = (name: string) => path.resolve(testDir, "fixtures", name);

describe("end-to-end analyze", () => {
  it("produces a model-switch finding and mapped spend for the usage-csv fixture", async () => {
    const scan = await scanRepo(fixtures("usage-csv"), DEFAULT_CONFIG);
    const records = importGenericCsv(
      path.join(fixtures("usage-csv"), "usage.csv"),
    );
    expect(records.length).toBe(3);
    const usage = normalizeUsage(records);

    const analysis = analyze({
      scan,
      usage,
      pricing: SEED_PRICING,
      config: DEFAULT_CONFIG,
      pricingSource: "seed",
    });

    expect(analysis.mode).toBe("static-and-usage");
    expect(
      analysis.summary.estimated_current_monthly_cost_usd,
    ).toBeGreaterThan(0);

    // At least one finding should be a model_switch
    const modelSwitch = analysis.findings.find(
      (f) => f.category === "model_switch",
    );
    expect(modelSwitch, "model_switch finding generated").toBeDefined();
    expect(modelSwitch!.suggested_alternatives!.length).toBeGreaterThan(0);
    // Placeholder OSS model must not be top-ranked (see recommendationEngine filter)
    expect(modelSwitch!.suggested_alternatives![0].provider).not.toBe("local");
    // With only 3 days of usage, confidence must be capped to "low"
    expect(modelSwitch!.savings_confidence).toBe("low");

    // Markdown report should render without throwing
    const md = renderMarkdownReport(analysis);
    expect(md).toContain("AgentSpend Report");
    expect(md).toMatch(/F\d{3}/);
  });

  it("static-only mode emits recommendations without dollar totals", async () => {
    const scan = await scanRepo(fixtures("js-openai"), DEFAULT_CONFIG);
    const analysis = analyze({
      scan,
      pricing: SEED_PRICING,
      config: DEFAULT_CONFIG,
      pricingSource: "seed",
    });
    expect(analysis.mode).toBe("static-only");
    expect(
      analysis.summary.estimated_current_monthly_cost_usd,
    ).toBeUndefined();
    // We should still get at least one finding (premium model on classification)
    expect(analysis.findings.length).toBeGreaterThan(0);
    const ms = analysis.findings.find((f) => f.category === "model_switch");
    expect(ms).toBeDefined();
    expect(ms!.savings_confidence).toBe("low");
  });
});
