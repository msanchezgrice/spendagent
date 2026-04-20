import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { scanRepo } from "../src/scanner/scanRepo.js";
import { DEFAULT_CONFIG } from "../src/config/defaultConfig.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtures = (name: string) => path.resolve(testDir, "fixtures", name);

describe("scanner acceptance", () => {
  it("Repo 1 (JS OpenAI): detects classification callsite + flags premium model + no_cache", async () => {
    const result = await scanRepo(fixtures("js-openai"), DEFAULT_CONFIG);
    const cs = result.callsites.find((c) => c.provider === "openai");
    expect(cs, "openai callsite detected").toBeDefined();
    expect(cs!.model).toBe("gpt-4o");
    expect(cs!.operation).toBe("chat");
    expect(cs!.task_hint).toBe("classification");
    expect(cs!.risk_flags).toContain("premium_model");
    expect(cs!.risk_flags).toContain("no_cache_detected");
  });

  it("Repo 2 (Python Anthropic loop): detects loop flag on anthropic callsite", async () => {
    const result = await scanRepo(fixtures("py-anthropic"), DEFAULT_CONFIG);
    const cs = result.callsites.find((c) => c.provider === "anthropic");
    expect(cs, "anthropic callsite detected").toBeDefined();
    expect(cs!.model).toMatch(/claude-3-5-sonnet/);
    expect(cs!.risk_flags).toContain("inside_loop");
  });

  it("Repo 3 (Embedding recompute): flags inside_loop + embedding_recompute_risk", async () => {
    const result = await scanRepo(fixtures("ts-embeddings"), DEFAULT_CONFIG);
    const cs = result.callsites.find((c) => c.operation === "embedding");
    expect(cs, "embedding callsite detected").toBeDefined();
    expect(cs!.risk_flags).toContain("inside_loop");
    expect(cs!.risk_flags).toContain("embedding_recompute_risk");
  });

  it("Repo 4 (Large CLAUDE.md): emits agent_config finding with large_global_context", async () => {
    const result = await scanRepo(
      fixtures("large-claude-md"),
      DEFAULT_CONFIG,
    );
    const claude = result.agent_configs.find((a) => a.kind === "claude_md");
    expect(claude, "CLAUDE.md recognized").toBeDefined();
    expect(claude!.estimated_tokens).toBeGreaterThan(10000);
    expect(claude!.issues).toContain("large_global_context");
  });

  it("Regression: loop detector respects function/template boundaries", async () => {
    const result = await scanRepo(
      fixtures("false-positive-loops"),
      DEFAULT_CONFIG,
    );
    const sites = result.callsites.filter((c) => c.provider === "anthropic");
    // Two anthropic callsites: one in generateSuggestions (non-loop), one in
    // retryingCall (inside a for-loop).
    expect(sites.length).toBe(2);

    // The call inside `generateSuggestions` must NOT be marked as inside_loop
    // even though a `.map` appears above it inside a template literal and a
    // `.map` appears in an unrelated helper function earlier in the file.
    const nonLoop = sites.find(
      (c) => !c.evidence.surrounding_code?.match(/for\s*\(let\s+attempt/),
    );
    expect(nonLoop, "non-loop callsite located").toBeDefined();
    expect(
      nonLoop!.risk_flags,
      `${nonLoop!.file}:${nonLoop!.line} should not be flagged as inside_loop`,
    ).not.toContain("inside_loop");

    // The retry-loop callsite (inside `for (let attempt = 1; ...)`) MUST be
    // flagged as inside_loop.
    const loopSite = sites.find((c) =>
      c.evidence.surrounding_code?.match(/for\s*\(let\s+attempt/),
    );
    expect(loopSite, "retry-loop callsite detected").toBeDefined();
    expect(loopSite!.risk_flags).toContain("inside_loop");
  });

  it("Regression: nested dist/ directories are excluded", async () => {
    // Build an ad-hoc fixture with a nested dist containing a minified bundle
    // that LOOKS like it has LLM calls — it should be ignored.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const tmpRoot = path.join(testDir, "fixtures", "_nested-dist-tmp");
    const nested = path.join(tmpRoot, "sub", "dist", "assets");
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(
      path.join(nested, "bundle.js"),
      "openai.chat.completions.create({model:'gpt-4o'})",
    );
    fs.writeFileSync(
      path.join(tmpRoot, "real.ts"),
      "import OpenAI from 'openai';\nawait openai.chat.completions.create({model:'gpt-4o'});",
    );
    try {
      const result = await scanRepo(tmpRoot, DEFAULT_CONFIG);
      const bundled = result.callsites.filter((c) =>
        c.file.includes("dist/"),
      );
      expect(bundled.length, "dist bundle should be excluded").toBe(0);
      const real = result.callsites.filter((c) => c.file === "real.ts");
      expect(real.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
