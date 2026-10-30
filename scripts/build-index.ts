/**
 * Gera o índice vetorial da base de conhecimento (chunks + embeddings).
 * Uso: pnpm kb:index
 */
import { buildKnowledgeIndex } from "../src/application/build-index";
import { COMPETENCY_IDS } from "../src/domain/competencies";
import { createEmbeddingProvider } from "../src/infrastructure/embeddings/providers";
import { getConfig } from "../src/infrastructure/config";
import { FileKnowledgeIndexRepository } from "../src/infrastructure/repositories";
import { KNOWLEDGE_CHUNKS } from "../src/knowledge";
import { loadEnv } from "./env";

loadEnv();
const config = getConfig();
const embeddings = createEmbeddingProvider(config);
console.log(`Indexando ${KNOWLEDGE_CHUNKS.length} chunks com ${embeddings.id} (${embeddings.model})...`);
if (embeddings.id === "fastembed") console.log("Na primeira execução o modelo (~2 GB) é baixado para .cache/fastembed.");
const t0 = Date.now();
const index = await buildKnowledgeIndex(KNOWLEDGE_CHUNKS, embeddings, new FileKnowledgeIndexRepository(config.paths.index));
console.log(`\nÍndice salvo em ${config.paths.index} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`);
console.log("Competência | Chunks | Regras | Casos-limite | Dimensão");
for (const c of COMPETENCY_IDS) {
  const cs = index.chunks.filter((x) => x.competency === c);
  console.log(`C${c}          | ${String(cs.length).padEnd(6)} | ${String(cs.filter((x) => x.type === "regra").length).padEnd(6)} | ${String(cs.filter((x) => x.type === "caso-limite").length).padEnd(12)} | ${index.dimension}`);
}
console.log(`Total       | ${index.chunks.length}`);
