import path from "node:path";
import type { AgentConfigFinding } from "../../types.js";
import { estimateTokens } from "../../utils/filesystem.js";

const LARGE_CONTEXT_TOKENS = 4000;
const VERY_LARGE_CONTEXT_TOKENS = 10000;

export interface AgentConfigInput {
  file: string;
  source: string;
}

export function detectAgentConfig(
  input: AgentConfigInput,
): AgentConfigFinding | undefined {
  const base = path.basename(input.file);
  const dir = input.file.replace(/\\/g, "/");
  const bytes = Buffer.byteLength(input.source, "utf8");
  const tokens = estimateTokens(input.source);

  let kind: AgentConfigFinding["kind"] | undefined;
  if (base === "CLAUDE.md") kind = "claude_md";
  else if (base === "AGENTS.md") kind = "agents_md";
  else if (base === ".cursorrules") kind = "cursorrules";
  else if (dir.includes(".cursor/rules/")) kind = "cursor_rule";
  else if (base === ".windsurfrules") kind = "windsurfrules";
  else if (base === "mcp.json" || base === ".mcp.json") kind = "mcp_config";
  else if (base === "claude_desktop_config.json") kind = "mcp_config";
  else if (dir.includes("/prompts/")) kind = "prompt_file";

  if (!kind) return undefined;

  const issues: AgentConfigFinding["issues"] = [];

  if (kind === "mcp_config") {
    try {
      const parsed = JSON.parse(input.source) as {
        mcpServers?: Record<string, unknown>;
      };
      const serverCount = parsed.mcpServers
        ? Object.keys(parsed.mcpServers).length
        : 0;
      if (serverCount >= 6) issues.push("many_mcp_servers");
    } catch {
      // ignore malformed JSON
    }
  } else {
    if (tokens >= VERY_LARGE_CONTEXT_TOKENS) {
      issues.push("large_global_context");
    } else if (tokens >= LARGE_CONTEXT_TOKENS && (kind === "claude_md" || kind === "agents_md")) {
      issues.push("large_global_context");
    }
  }

  // Secret heuristic: sk- prefixed OpenAI-style keys etc.
  if (
    /\b(sk-[a-z0-9]{20,}|xox[abps]-[a-z0-9]{10,}|AKIA[0-9A-Z]{16})\b/i.test(
      input.source,
    )
  ) {
    issues.push("possible_secret");
  }

  return {
    file: input.file,
    estimated_tokens: tokens,
    bytes,
    kind,
    issues,
  };
}
