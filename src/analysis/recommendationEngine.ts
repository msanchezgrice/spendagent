import type {
  AgentConfigFinding,
  Callsite,
  Finding,
  NormalizedUsage,
  PricingCatalog,
  PricingModel,
  SuggestedAlternative,
  TaskHint,
  UsageRecord,
} from "../types.js";
import { estimateCost, round2 } from "../pricing/estimateCost.js";
import {
  findPricing,
  isPremiumTier,
  tierRank,
} from "../pricing/loadPricing.js";
import { shortHash } from "../utils/hashing.js";

export interface RecommendationContext {
  callsites: Callsite[];
  agentConfigs: AgentConfigFinding[];
  usage?: NormalizedUsage;
  pricing: PricingCatalog;
  monthlyRequestsDefault: number;
  avgInputTokensDefault: number;
  avgOutputTokensDefault: number;
  perCallsiteCost: Record<string, number>;
  perModelCost: Record<string, number>;
  usageMappingsByCallsite: Record<string, { records: UsageRecord[]; monthlyCost: number }>;
  hasUsageData: boolean;
}

/**
 * Capability requirements for each task hint. Used to filter alternatives
 * so we don't recommend a chat-only model for a task needing tool calling.
 */
const TASK_CAPABILITIES: Record<TaskHint, string[]> = {
  classification: ["chat"],
  extraction: ["chat", "structured_output"],
  summarization: ["chat"],
  coding: ["chat", "coding"],
  rag: ["chat"],
  agent_planning: ["chat", "tool_calling"],
  eval: ["chat"],
  embedding: ["embedding"],
  unknown: ["chat"],
};

/** Build all findings for a run. */
export function generateFindings(ctx: RecommendationContext): Finding[] {
  const findings: Finding[] = [];

  // Per-callsite rules
  for (const cs of ctx.callsites) {
    const f = findingForPremiumOnSimpleTask(cs, ctx);
    if (f) findings.push(f);

    const cacheF = findingForNoCache(cs, ctx);
    if (cacheF) findings.push(cacheF);

    const loopF = findingForCallInLoop(cs, ctx);
    if (loopF) findings.push(loopF);

    const embF = findingForEmbeddingRecompute(cs, ctx);
    if (embF) findings.push(embF);

    const telemetryF = findingForMissingTelemetry(cs, ctx);
    if (telemetryF) findings.push(telemetryF);

    const batchF = findingForBatchableJob(cs, ctx);
    if (batchF) findings.push(batchF);
  }

  // Agent config rules
  for (const cfg of ctx.agentConfigs) {
    const f = findingForAgentConfig(cfg);
    if (f) findings.push(f);
  }

  // Rank findings: highest estimated savings first, falling back to severity.
  findings.sort((a, b) => {
    const sa = a.estimated_monthly_savings_usd ?? 0;
    const sb = b.estimated_monthly_savings_usd ?? 0;
    if (sb !== sa) return sb - sa;
    return severityRank(b.severity) - severityRank(a.severity);
  });

  // Number findings as F001, F002, ...
  findings.forEach((f, i) => {
    f.id = `F${String(i + 1).padStart(3, "0")}`;
  });

  return findings;
}

function severityRank(s: Finding["severity"]): number {
  return { info: 0, low: 1, medium: 2, high: 3 }[s];
}

/* -------------------------------------------------------------------------- */
/* Rule 1: Premium model used for a simple task                               */
/* -------------------------------------------------------------------------- */

function findingForPremiumOnSimpleTask(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  const currentPricing = cs.model
    ? findPricing(ctx.pricing, cs.provider, cs.model)
    : undefined;
  const premium =
    cs.risk_flags.includes("premium_model") ||
    (currentPricing && isPremiumTier(currentPricing.quality_tier));
  if (!premium || !cs.model) return undefined;

  const task = cs.task_hint;
  const simpleTasks: TaskHint[] = [
    "classification",
    "extraction",
    "summarization",
  ];
  if (!task || !simpleTasks.includes(task)) return undefined;

  const { currentCost, projectedCost, alternatives, confidence } =
    estimateSwitchEconomics(cs, ctx, task);
  const savings = Math.max(0, currentCost - projectedCost);

  return {
    id: "pending",
    title: `Premium model used for likely ${task} task`,
    summary: `${cs.file}:${cs.line} calls ${cs.model} for what looks like a ${task} task. A cheaper model with fallback should be tried first.`,
    category: "model_switch",
    severity: savings > 50 || currentCost > 100 ? "high" : "medium",
    current_monthly_cost_usd: round2(currentCost),
    projected_monthly_cost_usd: round2(projectedCost),
    estimated_monthly_savings_usd: round2(savings),
    savings_low_usd: round2(savings * 0.5),
    savings_high_usd: round2(savings),
    savings_confidence: confidence,
    implementation_effort: "hours",
    implementation_risk: "medium",
    affected_callsites: [cs.id],
    evidence: [
      `${cs.file}:${cs.line}`,
      `Model: ${cs.model}`,
      `Task hint: ${task}`,
      ...(cs.risk_flags.includes("no_cache_detected")
        ? ["No caching detected"]
        : []),
    ],
    recommendation: `Route this ${task} call to a cheaper model by default, with fallback to ${cs.model} for low-confidence or failed cases. Run a short eval (50–200 samples) before rollout.`,
    suggested_alternatives: alternatives,
    patch_plan: {
      can_auto_patch: false,
      description: `Introduce a modelRouter with a '${task}' task and route this callsite through it.`,
      files_to_change: [cs.file, "src/ai/modelRouter.ts"],
      steps: [
        "Create src/ai/modelRouter.ts with primary + fallback config keyed by task type.",
        `Replace the hard-coded model string at ${cs.file}:${cs.line} with a call to modelRouter('${task}').`,
        "Add a usage tag (feature name) so future reports can attribute spend.",
        "Add a 50–200 sample eval before cutting traffic over.",
      ],
    },
  };
}

function estimateSwitchEconomics(
  cs: Callsite,
  ctx: RecommendationContext,
  task: TaskHint,
): {
  currentCost: number;
  projectedCost: number;
  alternatives: SuggestedAlternative[];
  confidence: Finding["savings_confidence"];
} {
  const current = cs.model
    ? findPricing(ctx.pricing, cs.provider, cs.model)
    : undefined;

  const callsiteCost = ctx.perCallsiteCost[cs.id];
  const hasMappedUsage = callsiteCost !== undefined && callsiteCost > 0;

  // Synthetic scenario if no usage
  const syntheticInput = ctx.avgInputTokensDefault * ctx.monthlyRequestsDefault;
  const syntheticOutput = ctx.avgOutputTokensDefault * ctx.monthlyRequestsDefault;

  const currentCost =
    hasMappedUsage && callsiteCost
      ? callsiteCost
      : current
        ? estimateCost(current, {
            input_tokens: syntheticInput,
            output_tokens: syntheticOutput,
          })
        : 0;

  const requiredCaps = TASK_CAPABILITIES[task];
  const candidates = ctx.pricing.models
    .filter((m) => {
      if (current && m.model === current.model && m.provider === current.provider)
        return false;
      // Skip the local/OSS placeholder from default ranking — it's not a real
      // product, and $0 alternatives dominate the ranking unfairly. Users who
      // care about self-hosting can run `agentspend hardware` separately.
      if (m.provider === "local" || m.quality_tier === "oss") return false;
      // Must have required capabilities
      const caps = m.capabilities ?? [];
      if (!requiredCaps.every((c) => caps.includes(c))) return false;
      // Must be cheaper per-input-token than current
      if (!current) return true;
      return m.input_per_1m < current.input_per_1m;
    })
    .sort((a, b) => a.input_per_1m + a.output_per_1m - (b.input_per_1m + b.output_per_1m))
    .slice(0, 3);

  const alternatives: SuggestedAlternative[] = candidates.map((alt) => {
    const altCost = hasMappedUsage && current
      ? currentCost * ((alt.input_per_1m + alt.output_per_1m) /
        Math.max(0.0001, current.input_per_1m + current.output_per_1m))
      : estimateCost(alt, {
          input_tokens: syntheticInput,
          output_tokens: syntheticOutput,
        });
    const savings = Math.max(0, currentCost - altCost);
    const quality = tierRank(alt.quality_tier);
    const currentQuality = tierRank(current?.quality_tier);
    const risk: SuggestedAlternative["risk"] =
      currentQuality - quality >= 3 ? "high" : currentQuality - quality >= 2 ? "medium" : "low";
    return {
      provider: alt.provider,
      model: alt.model,
      rationale: `Cheaper ${alt.quality_tier ?? "alternative"} model with ${requiredCaps.join(", ")} support`,
      estimated_monthly_cost_usd: round2(altCost),
      estimated_monthly_savings_usd: round2(savings),
      risk,
    };
  });

  const projectedCost = alternatives[0]?.estimated_monthly_cost_usd ?? currentCost;
  let confidence: Finding["savings_confidence"] = hasMappedUsage
    ? "high"
    : ctx.hasUsageData
      ? "medium"
      : "low";
  // Cap confidence when the usage window is narrow. `ctx.usage?.days_covered`
  // carries the measured date range from the imported CSV.
  const days = ctx.usage?.days_covered;
  if (days !== undefined) {
    if (days < 7) confidence = "low";
    else if (days < 14 && confidence === "high") confidence = "medium";
  }

  return { currentCost, projectedCost, alternatives, confidence };
}

/* -------------------------------------------------------------------------- */
/* Rule 2: No caching for deterministic task                                  */
/* -------------------------------------------------------------------------- */

function findingForNoCache(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  if (!cs.risk_flags.includes("no_cache_detected")) return undefined;
  // Only applies to cacheable tasks
  const cacheable: TaskHint[] = [
    "classification",
    "extraction",
    "summarization",
    "embedding",
    "rag",
  ];
  if (!cs.task_hint || !cacheable.includes(cs.task_hint)) return undefined;

  const callsiteCost = ctx.perCallsiteCost[cs.id] ?? 0;
  const syntheticCost = ctx.pricing.models.length && cs.model
    ? (() => {
        const p = findPricing(ctx.pricing, cs.provider, cs.model);
        if (!p) return 0;
        return estimateCost(p, {
          input_tokens: ctx.avgInputTokensDefault * ctx.monthlyRequestsDefault,
          output_tokens: ctx.avgOutputTokensDefault * ctx.monthlyRequestsDefault,
        });
      })()
    : 0;
  const baseline = callsiteCost > 0 ? callsiteCost : syntheticCost;
  const savings = baseline * 0.25;
  // If we have no baseline (dynamic model + no usage), report a qualitative
  // finding without an invented dollar figure.
  const hasCost = baseline > 0;

  return {
    id: "pending",
    title: `Missing cache on ${cs.task_hint} callsite`,
    summary: `${cs.file}:${cs.line} makes a ${cs.task_hint} call with no visible cache layer. Deterministic or repeated inputs are likely being recomputed.`,
    category: "prompt_caching",
    severity: baseline > 100 ? "medium" : "low",
    current_monthly_cost_usd: hasCost ? round2(baseline) : undefined,
    projected_monthly_cost_usd: hasCost ? round2(baseline - savings) : undefined,
    estimated_monthly_savings_usd: hasCost ? round2(savings) : undefined,
    savings_low_usd: hasCost ? round2(savings * 0.4) : undefined,
    savings_high_usd: hasCost ? round2(savings * 1.5) : undefined,
    savings_confidence: callsiteCost > 0 ? "medium" : "low",
    implementation_effort: "hours",
    implementation_risk: "low",
    affected_callsites: [cs.id],
    evidence: [`${cs.file}:${cs.line}`, `Model: ${cs.model ?? "(dynamic)"}`],
    recommendation:
      "Add a request-level cache keyed by model + normalized prompt + input hash. For idempotent classification/extraction, even a 24h TTL saves a lot.",
  };
}

/* -------------------------------------------------------------------------- */
/* Rule 6: LLM call inside loop                                               */
/* -------------------------------------------------------------------------- */

function findingForCallInLoop(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  if (!cs.risk_flags.includes("inside_loop")) return undefined;
  if (cs.operation === "vector_db") return undefined;

  return {
    id: "pending",
    title: `LLM call inside a loop at ${cs.file}:${cs.line}`,
    summary: `A ${cs.provider} ${cs.operation} call is inside a loop. This often multiplies spend by N inputs and can create rate-limit storms.`,
    category: "fanout",
    severity: "medium",
    savings_confidence: "low",
    implementation_effort: "hours",
    implementation_risk: "low",
    affected_callsites: [cs.id],
    evidence: [`${cs.file}:${cs.line}`, "Detected loop enclosing callsite"],
    recommendation:
      "Batch inputs into one request where the API supports it, or add bounded concurrency (e.g. p-limit / asyncio.Semaphore) with a cache so repeated items are skipped.",
  };
}

/* -------------------------------------------------------------------------- */
/* Rule 4: Embeddings recomputed                                              */
/* -------------------------------------------------------------------------- */

function findingForEmbeddingRecompute(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  if (cs.operation !== "embedding") return undefined;
  if (!cs.risk_flags.includes("embedding_recompute_risk") &&
      !cs.risk_flags.includes("inside_loop")) return undefined;

  return {
    id: "pending",
    title: `Embeddings likely recomputed at ${cs.file}:${cs.line}`,
    summary: `Embedding call inside a loop with no persistence detected. Unchanged documents may be re-embedded on every run.`,
    category: "embedding_optimization",
    severity: "medium",
    savings_confidence: "low",
    implementation_effort: "hours",
    implementation_risk: "low",
    affected_callsites: [cs.id],
    evidence: [`${cs.file}:${cs.line}`, `Model: ${cs.model ?? "(dynamic)"}`],
    recommendation:
      "Persist embeddings keyed by sha256(content). Skip unchanged documents. For large stores, batch embed (OpenAI/Cohere batch) and reuse the same model family consistently.",
  };
}

/* -------------------------------------------------------------------------- */
/* Rule 7: Missing telemetry                                                  */
/* -------------------------------------------------------------------------- */

function findingForMissingTelemetry(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  if (!cs.risk_flags.includes("missing_usage_tags")) return undefined;
  // Only emit one telemetry finding per file (collapse noise)
  const emittedKey = `__telemetry:${cs.file}`;
  if ((findingForMissingTelemetry as unknown as { _seen: Set<string> })._seen?.has(emittedKey))
    return undefined;
  if (!(findingForMissingTelemetry as unknown as { _seen: Set<string> })._seen) {
    (findingForMissingTelemetry as unknown as { _seen: Set<string> })._seen =
      new Set();
  }
  (findingForMissingTelemetry as unknown as { _seen: Set<string> })._seen.add(
    emittedKey,
  );

  return {
    id: "pending",
    title: `Missing feature tags on ${cs.file}`,
    summary: `LLM calls in ${cs.file} have no visible metadata/feature tags. Future cost attribution to code will be very hard.`,
    category: "telemetry",
    severity: "low",
    savings_confidence: "low",
    implementation_effort: "minutes",
    implementation_risk: "low",
    affected_callsites: [cs.id],
    evidence: [`${cs.file}:${cs.line}`],
    recommendation:
      "Pass a stable feature tag (e.g. metadata: { feature: 'classify_lead' } for Anthropic; user or tags for OpenAI). This unlocks dollar-level attribution in future runs.",
  };
}

/* -------------------------------------------------------------------------- */
/* Rule 5: Batchable background job                                           */
/* -------------------------------------------------------------------------- */

function findingForBatchableJob(
  cs: Callsite,
  ctx: RecommendationContext,
): Finding | undefined {
  const file = cs.file.replace(/\\/g, "/");
  const isBackground =
    /(?:^|\/)(jobs|cron|crons|scripts|workers|worker|batch|eval|evals)\//i.test(
      file,
    );
  if (!isBackground) return undefined;
  const current = cs.model
    ? findPricing(ctx.pricing, cs.provider, cs.model)
    : undefined;
  if (!current) return undefined;

  const callsiteCost = ctx.perCallsiteCost[cs.id] ?? 0;
  if (callsiteCost <= 0 && !ctx.hasUsageData) {
    // still emit a soft finding based on batch discount
  }

  const batchMultiplier = Math.min(
    current.batch_input_multiplier ?? 1,
    current.batch_output_multiplier ?? 1,
  );
  if (batchMultiplier >= 1) return undefined;

  const savings = callsiteCost > 0 ? callsiteCost * (1 - batchMultiplier) : 0;

  return {
    id: "pending",
    title: `Background job at ${cs.file}:${cs.line} is a batch-API candidate`,
    summary: `This callsite lives in a background path (${file}). Providers typically offer ~50% discounts for non-realtime batch submissions.`,
    category: "batching",
    severity: savings > 50 ? "medium" : "low",
    current_monthly_cost_usd: round2(callsiteCost),
    projected_monthly_cost_usd: round2(callsiteCost * batchMultiplier),
    estimated_monthly_savings_usd: round2(savings),
    savings_confidence: callsiteCost > 0 ? "medium" : "low",
    implementation_effort: "hours",
    implementation_risk: "low",
    affected_callsites: [cs.id],
    evidence: [`${cs.file}:${cs.line}`, `Model: ${cs.model}`],
    recommendation:
      "Route this background workload through the provider's batch API (OpenAI Batch, Anthropic Message Batches) or a queue with priority tiers.",
  };
}

/* -------------------------------------------------------------------------- */
/* Rule 8: Agent tool bloat / large global context                            */
/* -------------------------------------------------------------------------- */

function findingForAgentConfig(cfg: AgentConfigFinding): Finding | undefined {
  if (cfg.issues.length === 0) return undefined;

  const isLarge = cfg.issues.includes("large_global_context");
  const manyMcp = cfg.issues.includes("many_mcp_servers");
  const isSecret = cfg.issues.includes("possible_secret");

  if (!isLarge && !manyMcp && !isSecret) return undefined;

  const title = isSecret
    ? `Possible secret in ${cfg.file}`
    : isLarge
      ? `Large global agent context: ${cfg.file}`
      : `Many MCP servers configured: ${cfg.file}`;

  const summary = isSecret
    ? `What looks like an API key or secret appears in ${cfg.file}. Rotate and move to env or a secret manager.`
    : isLarge
      ? `${cfg.file} is ~${cfg.estimated_tokens.toLocaleString()} tokens. If this is injected into every agent session, it's paid-for on every call.`
      : `${cfg.file} registers many MCP servers. Each tool's schema/description is typically part of the model's context.`;

  const recommendation = isSecret
    ? "Rotate the credential immediately. Move it to an environment variable or secret store and add a scan hook to CI."
    : isLarge
      ? "Split into smaller topic-specific files or skills. Keep global context under ~4,000 tokens. Load task-specific context on demand."
      : "Lazy-load MCP servers by task. Disable servers that are rarely used. Keep only ~3–5 enabled in global config.";

  return {
    id: "pending",
    title,
    summary,
    category: "agent_config",
    severity: isSecret ? "high" : "medium",
    savings_confidence: "low",
    implementation_effort: "hours",
    implementation_risk: isSecret ? "low" : "low",
    affected_callsites: [],
    evidence: [
      `${cfg.file}`,
      `~${cfg.estimated_tokens.toLocaleString()} tokens / ${cfg.bytes.toLocaleString()} bytes`,
    ],
    recommendation,
  };
}

/**
 * Reset in-memory dedupe state between runs. Called by analyze.
 */
export function resetRecommendationState(): void {
  delete (findingForMissingTelemetry as unknown as { _seen?: Set<string> })._seen;
}
