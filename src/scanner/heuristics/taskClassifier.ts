import path from "node:path";
import type { Callsite, TaskHint } from "../../types.js";

interface ClassifierSignal {
  pattern: RegExp;
  hint: TaskHint;
  weight: number;
}

const SIGNALS: ClassifierSignal[] = [
  // classification
  { pattern: /\bclassif(y|ication|ier)/i, hint: "classification", weight: 3 },
  { pattern: /\bcategoriz/i, hint: "classification", weight: 2 },
  { pattern: /\blabel(ing|s)?\b/i, hint: "classification", weight: 2 },
  { pattern: /\bscore(_|:)?\s*(intent|lead|risk)/i, hint: "classification", weight: 2 },
  { pattern: /\btriage\b/i, hint: "classification", weight: 2 },
  // extraction
  { pattern: /\bextract/i, hint: "extraction", weight: 3 },
  { pattern: /\bparse_?(json|structured|fields)/i, hint: "extraction", weight: 2 },
  { pattern: /\bresponse_?format\s*[:=]\s*(?:json|\{)/i, hint: "extraction", weight: 1 },
  { pattern: /\bstructured_?output/i, hint: "extraction", weight: 1 },
  // summarization
  { pattern: /\bsummariz(e|ation|er)/i, hint: "summarization", weight: 3 },
  { pattern: /\btl;?dr\b/i, hint: "summarization", weight: 2 },
  { pattern: /\bdigest\b/i, hint: "summarization", weight: 1 },
  // coding
  { pattern: /\bwrite[_ -]?code\b/i, hint: "coding", weight: 2 },
  { pattern: /\bcodegen\b/i, hint: "coding", weight: 3 },
  { pattern: /\brefactor\b/i, hint: "coding", weight: 2 },
  { pattern: /\bdiff\b.*\bapply\b/i, hint: "coding", weight: 1 },
  // rag
  { pattern: /\bretriev/i, hint: "rag", weight: 2 },
  { pattern: /\bvector.*search\b/i, hint: "rag", weight: 2 },
  { pattern: /\bsimilarity_search\b/i, hint: "rag", weight: 3 },
  { pattern: /\brag\b/i, hint: "rag", weight: 2 },
  // agent planning
  { pattern: /\bagent(s|ic)?\b/i, hint: "agent_planning", weight: 2 },
  { pattern: /\bplan(ner|ning)?\b/i, hint: "agent_planning", weight: 2 },
  { pattern: /\btool_?call/i, hint: "agent_planning", weight: 1 },
  // eval
  { pattern: /\beval(uat)?(s|ion|or)?\b/i, hint: "eval", weight: 2 },
  { pattern: /\bjudg(e|ing)\b/i, hint: "eval", weight: 1 },
];

export function classifyTask(
  source: string,
  cs: Callsite,
): TaskHint | undefined {
  if (cs.operation === "embedding") return "embedding";

  // Consider the file path and a window around the callsite.
  const file = cs.file.replace(/\\/g, "/").toLowerCase();
  const base = path.basename(file);
  const windowStart = Math.max(0, indexOfLine(source, cs.line) - 600);
  const windowEnd = Math.min(source.length, indexOfLine(source, cs.line) + 600);
  const window = source.slice(windowStart, windowEnd);

  const haystacks = [file, base, window].join("\n");

  const totals = new Map<TaskHint, number>();
  for (const signal of SIGNALS) {
    if (signal.pattern.test(haystacks)) {
      totals.set(signal.hint, (totals.get(signal.hint) ?? 0) + signal.weight);
    }
  }

  if (totals.size === 0) return undefined;

  let bestHint: TaskHint | undefined;
  let bestScore = 0;
  for (const [hint, score] of totals) {
    if (score > bestScore) {
      bestHint = hint;
      bestScore = score;
    }
  }
  return bestHint;
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
