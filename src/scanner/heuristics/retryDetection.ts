import type { Callsite } from "../../types.js";

const RETRY_UNBOUNDED = [
  /\bwhile\s*\(\s*true\s*\)/,
  /\bwhile\s+True\s*:/,
  /retryable\s*:\s*true/i,
];

const RETRY_BOUNDED = [
  /\bp-retry\b/i,
  /\bretry\s*\(\s*[^,]+,\s*\{[^}]*(retries|attempts)/i,
  /\bmaxRetries\b/i,
  /\bmax_retries\b/i,
  /\btenacity\b/i,
  /retryable.*retries/i,
];

/**
 * Return true if the file looks like it has retry logic without a retry limit.
 * Used to flag "retry_without_limit".
 */
export function detectRetry(source: string, cs: Callsite): boolean {
  const hasUnbounded = RETRY_UNBOUNDED.some((re) => re.test(source));
  const hasBounded = RETRY_BOUNDED.some((re) => re.test(source));
  return hasUnbounded && !hasBounded;
}
