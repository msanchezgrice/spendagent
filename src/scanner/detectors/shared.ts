import type { Callsite, Language, Operation, Provider } from "../../types.js";
import { indexToLine, surrounding } from "../../utils/lineNumbers.js";
import { shortHash } from "../../utils/hashing.js";

export interface DetectorInput {
  file: string;
  absPath: string;
  source: string;
  language: Language;
}

export interface MakeCallsiteInput {
  file: string;
  source: string;
  matchIndex: number;
  matchedText: string;
  provider: Provider;
  operation: Operation;
  language: Language;
  sdk?: string;
  model?: string;
  modelExpression?: string;
  modelIsDynamic?: boolean;
  functionName?: string;
}

export function makeCallsite(input: MakeCallsiteInput): Callsite {
  const { line, column } = indexToLine(input.source, input.matchIndex);
  const id = shortHash(
    `${input.file}:${line}:${input.provider}:${input.operation}:${input.matchedText}`,
  );
  return {
    id,
    file: input.file,
    line,
    column,
    language: input.language,
    provider: input.provider,
    sdk: input.sdk,
    operation: input.operation,
    model: input.model,
    model_is_dynamic: input.modelIsDynamic ?? false,
    model_expression: input.modelExpression,
    function_name: input.functionName,
    route_hint: routeHint(input.file),
    evidence: {
      matched_text: clip(input.matchedText, 160),
      surrounding_code: surrounding(input.source, line, 3),
    },
    risk_flags: [],
    confidence: input.model ? "medium" : "low",
  };
}

export function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

/**
 * Very lightweight route hint: use directory-based heuristics common in
 * Next.js/Express/Fastify/Flask layouts.
 */
export function routeHint(file: string): string | undefined {
  const f = file.replace(/\\/g, "/");
  // Next.js-style: app/api/foo/route.ts -> api/foo
  const appApi = f.match(/(?:^|\/)app\/(api\/[^/]+(?:\/[^/]+)*)\/route\.(t|j)sx?$/);
  if (appApi) return appApi[1];
  const pagesApi = f.match(/(?:^|\/)pages\/(api\/[^/]+(?:\/[^/]+)*)\.(t|j)sx?$/);
  if (pagesApi) return pagesApi[1];
  // /routes/ folders
  const routes = f.match(/(?:^|\/)routes\/([^/]+(?:\/[^/]+)*)\.(t|j|p)y?s?x?$/);
  if (routes) return routes[1];
  // /api/foo.ts, /jobs/foo.ts
  const flat = f.match(/(?:^|\/)(api|jobs|scripts|workers|crons)\/([^/.]+)/);
  if (flat) return `${flat[1]}/${flat[2]}`;
  return undefined;
}

/**
 * Extract a string-literal value for a named argument from a call-expression
 * body, e.g. findArg("model", "{ model: 'gpt-4o', temperature: 0 }") => "gpt-4o".
 * Returns both the value (if literal) and whether the source is dynamic.
 */
export function findArg(
  key: string,
  body: string,
): { value?: string; dynamic: boolean; expression?: string } {
  // Supports JS/TS object keys: model: "...", model : '...', and Python kwargs model="..."
  const literal = new RegExp(
    `\\b${escapeRegex(key)}\\s*[:=]\\s*(?:(?:f)?["'\`])([^"'\`]+?)(?:["'\`])`,
    "m",
  );
  const lit = body.match(literal);
  if (lit) return { value: lit[1], dynamic: false };

  const dynamic = new RegExp(`\\b${escapeRegex(key)}\\s*[:=]\\s*([^,}\\n\\)]+)`, "m");
  const dyn = body.match(dynamic);
  if (dyn) {
    return { dynamic: true, expression: dyn[1].trim() };
  }
  return { dynamic: false };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Given a match index, walk forward to find the first balanced call body
 * starting at the next "(" and returning the substring between it and its
 * matching ")". Handles nested parens, strings, template literals, and
 * simple comments. Returns an empty string if no body is found.
 */
export function captureCallBody(source: string, fromIndex: number): string {
  // Seek to first `(` after fromIndex, skipping whitespace.
  let i = fromIndex;
  while (i < source.length && source[i] !== "(") {
    // stop if we leave the statement
    if (source[i] === ";" || source[i] === "\n") {
      // allow whitespace newlines
      if (source[i] === "\n") {
        i++;
        continue;
      }
      return "";
    }
    i++;
  }
  if (i >= source.length) return "";
  const start = i + 1;
  let depth = 1;
  let j = start;
  let inString: string | null = null;
  while (j < source.length && depth > 0) {
    const ch = source[j];
    const prev = j > 0 ? source[j - 1] : "";
    if (inString) {
      if (ch === inString && prev !== "\\") inString = null;
      j++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      j++;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0) break;
    j++;
  }
  if (depth !== 0) return source.slice(start);
  return source.slice(start, j);
}
