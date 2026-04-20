import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect Vercel AI SDK usage.
 *
 *   import { generateText, streamText, generateObject, embed, embedMany } from "ai";
 *   import { openai } from "@ai-sdk/openai";
 *   import { anthropic } from "@ai-sdk/anthropic";
 *
 *   await generateText({ model: openai("gpt-4o-mini"), prompt: "..." });
 */
export function detectVercelAi(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (language === "python") return results;
  if (!/@ai-sdk|\bfrom\s+["']ai["']|generateText|streamText|generateObject|streamObject|embed\s*\(|embedMany/i.test(source))
    return results;

  const patterns: Array<{ regex: RegExp; operation: Callsite["operation"] }> = [
    { regex: /\bgenerateText\s*\(/g, operation: "chat" },
    { regex: /\bstreamText\s*\(/g, operation: "chat" },
    { regex: /\bgenerateObject\s*\(/g, operation: "chat" },
    { regex: /\bstreamObject\s*\(/g, operation: "chat" },
    { regex: /\bembed\s*\(/g, operation: "embedding" },
    { regex: /\bembedMany\s*\(/g, operation: "embedding" },
  ];

  for (const { regex, operation } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);

      // The `model:` argument is typically `openai("gpt-4o-mini")` or
      // `anthropic("claude-3-5-sonnet-latest")`. Extract the quoted model name
      // and the provider helper.
      let providerGuess = "vercel-ai" as Callsite["provider"];
      let modelString: string | undefined;
      let dynamic = false;
      let expression: string | undefined;

      const modelLine = findArg("model", body);
      if (modelLine.value) {
        modelString = modelLine.value;
      } else if (modelLine.expression) {
        expression = modelLine.expression;
        dynamic = true;
        const providerCall = modelLine.expression.match(
          /\b(openai|anthropic|google|mistral|cohere|groq|azure|perplexity|fireworks|bedrock|xai|replicate|togetherai)\b\s*\(\s*["']([^"']+)["']/,
        );
        if (providerCall) {
          const prov = providerCall[1];
          modelString = providerCall[2];
          dynamic = false;
          if (prov === "openai" || prov === "azure") providerGuess = "openai";
          else if (prov === "anthropic") providerGuess = "anthropic";
          else if (prov === "google") providerGuess = "gemini";
        }
      }

      results.push(
        makeCallsite({
          file,
          source,
          matchIndex,
          matchedText: match[0].trim(),
          provider: providerGuess,
          operation,
          language,
          sdk: "vercel-ai",
          model: modelString,
          modelExpression: expression,
          modelIsDynamic: dynamic,
        }),
      );
    }
  }

  return results;
}
