import type { AgentSpendConfig } from "../types.js";

export const DEFAULT_CONFIG: AgentSpendConfig = {
  version: 1,
  repo: {
    include: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.cjs",
      "**/*.py",
      "CLAUDE.md",
      "AGENTS.md",
      ".cursorrules",
      ".cursor/rules/**",
      ".windsurfrules",
      "**/mcp.json",
      "**/.mcp.json",
      "**/claude_desktop_config.json",
      "prompts/**",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/out/**",
      "**/.next/**",
      "**/.nuxt/**",
      "**/.output/**",
      "**/.turbo/**",
      "**/.vercel/**",
      "**/.svelte-kit/**",
      "**/coverage/**",
      "**/venv/**",
      "**/.venv/**",
      "**/env/**",
      "**/__pycache__/**",
      "**/.agentspend/**",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/*.chunk.js",
      "**/*.map",
      "**/*.d.ts",
    ],
  },
  analysis: {
    monthly_request_default: 10000,
    avg_input_tokens_default: 1500,
    avg_output_tokens_default: 300,
    confidence_floor_without_usage: "low",
  },
  recommendations: {
    enable_provider_switching: true,
    enable_open_source_suggestions: true,
    enable_hardware_break_even: true,
    enable_patch_plans: true,
  },
  privacy: {
    redact_env_vars: true,
    do_not_print_prompt_bodies: true,
    local_only: true,
  },
};

export const DEFAULT_CONFIG_YAML = `version: 1

repo:
  include:
    - "**/*.ts"
    - "**/*.tsx"
    - "**/*.js"
    - "**/*.jsx"
    - "**/*.mjs"
    - "**/*.cjs"
    - "**/*.py"
    - "CLAUDE.md"
    - "AGENTS.md"
    - ".cursorrules"
    - ".cursor/rules/**"
    - ".windsurfrules"
    - "**/mcp.json"
    - "**/.mcp.json"
    - "**/claude_desktop_config.json"
    - "prompts/**"
  exclude:
    - "**/node_modules/**"
    - "**/.git/**"
    - "**/dist/**"
    - "**/build/**"
    - "**/out/**"
    - "**/.next/**"
    - "**/.nuxt/**"
    - "**/.output/**"
    - "**/.turbo/**"
    - "**/.vercel/**"
    - "**/.svelte-kit/**"
    - "**/coverage/**"
    - "**/venv/**"
    - "**/.venv/**"
    - "**/env/**"
    - "**/__pycache__/**"
    - "**/.agentspend/**"
    - "**/*.min.js"
    - "**/*.bundle.js"
    - "**/*.chunk.js"
    - "**/*.map"
    - "**/*.d.ts"

analysis:
  monthly_request_default: 10000
  avg_input_tokens_default: 1500
  avg_output_tokens_default: 300
  confidence_floor_without_usage: low

recommendations:
  enable_provider_switching: true
  enable_open_source_suggestions: true
  enable_hardware_break_even: true
  enable_patch_plans: true

privacy:
  redact_env_vars: true
  do_not_print_prompt_bodies: true
  local_only: true
`;
