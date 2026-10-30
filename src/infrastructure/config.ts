import path from "node:path";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== "" ? n : fallback;
};

/** Configuração lida das variáveis de ambiente (.env.local). */
export function getConfig() {
  const root = process.cwd();
  return {
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
    temperature: num(process.env.GEMINI_TEMPERATURE, 0),
    maxConcurrency: Math.max(1, num(process.env.GEMINI_MAX_CONCURRENCY, 4)),
    rateLimitMaxWaitMs: Math.max(10, num(process.env.GEMINI_RATE_LIMIT_MAX_WAIT, 120)) * 1000,
    experimentRateLimitPauses: Math.max(0, num(process.env.EXPERIMENT_RATE_LIMIT_PAUSES, 8)),
    embeddingProvider: (process.env.EMBEDDING_PROVIDER?.trim() || "fastembed") as "fastembed" | "gemini",
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001",
    rag: {
      topK: num(process.env.RAG_TOP_K, 5),
      minDenseZ: num(process.env.RAG_MIN_DENSE_Z, 1.0),
      bm25MaxRank: num(process.env.RAG_BM25_MAX_RANK, 3),
      rrfK: num(process.env.RAG_RRF_K, 60),
    },
    paths: {
      index: path.join(root, "data", "index", "knowledge-index.json"),
      dataset: path.join(root, "data", "experiments", "dataset.json"),
      runs: path.join(root, "data", "experiments", "runs"),
      fastembedCache: path.join(root, ".cache", "fastembed"),
    },
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
