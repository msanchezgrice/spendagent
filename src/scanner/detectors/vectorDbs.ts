import type { Callsite } from "../../types.js";
import { type DetectorInput, makeCallsite } from "./shared.js";

/**
 * Detect common vector DB client instantiation. This is intentionally coarse;
 * the goal is to surface that the repo uses a vector DB so recommendations
 * about embedding reuse/persistence make sense.
 */
export function detectVectorDb(input: DetectorInput): Callsite[] {
  const { source, file, language } = input;
  const results: Callsite[] = [];

  const patterns: Array<{ regex: RegExp; sdk: string }> = [
    { regex: /\bnew\s+Pinecone\s*\(/g, sdk: "pinecone" },
    { regex: /\bPinecone\s*\(/g, sdk: "pinecone" },
    { regex: /\bnew\s+ChromaClient\s*\(/g, sdk: "chroma" },
    { regex: /\bchromadb\.Client\s*\(/g, sdk: "chroma" },
    { regex: /\bweaviate\.Client\s*\(/g, sdk: "weaviate" },
    { regex: /\bQdrantClient\s*\(/g, sdk: "qdrant" },
    { regex: /\bMilvusClient\s*\(/g, sdk: "milvus" },
    { regex: /\bturso|@libsql\/client|@neondatabase\/serverless/g, sdk: "sql-backed" },
    { regex: /\bsupabase\.from\(["'][^"']+["']\)\.select\(["'][^"']*embedding/g, sdk: "supabase-vector" },
    { regex: /\bfaiss(\.|_)/g, sdk: "faiss" },
    { regex: /\bElasticsearch\s*\(/g, sdk: "elasticsearch" },
  ];

  for (const { regex, sdk } of patterns) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      results.push(
        makeCallsite({
          file,
          source,
          matchIndex: match.index,
          matchedText: match[0].trim(),
          provider: "unknown",
          operation: "vector_db",
          language,
          sdk,
        }),
      );
    }
  }

  return results;
}
