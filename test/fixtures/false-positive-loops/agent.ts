// Regression fixture for loop-detector false positives.
//
// This file intentionally puts a `.map(...)` in an UNRELATED helper above the
// real callsite. The detector must NOT flag the callsite as "inside_loop"
// just because a stray `.map(` appears 50 lines above it inside a different
// function or inside a template-literal placeholder.

import Anthropic from "@anthropic-ai/sdk";

// --- Unrelated helper that uses .map on an array ---
function parsePermissionDenials(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const denials = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      if (typeof record.tool_name !== "string") return null;
      return record.tool_name;
    })
    .filter((entry): entry is string => Boolean(entry));
  if (!denials.length) return null;
  return `Permission denied for tools: ${denials.join(", ")}`;
}

// --- Unrelated helper with a template literal containing `.map(...)` ---
async function generateSuggestions(scan: { competitors: { name: string }[] }) {
  const client = new Anthropic();
  const prompt = `Competitors: ${scan.competitors.map((c) => c.name).join(", ")}`;
  // The call below is NOT inside a loop — the `.map` above is inside a
  // template literal and is a peer expression, not an enclosing iterator.
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  return response;
}

// --- The single TRUE positive — retry loop ---
async function retryingCall(client: Anthropic, prompt: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });
    if (response) return response;
  }
}
