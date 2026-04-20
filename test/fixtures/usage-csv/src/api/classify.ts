import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function classify(leadText: string) {
  const res = await anthropic.messages.create({
    model: "claude-3-5-sonnet-latest",
    max_tokens: 64,
    messages: [
      { role: "user", content: `Classify: ${leadText}` },
    ],
  });
  return res.content;
}
