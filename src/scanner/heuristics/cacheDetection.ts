import type { Callsite } from "../../types.js";

const CACHE_HINTS = [
  /\bcache\b/i,
  /\bmemo(ize)?\b/i,
  /\blru_cache\b/i,
  /\bredis\b/i,
  /\bkv\.get\b/i,
  /\bkv\.set\b/i,
  /\bunstable_cache\b/i,
  /\brevalidate\b/i,
  /\bget_?from_?cache\b/i,
  /\bcached_?input\b/i,
  /\bprompt[_-]?cache/i,
  /\bupstash\b/i,
];

/**
 * Return true if any caching primitive appears in the same file or nearby.
 * This is a generous heuristic — false positives are OK because "no cache
 * detected" is a soft flag and the recommendation is to add caching.
 */
export function detectCache(source: string, cs: Callsite): boolean {
  for (const re of CACHE_HINTS) if (re.test(source)) return true;
  return false;
}
