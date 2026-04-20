import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect Google Gemini SDK calls.
 *
 * JS/TS @google/generative-ai:
 *   const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
 *   await model.generateContent(...)
 *   await model.generateContentStream(...)
 *
 * Python google-generativeai:
 *   genai.GenerativeModel(model_name="gemini-1.5-pro")
 *   model.generate_content(...)
 */
export function detectGemini(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (!/gemini|@google\/generative-ai|google-generativeai|genai/i.test(source))
    return results;

  // Primary: getGenerativeModel call carries the model name
  const getModelRegex =
    /\bgetGenerativeModel\s*\(|\bGenerativeModel\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = getModelRegex.exec(source)) !== null) {
    const matchIndex = match.index;
    const body = captureCallBody(source, matchIndex + match[0].length - 1);
    const modelArg =
      findArg("model", body).value !== undefined
        ? findArg("model", body)
        : findArg("model_name", body);

    results.push(
      makeCallsite({
        file,
        source,
        matchIndex,
        matchedText: match[0].trim(),
        provider: "gemini",
        operation: "chat",
        language,
        sdk:
          language === "python"
            ? "google-generativeai (python)"
            : "@google/generative-ai (node)",
        model: modelArg.value,
        modelExpression: modelArg.expression,
        modelIsDynamic: modelArg.dynamic,
      }),
    );
  }

  // Also capture generateContent calls that reference a variable-bound model
  const genContentRegex = /\b([a-zA-Z_$][\w$]*)\.generate(_)?[Cc]ontent(?:_stream)?\s*\(/g;
  while ((match = genContentRegex.exec(source)) !== null) {
    const receiver = match[1];
    if (!/model|gemini|llm/i.test(receiver)) continue;
    const matchIndex = match.index;
    results.push(
      makeCallsite({
        file,
        source,
        matchIndex,
        matchedText: match[0].trim(),
        provider: "gemini",
        operation: "chat",
        language,
        sdk:
          language === "python"
            ? "google-generativeai (python)"
            : "@google/generative-ai (node)",
        modelIsDynamic: true,
        modelExpression: receiver,
      }),
    );
  }

  return results;
}
