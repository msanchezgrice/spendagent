import fs from "node:fs";
import path from "node:path";

export function readText(p: string): string {
  return fs.readFileSync(p, "utf8");
}

export function readJson<T>(p: string): T {
  return JSON.parse(readText(p)) as T;
}

export function writeText(p: string, contents: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, contents, "utf8");
}

export function writeJson(p: string, data: unknown): void {
  writeText(p, JSON.stringify(data, null, 2));
}

export function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

export function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/**
 * Rough token estimate: ~4 characters per token for English prose.
 * This is intentionally crude — used only for reporting ballpark sizes.
 */
export function estimateTokens(text: string): number {
  return Math.round(text.length / 4);
}

/**
 * Detect language from file extension.
 */
export function detectLanguage(
  filePath: string,
): "typescript" | "javascript" | "python" | "unknown" {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts")
    return "typescript";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs")
    return "javascript";
  if (ext === ".py") return "python";
  return "unknown";
}
