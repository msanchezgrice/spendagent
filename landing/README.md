# AgentSpend — Landing Page

Standalone, zero-build, single-file landing page for AgentSpend.

**Live:** [agentspend.vercel.app](https://agentspend.vercel.app)

## Preview locally

```bash
# From the repo root:
open landing/index.html

# or with any local server:
npx serve landing
# then open http://localhost:3000
```

## Deploy to Vercel

```bash
# Install the Vercel CLI if needed:
npm i -g vercel

# From the repo root, deploy just the landing page:
cd landing
vercel --prod
```

The included `vercel.json` handles security headers and clean URLs.

## Deploy to anything else

It's a single `index.html` with embedded CSS + JS and Google Font links. Drop it on Netlify, Cloudflare Pages, GitHub Pages, or any static host.

## Design notes

- **Aesthetic**: editorial financial audit. Cream ledger paper (`#f4f0e6`), deep ink (`#171512`), red pencil (`#b8321f`), hairline rules.
- **Type**: [Fraunces](https://fonts.google.com/specimen/Fraunces) (variable display serif, `opsz` + `SOFT` axes) paired with [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) for data.
- **No framework**, no build step, no tracking.
