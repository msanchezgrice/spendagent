import type { AnalysisResult, Callsite, Finding } from "../types.js";

export function renderMarkdownReport(a: AnalysisResult): string {
  const lines: string[] = [];
  const date = a.generated_at.slice(0, 10);
  lines.push(`# AgentSpend Report`);
  lines.push(``);
  lines.push(`Generated: ${date}`);
  lines.push(`Repo: ${a.repo}`);
  lines.push(`Mode: ${a.mode}`);
  lines.push(`Pricing: ${a.pricing_source}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`Detected:`);
  lines.push(`- ${a.summary.llm_callsites} LLM call sites`);
  lines.push(`- ${a.summary.embedding_callsites} embedding call sites`);
  lines.push(`- ${a.summary.vector_db_callsites} vector DB integrations`);
  lines.push(`- ${a.summary.agent_config_files} agent/config files`);
  lines.push(``);

  if (a.summary.estimated_current_monthly_cost_usd !== undefined) {
    lines.push(
      `Estimated current monthly AI/API spend: ${fmtUsd(a.summary.estimated_current_monthly_cost_usd)}`,
    );
    if (
      a.summary.estimated_potential_monthly_savings_low_usd !== undefined &&
      a.summary.estimated_potential_monthly_savings_high_usd !== undefined
    ) {
      lines.push(
        `Estimated potential savings: ${fmtUsd(a.summary.estimated_potential_monthly_savings_low_usd)}–${fmtUsd(a.summary.estimated_potential_monthly_savings_high_usd)}/mo`,
      );
    }
  } else {
    lines.push(
      `Estimated current monthly spend: unknown (no usage data provided)`,
    );
    lines.push(
      `Run again with \`--usage usage.csv\` for dollar estimates and mapped savings.`,
    );
  }

  if (a.usage_confidence_note) {
    lines.push(``);
    lines.push(`> ${a.usage_confidence_note}`);
  }

  /* ---- Top findings ---- */

  lines.push(``);
  lines.push(`## Top Recommendations`);
  lines.push(``);
  if (a.findings.length === 0) {
    lines.push(`No findings. Nice work — nothing obvious to cut.`);
  }
  for (const f of a.findings) {
    lines.push(renderFinding(f, a));
  }

  /* ---- Per-provider / model ---- */

  if (a.per_provider_cost_usd && Object.keys(a.per_provider_cost_usd).length) {
    lines.push(`## Spend by Provider`);
    lines.push(``);
    lines.push(`| Provider | Monthly Cost |`);
    lines.push(`|---|---:|`);
    for (const [p, v] of sortDesc(a.per_provider_cost_usd)) {
      lines.push(`| ${p} | ${fmtUsd(v)} |`);
    }
    lines.push(``);
  }

  if (a.per_model_cost_usd && Object.keys(a.per_model_cost_usd).length) {
    lines.push(`## Spend by Model`);
    lines.push(``);
    lines.push(`| Model | Monthly Cost |`);
    lines.push(`|---|---:|`);
    for (const [m, v] of sortDesc(a.per_model_cost_usd).slice(0, 20)) {
      lines.push(`| ${m} | ${fmtUsd(v)} |`);
    }
    lines.push(``);
  }

  /* ---- All callsites ---- */

  lines.push(`## All Detected Callsites`);
  lines.push(``);
  if (a.callsites.length === 0) {
    lines.push(`No LLM/API callsites detected.`);
  } else {
    lines.push(
      `| ID | File | Line | Provider | Model | Operation | Task | Risk Flags |`,
    );
    lines.push(`|---|---|---:|---|---|---|---|---|`);
    for (const cs of a.callsites) {
      lines.push(
        `| ${cs.id} | \`${cs.file}\` | ${cs.line} | ${cs.provider} | ${cs.model ?? (cs.model_is_dynamic ? "_(dynamic)_" : "_(unknown)_")} | ${cs.operation} | ${cs.task_hint ?? "-"} | ${cs.risk_flags.join(", ") || "-"} |`,
      );
    }
  }
  lines.push(``);

  /* ---- Agent configs ---- */

  if (a.agent_configs.length) {
    lines.push(`## Agent Config Files`);
    lines.push(``);
    lines.push(`| File | Kind | Est. Tokens | Issues |`);
    lines.push(`|---|---|---:|---|`);
    for (const ac of a.agent_configs) {
      lines.push(
        `| \`${ac.file}\` | ${ac.kind} | ${ac.estimated_tokens.toLocaleString()} | ${ac.issues.join(", ") || "-"} |`,
      );
    }
    lines.push(``);
  }

  /* ---- Usage mapping confidence ---- */

  if (a.usage_mappings && a.usage_mappings.length) {
    lines.push(`## Usage Mapping`);
    lines.push(``);
    const mapped = a.usage_mappings.filter((m) => m.callsite_id).length;
    const total = a.usage_mappings.length;
    lines.push(
      `Mapped ${mapped} / ${total} usage rows to code callsites. Confidence is reported per finding.`,
    );
    lines.push(``);
  }

  /* ---- Assumptions ---- */

  lines.push(`## Assumptions`);
  lines.push(``);
  lines.push(`- Pricing loaded from ${a.pricing_source}.`);
  lines.push(
    `- Scanner uses regex heuristics, not a full AST. Verify findings before acting on them.`,
  );
  lines.push(`- Review pricing before making financial decisions.`);
  if (a.mode === "static-only") {
    lines.push(
      `- No usage data supplied. Dollar numbers are scenario estimates, not measured spend.`,
    );
  }
  lines.push(``);

  return lines.join("\n");
}

function renderFinding(f: Finding, a: AnalysisResult): string {
  const out: string[] = [];
  out.push(`### ${f.id}: ${f.title}`);
  out.push(``);
  const parts: string[] = [];
  parts.push(`Category: \`${f.category}\``);
  parts.push(`Severity: \`${f.severity}\``);
  if (f.estimated_monthly_savings_usd !== undefined) {
    parts.push(
      `Estimated savings: ${fmtUsd(f.estimated_monthly_savings_usd)}/mo`,
    );
  }
  parts.push(`Confidence: \`${f.savings_confidence}\``);
  parts.push(`Effort: \`${f.implementation_effort}\``);
  parts.push(`Risk: \`${f.implementation_risk}\``);
  out.push(parts.join(" · "));
  out.push(``);
  out.push(f.summary);
  out.push(``);

  if (f.evidence.length) {
    out.push(`Evidence:`);
    for (const e of f.evidence) out.push(`- ${e}`);
    out.push(``);
  }

  out.push(`Recommendation: ${f.recommendation}`);
  out.push(``);

  if (f.suggested_alternatives && f.suggested_alternatives.length) {
    out.push(`Suggested alternatives:`);
    f.suggested_alternatives.forEach((alt, i) => {
      const cost =
        alt.estimated_monthly_cost_usd !== undefined
          ? ` — est. ${fmtUsd(alt.estimated_monthly_cost_usd)}/mo`
          : "";
      const save =
        alt.estimated_monthly_savings_usd !== undefined
          ? `, saves ${fmtUsd(alt.estimated_monthly_savings_usd)}/mo`
          : "";
      out.push(
        `${i + 1}. ${alt.provider}/${alt.model}${cost}${save} · risk \`${alt.risk}\` · ${alt.rationale}`,
      );
    });
    out.push(``);
  }

  if (f.patch_plan) {
    out.push(`Patch plan:`);
    for (const step of f.patch_plan.steps) out.push(`- ${step}`);
    out.push(``);
  }

  out.push(`---`);
  out.push(``);
  return out.join("\n");
}

function fmtUsd(n: number): string {
  const rounded = Math.round(n);
  if (Math.abs(n) < 1) return `$${n.toFixed(2)}`;
  return `$${rounded.toLocaleString()}`;
}

function sortDesc<T extends Record<string, number>>(
  r: T,
): Array<[string, number]> {
  return Object.entries(r).sort((a, b) => b[1] - a[1]);
}
