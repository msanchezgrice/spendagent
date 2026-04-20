import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect LlamaIndex usage in JS/TS and Python.
 *
 * Python:
 *   from llama_index.llms.openai import OpenAI as LlamaOpenAI
 *   OpenAI(model="gpt-4o")
 *   Settings.llm = OpenAI(model="...")
 *   Anthropic(model="...")
 */
export function detectLlamaIndex(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (!/llama_?index|llamaindex/i.test(source)) return results;

  const patterns: Array<{
    regex: RegExp;
    operation: Callsite["operation"];
    provider: Callsite["provider"];
  }> = [
    {
      regex: /\b(?:new\s+)?(?:Llama)?OpenAI\s*\(/g,
      operation: "chat",
      provider: "openai",
    },
    {
      regex: /\b(?:new\s+)?Anthropic\s*\(/g,
      operation: "chat",
      provider: "anthropic",
    },
    {
      regex: /\b(?:new\s+)?OpenAIEmbedding\s*\(/g,
      operation: "embedding",
      provider: "openai",
    },
  ];

  for (const { regex, operation, provider } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      // Require llama_index context to avoid double-matching vanilla OpenAI
      // instantiation. We look at a window around the match.
      const window = source.slice(
        Math.max(0, match.index - 400),
        Math.min(source.length, match.index + 200),
      );
      if (!/llama_?index|llamaindex|Settings\.llm|ServiceContext/i.test(window))
        continue;

      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);
      const modelArg = findArg("model", body);

      results.push(
        makeCallsite({
          file,
          source,
          matchIndex,
          matchedText: match[0].trim(),
          provider: "llamaindex",
          operation,
          language,
          sdk: `llamaindex (${provider})`,
          model: modelArg.value,
          modelExpression: modelArg.expression,
          modelIsDynamic: modelArg.dynamic && !modelArg.value,
        }),
      );
    }
  }

  return results;
}
