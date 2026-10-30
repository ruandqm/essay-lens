import { COMPETENCY_IDS, type CompetencyId } from "@/domain/competencies";
import { chunkSearchText, type IndexedChunk, type KnowledgeIndex } from "@/domain/knowledge";
import { mean, stdDev } from "@/domain/metrics";
import type { EmbeddingProvider } from "../ports";
import { bm25Scores, buildBm25, type Bm25Index } from "./bm25";
import { buildSituationContext, detectSituations, type DetectedSituation } from "./situations";

export interface RetrievalConfig {
  topK: number;
  minDenseZ: number;
  bm25MaxRank: number;
  rrfK: number;
}

export interface ScoredChunk {
  chunk: IndexedChunk;
  /** Cosseno (máximo entre redação inteira e parágrafos). */
  dense: number;
  denseZ: number;
  denseRank: number;
  bm25: number;
  bm25Rank: number | null;
  routeHits: string[];
  routeRank: number | null;
  rrf: number;
  /** Atingiu o limiar de relevância em ao menos um canal. */
  eligible: boolean;
  /** Roteado por situação de alta precisão: tem prioridade nas vagas do top-k. */
  routed: boolean;
  selected: boolean;
}

export interface RetrievalResult {
  situations: DetectedSituation[];
  byCompetency: Record<CompetencyId, ScoredChunk[]>;
  selected: Record<CompetencyId, IndexedChunk[]>;
  latencyMs: number;
}

export const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/** Consultas densas de uma redação: o texto inteiro (com o tema) e cada parágrafo. */
export const essayQueries = (tema: string, paragraphs: string[]) => [`${tema}\n${paragraphs.join("\n")}`, ...paragraphs];

/** Similaridade de um chunk com a redação: a maior entre as consultas. */
export const maxCosine = (queries: number[][], v: number[]) => Math.max(...queries.map((q) => cosine(q, v)));

/**
 * Recuperação híbrida:
 *  (i) similaridade densa (cosseno) normalizada em z-score dentro da competência;
 *  (ii) BM25 lexical;
 *  (iii) roteamento por situações detectadas na redação;
 * fundidos por Reciprocal Rank Fusion. Trechos que não atingem o limiar de
 * relevância em nenhum canal ficam fora do contexto. O roteamento por situações
 * de alta precisão direciona a recuperação: esses trechos têm prioridade nas vagas do top-k.
 */
export class HybridRetriever {
  private bm25 = new Map<CompetencyId, { index: Bm25Index; chunks: IndexedChunk[] }>();

  constructor(
    private readonly index: KnowledgeIndex,
    private readonly embeddings: EmbeddingProvider,
    private readonly config: RetrievalConfig,
  ) {
    for (const c of COMPETENCY_IDS) {
      const chunks = index.chunks.filter((ch) => ch.competency === c);
      this.bm25.set(c, { index: buildBm25(chunks.map(chunkSearchText)), chunks });
    }
  }

  async retrieve(input: { tema: string; texto: string; motivadores?: string }): Promise<RetrievalResult> {
    const t0 = Date.now();
    const ctx = buildSituationContext(input.texto, input.motivadores ?? "");
    const situations = detectSituations(ctx);
    const situationIds = new Set(situations.map((s) => s.id));
    const prioritySituations = new Set(situations.filter((s) => s.priority).map((s) => s.id));

    // A redação inteira é embutida; parágrafos também, pois o modelo trunca textos longos
    // e a proposta de intervenção costuma estar no fim. Similaridade = máximo entre eles.
    const qVecs = await this.embeddings.embedQueries(essayQueries(input.tema, ctx.paragraphs));
    const lexicalQuery = `${input.tema}\n${input.texto}`;

    const byCompetency = {} as Record<CompetencyId, ScoredChunk[]>;
    const selected = {} as Record<CompetencyId, IndexedChunk[]>;
    const { topK, minDenseZ, bm25MaxRank, rrfK } = this.config;

    for (const c of COMPETENCY_IDS) {
      const { index, chunks } = this.bm25.get(c)!;
      const dense = chunks.map((ch) => maxCosine(qVecs, ch.embedding));
      const mu = mean(dense);
      const sd = stdDev(dense) || 1;
      const lex = bm25Scores(index, lexicalQuery);
      const routes = chunks.map((ch) => ch.situations.filter((s) => situationIds.has(s)));

      const rankOf = (scores: number[], valid: (i: number) => boolean) => {
        const order = scores
          .map((s, i) => ({ s, i }))
          .filter(({ i }) => valid(i))
          .sort((a, b) => b.s - a.s);
        const ranks = new Map<number, number>();
        order.forEach(({ i }, r) => ranks.set(i, r + 1));
        return ranks;
      };
      const denseRanks = rankOf(dense, () => true);
      const lexRanks = rankOf(lex, (i) => lex[i]! > 0);
      // Desempate do roteamento pela similaridade densa.
      const routeRanks = rankOf(
        routes.map((r, i) => r.length + dense[i]! * 1e-3),
        (i) => routes[i]!.length > 0,
      );

      const scored: ScoredChunk[] = chunks.map((chunk, i) => {
        const dr = denseRanks.get(i)!;
        const lr = lexRanks.get(i) ?? null;
        const rr = routeRanks.get(i) ?? null;
        const denseZ = (dense[i]! - mu) / sd;
        const rrf = 1 / (rrfK + dr) + (lr ? 1 / (rrfK + lr) : 0) + (rr ? 1 / (rrfK + rr) : 0);
        const eligible = denseZ >= minDenseZ || (lr !== null && lr <= bm25MaxRank) || rr !== null;
        return {
          chunk,
          dense: dense[i]!,
          denseZ,
          denseRank: dr,
          bm25: lex[i]!,
          bm25Rank: lr,
          routeHits: routes[i]!,
          routeRank: rr,
          rrf,
          eligible,
          routed: routes[i]!.some((r) => prioritySituations.has(r)),
          selected: false,
        };
      });
      scored.sort((a, b) => b.rrf - a.rrf);
      // Primeiro os roteados por situação de alta precisão (pelo RRF), depois os demais elegíveis.
      const routedFirst = scored.filter((s) => s.routed);
      for (const s of [...routedFirst, ...scored.filter((s) => !s.routed && s.eligible)].slice(0, topK)) s.selected = true;
      byCompetency[c] = scored;
      selected[c] = [...routedFirst, ...scored.filter((s) => !s.routed)].filter((s) => s.selected).map((s) => s.chunk);
    }
    return { situations, byCompetency, selected, latencyMs: Date.now() - t0 };
  }
}
