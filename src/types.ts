export type Language = "typescript" | "javascript" | "python" | "unknown";

export type Provider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "litellm"
  | "vercel-ai"
  | "langchain"
  | "llamaindex"
  | "unknown";

export type Operation =
  | "chat"
  | "responses"
  | "completion"
  | "embedding"
  | "image"
  | "audio"
  | "rerank"
  | "vector_db"
  | "agent"
  | "unknown";

export type TaskHint =
  | "classification"
  | "extraction"
  | "summarization"
  | "coding"
  | "rag"
  | "agent_planning"
  | "eval"
  | "embedding"
  | "unknown";

export type RiskFlag =
  | "inside_loop"
  | "unbounded_loop"
  | "retry_without_limit"
  | "no_cache_detected"
  | "no_max_tokens"
  | "large_prompt_context"
  | "premium_model"
  | "embedding_recompute_risk"
  | "agent_tool_bloat"
  | "missing_usage_tags";

export type Confidence = "low" | "medium" | "high";

export interface Callsite {
  id: string;
  file: string;
  line: number;
  column?: number;

  language: Language;
  provider: Provider;
  sdk?: string;

  operation: Operation;

  model?: string;
  model_is_dynamic: boolean;
  model_expression?: string;

  function_name?: string;
  route_hint?: string;
  task_hint?: TaskHint;

  evidence: {
    matched_text: string;
    surrounding_code?: string;
  };

  risk_flags: RiskFlag[];
  confidence: Confidence;
}

export interface AgentConfigFinding {
  file: string;
  estimated_tokens: number;
  bytes: number;
  kind:
    | "claude_md"
    | "agents_md"
    | "cursorrules"
    | "cursor_rule"
    | "windsurfrules"
    | "mcp_config"
    | "prompt_file"
    | "other";
  issues: Array<
    | "large_global_context"
    | "many_mcp_servers"
    | "many_tools"
    | "possible_secret"
  >;
  detail?: string;
}

export interface ScanResult {
  repo: string;
  generated_at: string;
  files_scanned: number;
  callsites: Callsite[];
  agent_configs: AgentConfigFinding[];
}

export interface UsageRecord {
  id: string;
  timestamp?: string;
  provider: string;
  model: string;
  route?: string;
  feature?: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
  requests?: number;
  cost_usd?: number;
  source_file?: string;
  source_callsite_id?: string;
}

export interface NormalizedUsage {
  generated_at: string;
  days_covered: number;
  min_date?: string;
  max_date?: string;
  records: UsageRecord[];
}

export interface PricingModel {
  provider: string;
  model: string;
  input_per_1m: number;
  output_per_1m: number;
  cached_input_per_1m?: number;
  batch_input_multiplier?: number;
  batch_output_multiplier?: number;
  capabilities?: string[];
  quality_tier?: "frontier" | "premium" | "mid" | "cheap" | "oss";
  aliases?: string[];
}

export interface PricingCatalog {
  version: number;
  currency: string;
  unit: string;
  notes?: string;
  models: PricingModel[];
}

export type FindingCategory =
  | "model_switch"
  | "provider_switch"
  | "prompt_caching"
  | "semantic_cache"
  | "batching"
  | "context_reduction"
  | "retry_loop"
  | "fanout"
  | "embedding_optimization"
  | "agent_config"
  | "telemetry"
  | "hardware_break_even";

export interface SuggestedAlternative {
  provider: string;
  model: string;
  rationale: string;
  estimated_monthly_cost_usd?: number;
  estimated_monthly_savings_usd?: number;
  risk: "low" | "medium" | "high";
}

export interface PatchPlan {
  can_auto_patch: boolean;
  description: string;
  files_to_change: string[];
  steps: string[];
}

export interface Finding {
  id: string;
  title: string;
  summary: string;
  category: FindingCategory;
  severity: "info" | "low" | "medium" | "high";

  current_monthly_cost_usd?: number;
  projected_monthly_cost_usd?: number;
  estimated_monthly_savings_usd?: number;
  savings_low_usd?: number;
  savings_high_usd?: number;

  savings_confidence: Confidence;
  implementation_effort: "minutes" | "hours" | "days";
  implementation_risk: "low" | "medium" | "high";

  affected_callsites: string[];
  evidence: string[];
  recommendation: string;

  suggested_alternatives?: SuggestedAlternative[];
  patch_plan?: PatchPlan;
}

export interface UsageMapping {
  usage_index: number;
  callsite_id?: string;
  confidence: Confidence;
  reason: string;
  monthly_cost_usd: number;
}

export interface AnalysisResult {
  generated_at: string;
  repo: string;
  mode: "static-only" | "static-and-usage";
  pricing_source: string;

  summary: {
    llm_callsites: number;
    embedding_callsites: number;
    vector_db_callsites: number;
    agent_config_files: number;
    estimated_current_monthly_cost_usd?: number;
    estimated_potential_monthly_savings_low_usd?: number;
    estimated_potential_monthly_savings_high_usd?: number;
  };

  per_provider_cost_usd?: Record<string, number>;
  per_model_cost_usd?: Record<string, number>;
  per_callsite_cost_usd?: Record<string, number>;

  usage_mappings?: UsageMapping[];
  usage_confidence_note?: string;

  findings: Finding[];
  callsites: Callsite[];
  agent_configs: AgentConfigFinding[];
}

export interface AgentSpendConfig {
  version: number;
  repo: {
    include: string[];
    exclude: string[];
  };
  analysis: {
    monthly_request_default: number;
    avg_input_tokens_default: number;
    avg_output_tokens_default: number;
    confidence_floor_without_usage: Confidence;
  };
  recommendations: {
    enable_provider_switching: boolean;
    enable_open_source_suggestions: boolean;
    enable_hardware_break_even: boolean;
    enable_patch_plans: boolean;
  };
  privacy: {
    redact_env_vars: boolean;
    do_not_print_prompt_bodies: boolean;
    local_only: boolean;
  };
}
