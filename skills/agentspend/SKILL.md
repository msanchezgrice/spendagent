---
name: agentspend
description: Audit a local codebase for AI/API spend. Invoke when the user wants to reduce LLM/API/agent costs, review an AgentSpend report, or triage the most expensive AI callsites in a repo.
---

# AgentSpend Cost Audit Skill

Use this skill when the user asks to reduce AI/API/agent costs in a codebase, or when they hand off an AgentSpend report.

## Workflow

1. Make sure `agentspend` is available (fall back to `npx agentspend` or `pnpm agentspend` if the global binary isn't installed).
2. Run a local scan:

   ```bash
   agentspend doctor --repo .
   ```

3. If the user has usage data (OpenAI/Anthropic console export, LiteLLM logs, Helicone/Langfuse export), run:

   ```bash
   agentspend doctor --repo . --usage ./usage.csv
   ```

4. Read the generated files (local-only, never uploaded):

   ```text
   .agentspend/AGENT_SPEND_REPORT.md
   .agentspend/report.json
   ```

5. Summarize to the user:
   - top 3 savings opportunities
   - confidence level and effort for each
   - exact files to inspect
   - suggested next change (one small, safe patch)

6. Do **not** claim precise savings unless a usage CSV was imported. If `mode` is `static-only`, speak in scenarios: "if this route handles ~X requests/month, expect ~$Y".

7. Prefer safe, reversible changes first:
   - add telemetry / feature tags
   - add request-level cache keyed by model + input hash
   - reduce prompt / global-context size
   - route simple tasks to cheaper models with the current model as fallback
   - batch background jobs via the provider's batch API
   - add budget limits (e.g. LiteLLM router, hard `max_tokens`)

8. Before changing a model or provider, recommend running a small eval sample (50–200 items) to confirm quality holds.

9. Never paste real prompt bodies, secrets, or env values into your output. The CLI already respects `privacy.redact_env_vars` and `privacy.do_not_print_prompt_bodies` — keep that discipline in your replies too.

## Useful follow-up commands

- `agentspend scan --repo .` — scan only, no analysis
- `agentspend import-usage ./usage.csv --repo .` — normalize usage for later runs
- `agentspend analyze --repo .` — re-run findings with updated pricing
- `agentspend hardware --repo .` — rough hardware/self-hosting break-even
