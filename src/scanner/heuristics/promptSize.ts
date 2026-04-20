import type { Callsite } from "../../types.js";

/**
 * True if the callsite (or its enclosing call body) appears to specify a
 * max_tokens / maxOutputTokens argument. Used to flag `no_max_tokens`.
 */
export function detectMaxTokens(source: string, cs: Callsite): boolean {
  const idx = indexOfLine(source, cs.line);
  const win = source.slice(idx, Math.min(source.length, idx + 2000));
  return /\b(max_tokens|maxTokens|max_output_tokens|maxOutputTokens|max_completion_tokens)\s*[:=]\s*\d+/.test(
    win,
  );
}

/**
 * Heuristic: the callsite is likely injecting a large static context if the
 * file contains very long string literals or imports known to be big
 * prompts/system messages.
 */
export function detectLargeContext(source: string, cs: Callsite): boolean {
  // Look for string literals > 4000 chars anywhere in the file. We do not try
  // to match opening/closing quotes exactly — just flag any quoted run that's
  // obviously huge.
  const bigDouble = /"([^"\\]|\\.){4000,}"/;
  const bigSingle = /'([^'\\]|\\.){4000,}'/;
  const bigTpl = /`([^`\\]|\\.){4000,}`/;
  if (bigDouble.test(source) || bigSingle.test(source) || bigTpl.test(source))
    return true;
  // Look for readFile of markdown / prompt files, heuristic
  if (/readFileSync\([^)]*\.(?:md|txt|prompt)/i.test(source)) return true;
  if (/Path\([^)]*\.(?:md|txt|prompt)[^)]*\)\.read_text/.test(source))
    return true;
  return false;
}

function indexOfLine(source: string, line: number): number {
  let i = 0;
  let current = 1;
  while (i < source.length && current < line) {
    if (source.charCodeAt(i) === 10) current++;
    i++;
  }
  return i;
}
