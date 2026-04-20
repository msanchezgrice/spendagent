export interface LineInfo {
  line: number;
  column: number;
}

/**
 * Convert a character index in `source` into a 1-based line number and column.
 */
export function indexToLine(source: string, index: number): LineInfo {
  let line = 1;
  let lastNewline = -1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: index - lastNewline };
}

/**
 * Return the surrounding lines around a given line number (inclusive range).
 */
export function surrounding(
  source: string,
  lineNumber: number,
  pad = 2,
): string {
  const lines = source.split("\n");
  const start = Math.max(0, lineNumber - 1 - pad);
  const end = Math.min(lines.length, lineNumber - 1 + pad + 1);
  return lines.slice(start, end).join("\n");
}

/**
 * Get a single line of text (1-indexed) from source.
 */
export function getLine(source: string, lineNumber: number): string {
  const lines = source.split("\n");
  return lines[lineNumber - 1] ?? "";
}
