import crypto from "node:crypto";

export function shortHash(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}
