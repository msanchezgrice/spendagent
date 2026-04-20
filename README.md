# AgentSpend

> Local AI/API spend auditor for codebases — find the expensive line of code.

AgentSpend scans your repo for LLM/API usage (OpenAI, Anthropic, Gemini, LiteLLM, Vercel AI SDK, LangChain, LlamaIndex, embeddings, vector DBs), imports optional usage data, and generates a ranked cost-savings report.

**Local-only by default.** AgentSpend never uploads code, prompts, or usage data.

- Website: [agentspend.vercel.app](https://agentspend.vercel.app)
- Source: [`landing/`](./landing/) (deployable to Vercel/Netlify as-is)

---

## For your coding agent (fastest path)

> **Paste the block below into the chat box of a coding agent (Claude Code, Cursor, Codex, OpenCode, Aider, Continue, etc.) — not into your terminal.** The block contains natural-language instructions the agent reads, plus the shell commands the agent will run on your behalf.

```text
Audit this repo for AI / API cost waste.

Run these two commands in the project root:
  npx -y github:msanchezgrice/spendagent init --repo .
  npx -y github:msanchezgrice/spendagent doctor --repo .

If a usage.csv exists, also run:
  npx -y github:msanchezgrice/spendagent doctor --repo . --usage ./usage.csv

Then read .agentspend/AGENT_SPEND_REPORT.md and give me:
  1. the three findings with the highest estimated savings
  2. for each: file + line, current model, cheapest safe alternative
  3. the smallest safe patch I can ship today for the top one

Do not upload the repo or usage data anywhere. Local only.
```

`npx -y github:msanchezgrice/spendagent` clones this repo, triggers `npm run build` automatically via the `prepare` hook, and runs the CLI. First run takes ~20s.

### If you just want to run it in your terminal (no agent)

```bash
npx -y github:msanchezgrice/spendagent init   --repo .
npx -y github:msanchezgrice/spendagent doctor --repo .
open .agentspend/AGENT_SPEND_REPORT.md
```

---

## Install (local dev)

```bash
npm install
npm run build
npm link    # exposes `agentspend` globally
```

Or run without linking:

```bash
npx tsx src/cli/index.ts doctor --repo .
```

Or via the `npm run dev -- ...` alias:

```bash
npm run dev -- doctor --repo .
```

## Quick start

```bash
agentspend init
agentspend doctor --repo .
```

With usage data for real dollar estimates:

```bash
agentspend doctor --repo . --usage ./usage.csv
```

With explicit scenario assumptions when you have no usage file:

```bash
agentspend doctor \
  --repo . \
  --monthly-requests 100000 \
  --avg-input-tokens 1500 \
  --avg-output-tokens 300
```

## Outputs

```text
.agentspend/
  config.yml
  pricing.models.json
  hardware.example.json
  scan.json
  usage.normalized.json     (if --usage was supplied)
  analysis.json
  report.json
  AGENT_SPEND_REPORT.md
```

Open `AGENT_SPEND_REPORT.md` — it is the product.

## What AgentSpend detects

Call patterns:

- OpenAI: `openai.chat.completions.create`, `openai.responses.create`, `openai.embeddings.create`, `openai.images.generate`, `openai.audio.*`
- Anthropic: `anthropic.messages.create`, `anthropic.messages.stream`
- Google Gemini: `getGenerativeModel`, `GenerativeModel(...)`, `model.generateContent(...)`
- LiteLLM: `litellm.completion`, `litellm.embedding`
- Vercel AI SDK: `generateText`, `streamText`, `generateObject`, `embed`, `embedMany` (with `@ai-sdk/*` provider helpers)
- LangChain JS/TS/Python: `ChatOpenAI`, `ChatAnthropic`, `ChatGoogleGenerativeAI`, `OpenAIEmbeddings`
- LlamaIndex: `OpenAI(...)`, `Anthropic(...)`, `OpenAIEmbedding(...)` in LlamaIndex context
- Vector DBs: Pinecone, Chroma, Weaviate, Qdrant, Milvus, Supabase pgvector, Elasticsearch

Agent/config files:

- `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/*`, `.windsurfrules`, `mcp.json`, `.mcp.json`, `claude_desktop_config.json`, `prompts/**`

Waste patterns (heuristic):

- premium model used for a likely classification / extraction / summarization route
- no caching visible on deterministic tasks
- LLM / embedding call inside a loop
- embedding recomputation risk
- background jobs that could use the provider's batch API (50% cheaper)
- large global agent context (> ~4k tokens in `CLAUDE.md` / `AGENTS.md`)
- many MCP servers in a single config
- missing usage/metadata tags for future cost attribution
- possible committed secret (`sk-...`, `xox...`, `AKIA...`)

## Usage CSV format (generic)

```csv
timestamp,provider,model,route,feature,input_tokens,output_tokens,cached_input_tokens,requests,cost_usd
2026-04-01,anthropic,claude-3-5-sonnet,api/summarize,summarization,100000,12000,0,500,
2026-04-01,openai,gpt-4.1-mini,jobs/extract,extraction,250000,20000,0,900,
```

Required: `provider`, `model`, `input_tokens`, `output_tokens`.  
Optional: `timestamp`, `route`, `feature`, `cached_input_tokens`, `requests`, `cost_usd`, `latency_ms`, `user_id`, `team`, `environment`.

If `cost_usd` is present, AgentSpend uses it as the source of truth for current spend. If absent, it estimates from the local pricing catalog.

## Pricing catalog

Lives at `.agentspend/pricing.models.json` (seeded on `agentspend init`). Review it before trusting dollar numbers — provider pricing changes frequently.

## CLI commands

```text
agentspend init                      create .agentspend/ config files
agentspend scan                      scan repo only
agentspend import-usage <csv>        normalize a usage file
agentspend analyze                   combine scan + usage + pricing
agentspend report                    render Markdown + JSON report
agentspend doctor                    run the full pipeline
agentspend hardware                  rough hardware/self-hosting break-even
```

Flags of note:

- `--repo <dir>` — override repo root (default: `.`)
- `--usage <path>` — attach a usage CSV (enables measured spend + mapped savings)
- `--monthly-requests <n>` / `--avg-input-tokens <n>` / `--avg-output-tokens <n>` — scenario assumptions when usage data is missing
- `-v, --verbose` — print debug lines

## SKILL wrapper

Point a Claude / Codex / Cursor session at `skills/agentspend/SKILL.md` to teach it how to run AgentSpend and interpret the report.

## Scope

v1 is deliberately conservative:

- Regex-based scanning (no full AST yet). False positives and false negatives are possible; the report is a *starting point for human review*, not an auto-apply engine.
- `generic-csv` usage format only. `litellm` / `langfuse` / `helicone` importers are stubbed.
- No patch auto-apply. `patch_plan` steps are printed, never executed.
- No network calls. Everything runs locally against files on disk.

## License

MIT.
