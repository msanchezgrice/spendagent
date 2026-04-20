/**
 * Crude test: does the model name look like a frontier/premium tier model?
 * Used as a fast, lowercase heuristic independent of the pricing catalog.
 */
export function isPremiumModel(model: string): boolean {
  const m = model.toLowerCase();
  // Anthropic frontier
  if (m.includes("opus")) return true;
  if (m.includes("sonnet")) return true;
  // OpenAI premium / reasoning
  if (m.startsWith("gpt-4") && !m.includes("mini") && !m.includes("nano"))
    return true;
  if (m === "o1" || m.startsWith("o1-preview") || m === "o3") return true;
  if (m.startsWith("gpt-4.1") && !m.includes("mini") && !m.includes("nano"))
    return true;
  // Gemini pro
  if (m.includes("gemini") && m.includes("pro")) return true;
  return false;
}
