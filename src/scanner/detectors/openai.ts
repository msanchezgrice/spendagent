import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect OpenAI SDK calls in JS/TS and Python.
 *
 * JS/TS:
 *   openai.chat.completions.create(...)
 *   openai.responses.create(...)
 *   openai.embeddings.create(...)
 *   openai.images.generate(...)
 *   openai.audio.*.create(...)
 *
 * Python:
 *   client.chat.completions.create(...)
 *   client.responses.create(...)
 *   client.embeddings.create(...)
 */
export function detectOpenAI(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];

  // Quick bail-out: if the file does not reference "openai" anywhere, skip.
  // Keep lenient — do not require the import because some repos re-export.
  if (!/openai/i.test(source)) return results;

  const patterns: Array<{
    regex: RegExp;
    operation: Callsite["operation"];
  }> = [
    { regex: /([a-zA-Z_$][\w$]*)\.chat\.completions\.create\s*\(/g, operation: "chat" },
    { regex: /([a-zA-Z_$][\w$]*)\.responses\.create\s*\(/g, operation: "responses" },
    { regex: /([a-zA-Z_$][\w$]*)\.embeddings\.create\s*\(/g, operation: "embedding" },
    { regex: /([a-zA-Z_$][\w$]*)\.images\.generate\s*\(/g, operation: "image" },
    { regex: /([a-zA-Z_$][\w$]*)\.audio\.transcriptions\.create\s*\(/g, operation: "audio" },
    { regex: /([a-zA-Z_$][\w$]*)\.audio\.speech\.create\s*\(/g, operation: "audio" },
    // Azure OpenAI / legacy completions
    { regex: /([a-zA-Z_$][\w$]*)\.completions\.create\s*\(/g, operation: "completion" },
  ];

  for (const { regex, operation } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      // Skip when the legacy `.completions.create` regex has really matched
      // the tail of `*.chat.completions.create` — in that case the captured
      // receiver identifier literally is `chat`.
      if (operation === "completion" && match[1] === "chat") continue;
      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);
      const modelArg = findArg("model", body);
      const cs = makeCallsite({
        file,
        source,
        matchIndex,
        matchedText: match[0].trim(),
        provider: "openai",
        operation,
        language,
        sdk: language === "python" ? "openai (python)" : "openai (node)",
        model: modelArg.value,
        modelExpression: modelArg.expression,
        modelIsDynamic: modelArg.dynamic,
      });
      results.push(cs);
    }
  }

  return results;
}
