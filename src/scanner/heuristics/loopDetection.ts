import type { Callsite } from "../../types.js";

/**
 * Heuristic: the call is inside a loop if the window of source above the
 * callsite contains a loop keyword at a shallower indent than the callsite,
 * without a closing brace in between. This is approximate but cheap.
 *
 * Recognizes:
 *   for (...) { ... callsite ... }
 *   while (...) { ... callsite ... }
 *   arr.map((x) => { ... callsite ... })
 *   await Promise.all(arr.map(...))
 *   Python: for x in ...: / while:
 *   [list comprehensions using `for ... in` on one line containing callsite]
 */
export function detectLoop(source: string, cs: Callsite): boolean {
  const lines = source.split("\n");
  const idx = cs.line - 1;
  if (idx < 0 || idx >= lines.length) return false;

  // Look up to 50 lines backwards
  const window = lines.slice(Math.max(0, idx - 50), idx + 1);

  // Fast path: same line contains .map / list comp
  const selfLine = lines[idx] ?? "";
  if (/\.map\s*\(|\.forEach\s*\(|Promise\.all\s*\(|for\s+\w+\s+in\b/.test(selfLine)) {
    return true;
  }

  const callIndent = indentOf(lines[idx] ?? "");

  // Track open/close braces from older lines down to current
  let depthDelta = 0;
  let found = false;

  for (let i = window.length - 1; i >= 0; i--) {
    const line = window[i];

    // Count closing then opening so we can track whether we're still inside
    // a block that was opened earlier.
    for (const ch of line) {
      if (ch === "}") depthDelta++;
      else if (ch === "{") depthDelta--;
    }

    const loopPattern =
      /^\s*(?:for|while)\b|\.map\s*\(|\.forEach\s*\(|\.flatMap\s*\(|Promise\.all\s*\(|\basync\s+for\b/;
    if (loopPattern.test(line) && indentOf(line) <= callIndent) {
      // JS/TS block opened above; we're inside if the brace balance puts us
      // inside (depthDelta < 0 == more opens than closes above).
      if (depthDelta < 0) {
        found = true;
        break;
      }
      // Python `for x in ...:` – indent-based
      if (/^\s*(for|while)\b[^{]*:\s*$/.test(line) && indentOf(line) < callIndent) {
        found = true;
        break;
      }
      // Single-line .map((x) => callsite)
      if (/\.map\s*\(|\.forEach\s*\(|\.flatMap\s*\(|Promise\.all\s*\(/.test(line)) {
        found = true;
        break;
      }
    }
  }

  return found;
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  if (!m) return 0;
  return m[1].replace(/\t/g, "  ").length;
}
