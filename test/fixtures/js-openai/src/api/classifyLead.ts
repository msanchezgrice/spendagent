import OpenAI from "openai";

const openai = new OpenAI();

export async function classifyLead(leadText: string) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Classify this lead as hot, warm, or cold." },
      { role: "user", content: leadText },
    ],
    temperature: 0,
  });
  return res.choices[0]?.message?.content ?? "";
}
