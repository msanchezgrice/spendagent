import OpenAI from "openai";

const openai = new OpenAI();

export async function embedAll(chunks: string[]) {
  const out: number[][] = [];
  for (const chunk of chunks) {
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk,
    });
    out.push(res.data[0].embedding);
  }
  return out;
}
