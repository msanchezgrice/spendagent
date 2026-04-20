import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect LiteLLM Python/JS usage.
 *
 *   litellm.completion(model="...", messages=[...])
 *   litellm.embedding(model="...", input="...")
 *   litellm.acompletion(...)
 */
export function detectLiteLLM(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (!/litellm/i.test(source)) return results;

  const patterns: Array<{ regex: RegExp; operation: Callsite["operation"] }> = [
    { regex: /\blitellm\.completion\s*\(/g, operation: "completion" },
    { regex: /\blitellm\.acompletion\s*\(/g, operation: "completion" },
    { regex: /\blitellm\.embedding\s*\(/g, operation: "embedding" },
    { regex: /\blitellm\.aembedding\s*\(/g, operation: "embedding" },
  ];

  for (const { regex, operation } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);
      const modelArg = findArg("model", body);

      results.push(
        makeCallsite({
          file,
          source,
          matchIndex,
          matchedText: match[0].trim(),
          provider: "litellm",
          operation,
          language,
          sdk: language === "python" ? "litellm (python)" : "litellm",
          model: modelArg.value,
          modelExpression: modelArg.expression,
          modelIsDynamic: modelArg.dynamic,
        }),
      );
    }
  }

  return results;
}
