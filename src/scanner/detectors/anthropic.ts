import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect Anthropic SDK calls in JS/TS and Python.
 *
 * JS/TS:
 *   anthropic.messages.create(...)
 *   anthropic.messages.stream(...)
 *   anthropic.completions.create(...)
 *
 * Python:
 *   client.messages.create(...)
 */
export function detectAnthropic(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (!/anthropic|claude/i.test(source)) return results;

  const patterns: Array<{ regex: RegExp; operation: Callsite["operation"] }> = [
    { regex: /([a-zA-Z_$][\w$]*)\.messages\.create\s*\(/g, operation: "chat" },
    { regex: /([a-zA-Z_$][\w$]*)\.messages\.stream\s*\(/g, operation: "chat" },
    { regex: /([a-zA-Z_$][\w$]*)\.completions\.create\s*\(/g, operation: "completion" },
  ];

  // We want to avoid false positives on `openai.chat.completions.create` — but
  // the openai detector captures those separately. As a safety net, only emit a
  // callsite if the receiver identifier looks Anthropic-ish or the file
  // references Anthropic explicitly.
  const isAnthropicish = /anthropic|@anthropic-ai|claude/i.test(source);

  for (const { regex, operation } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const receiver = match[1];
      const looksAnthropic =
        /anthropic|claude/i.test(receiver) || isAnthropicish;
      if (!looksAnthropic) continue;

      // Don't double-count OpenAI-style `openai.chat.completions.create` —
      // that regex matches `.completions.create` too. Skip when preceded by
      // `.chat.` in source.
      const lookback = source.slice(Math.max(0, match.index - 20), match.index + 5);
      if (/\.chat\.completions\.create/.test(lookback + match[0])) continue;

      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);
      const modelArg = findArg("model", body);

      results.push(
        makeCallsite({
          file,
          source,
          matchIndex,
          matchedText: match[0].trim(),
          provider: "anthropic",
          operation,
          language,
          sdk:
            language === "python"
              ? "anthropic (python)"
              : "@anthropic-ai/sdk (node)",
          model: modelArg.value,
          modelExpression: modelArg.expression,
          modelIsDynamic: modelArg.dynamic,
        }),
      );
    }
  }

  return results;
}
