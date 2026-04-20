import type { Callsite } from "../../types.js";
import {
  type DetectorInput,
  makeCallsite,
  captureCallBody,
  findArg,
} from "./shared.js";

/**
 * Detect LangChain model instantiation.
 *
 * JS/TS:
 *   new ChatOpenAI({ model: "gpt-4o" })
 *   new ChatAnthropic({ model: "claude-3-5-sonnet" })
 *   new OpenAIEmbeddings({ model: "text-embedding-3-small" })
 *
 * Python:
 *   ChatOpenAI(model="gpt-4o")
 *   ChatAnthropic(model="claude-3-5-sonnet")
 *   OpenAIEmbeddings(model="...")
 */
export function detectLangChain(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];
  if (!/langchain|ChatOpenAI|ChatAnthropic|OpenAIEmbeddings|ChatGoogle/i.test(source))
    return results;

  const patterns: Array<{
    regex: RegExp;
    operation: Callsite["operation"];
    provider: Callsite["provider"];
  }> = [
    {
      regex: /\b(?:new\s+)?ChatOpenAI\s*\(/g,
      operation: "chat",
      provider: "openai",
    },
    {
      regex: /\b(?:new\s+)?ChatAnthropic\s*\(/g,
      operation: "chat",
      provider: "anthropic",
    },
    {
      regex: /\b(?:new\s+)?ChatGoogleGenerativeAI\s*\(/g,
      operation: "chat",
      provider: "gemini",
    },
    {
      regex: /\b(?:new\s+)?ChatVertexAI\s*\(/g,
      operation: "chat",
      provider: "gemini",
    },
    {
      regex: /\b(?:new\s+)?OpenAIEmbeddings\s*\(/g,
      operation: "embedding",
      provider: "openai",
    },
    {
      regex: /\b(?:new\s+)?VoyageEmbeddings\s*\(/g,
      operation: "embedding",
      provider: "unknown",
    },
  ];

  for (const { regex, operation, provider } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const matchIndex = match.index;
      const body = captureCallBody(source, matchIndex + match[0].length - 1);
      const modelArg = findArg("model", body);
      const modelName = modelArg.value ?? findArg("modelName", body).value;

      results.push(
        makeCallsite({
          file,
          source,
          matchIndex,
          matchedText: match[0].trim(),
          provider: "langchain",
          operation,
          language,
          sdk: `langchain (${provider})`,
          model: modelName,
          modelExpression: modelArg.expression,
          modelIsDynamic: modelArg.dynamic && !modelName,
        }),
      );
    }
  }

  return results;
}
