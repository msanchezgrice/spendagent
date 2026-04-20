import type { Callsite } from "../../types.js";

/**
 * Heuristic: the call is inside a loop if any loop construct appears in the
 * source above the callsite *and within the same function/class scope*.
 *
 * We walk up to 50 lines backward, counting brace balance and checking each
 * line against a loop-keyword regex. We stop early when we cross a scope
 * boundary (function / class / top-level declaration) so that a `.map` in
 * an unrelated helper above our enclosing function does not trigger a false
 * positive.
 */

/** Lines that look like function / class / type boundaries. */
const SCOPE_BOUNDARY =
  /^\s*(?:export\s+(?:default\s+)?)?(?:default\s+)?(?:async\s+)?(?:function\s+\w+|def\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+\s*=|(?:const|let|var)\s+\w+\s*(?::\s*[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|function\b))/;

const LOOP_ON_SAME_LINE =
  /\.map\s*\(|\.forEach\s*\(|\.flatMap\s*\(|Promise\.all\s*\(|\bfor\s+\w+\s+in\b|\bfor\s*\(|\bwhile\s*\(/;

const LOOP_OPENER =
  /^\s*(?:for|while)\b|\.map\s*\(|\.forEach\s*\(|\.flatMap\s*\(|Promise\.all\s*\(|\basync\s+for\b/;

export function detectLoop(source: string, cs: Callsite): boolean {
  const lines = source.split("\n");
  const idx = cs.line - 1;
  if (idx < 0 || idx >= lines.length) return false;

  // Fast path: the exact same line contains a .map / list comp / for()
  const selfLine = lines[idx] ?? "";
  if (LOOP_ON_SAME_LINE.test(selfLine)) return true;

  // Walk up to 50 lines backward, stopping at the first line that looks like
  // a scope boundary (a new function/class/type declaration). That way a
  // `.map` in a sibling helper above our function cannot trigger.
  const windowStart = Math.max(0, idx - 50);
  const callIndent = indentOf(lines[idx] ?? "");
  let depthDelta = 0;

  for (let i = idx - 1; i >= windowStart; i--) {
    const line = lines[i];

    // Track brace balance so we know whether any loop keyword we see is
    // actually enclosing our callsite (rather than a peer block that closed
    // above us).
    for (const ch of line) {
      if (ch === "}") depthDelta++;
      else if (ch === "{") depthDelta--;
    }

    // Strip obvious string literals so loop keywords inside template
    // placeholders (e.g. `${arr.map(x => x.name)}`) do not count. This is a
    // conservative strip — we only remove complete single-line template
    // expressions and single-quoted / double-quoted strings on this line.
    const codeOnly = stripStrings(line);

    if (LOOP_OPENER.test(codeOnly) && indentOf(line) <= callIndent) {
      // JS/TS block loop: we're inside it only if the brace balance says
      // we're inside some block opened above our callsite. Without a
      // negative brace balance, the loop is a *sibling* above us — not
      // enclosing.
      if (depthDelta < 0) return true;
      // Python colon-form `for x in ...:` — indent-based, no braces
      if (
        /^\s*(for|while)\b[^{]*:\s*$/.test(codeOnly) &&
        indentOf(line) < callIndent
      ) {
        return true;
      }
    }

    // Scope boundary — stop walking above this line. If we've just entered
    // it (depthDelta already negative), this is our enclosing function. If
    // not, it's a sibling we should ignore.
    if (SCOPE_BOUNDARY.test(line) && indentOf(line) <= callIndent) break;
  }

  return false;
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  if (!m) return 0;
  return m[1].replace(/\t/g, "  ").length;
}

/**
 * Replace single-line string literals with spaces so a loop keyword inside
 * a string does not trigger our regex. We handle single-line `'...'`,
 * `"..."`, and `` `...` `` literals; multi-line template literals are not
 * perfectly handled but the common case (placeholder inside a template
 * string above the call) is covered — we blank out anything between
 * balanced `${ }` placeholders on the same line.
 */
function stripStrings(line: string): string {
  let out = line;
  // Blank `${ ... }` placeholders (non-greedy, same line)
  out = out.replace(/\$\{[^{}`]*\}/g, (m) => " ".repeat(m.length));
  // Blank quoted strings (no escape handling — fine for a loop heuristic)
  out = out.replace(/"[^"\n]*"/g, (m) => " ".repeat(m.length));
  out = out.replace(/'[^'\n]*'/g, (m) => " ".repeat(m.length));
  out = out.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
  return out;
}
