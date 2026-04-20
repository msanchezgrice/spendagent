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
});
