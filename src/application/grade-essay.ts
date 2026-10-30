import { z } from "zod";
import { COMPETENCY_IDS, type CompetencyId, type GradingMode } from "@/domain/competencies";
import {
  ANNULMENT_LABEL,
  annulmentReasons,
  buildAnnotations,
  scoreAll,
  zeroScores,
  type GradingResult,
} from "@/domain/grading";
import type { IndexedChunk } from "@/domain/knowledge";
import {
  MARKING_SCHEMAS,
  ParecerSchema,
  withChunkApplications,
  type ChunkApplication,
  type MarkingsByCompetency,
} from "@/domain/markings";
import { analyzeText, numberParagraphs, normalizeEssay } from "@/domain/text-analysis";
import type { LlmClient, LlmUsage } from "./ports";
import { buildCompetencyPrompt, buildParecerPrompt, SYSTEM_PROMPT } from "./prompts";
import type { HybridRetriever, RetrievalResult } from "./rag/retriever";

export const GradeInputSchema = z.object({
  tema: z.string().trim().min(5, "Informe o tema da proposta."),
  texto: z.string().trim().min(20, "A redação está vazia ou curta demais."),
  textosMotivadores: z.string().default(""),
  mode: z.enum(["baseline", "rag"]),
});
export type GradeInput = z.input<typeof GradeInputSchema>;

export interface GradeDeps {
  llm: LlmClient;
  /** Obrigatório no modo RAG. */
  getRetriever: () => Promise<HybridRetriever>;
  embeddingModel: string;
}

export interface GradeOutput {
  result: GradingResult;
  retrieval: RetrievalResult | null;
}

/**
 * Caso de uso principal: corrige uma redação com ou sem RAG.
 *  1. análise determinística do texto;
 *  2. (RAG) recuperação híbrida por competência;
 *  3. marcações do LLM: C1, C2 e C4 em paralelo; C3 e C5 recebem a abordagem do tema da C2;
 *  4. notas pelas regras determinísticas da Grade Específica;
 *  5. parecer geral (com fallback determinístico).
 */
export async function gradeEssay(rawInput: GradeInput, deps: GradeDeps): Promise<GradeOutput> {
  const input = GradeInputSchema.parse(rawInput);
  const t0 = Date.now();
  const texto = normalizeEssay(input.texto);
  const stats = analyzeText(texto);
  const mode: GradingMode = input.mode;

  let retrieval: RetrievalResult | null = null;
  if (mode === "rag") {
    const retriever = await deps.getRetriever();
    retrieval = await retriever.retrieve({ tema: input.tema, texto, motivadores: input.textosMotivadores });
  }

  const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
  let calls = 0;
  const numbered = numberParagraphs(stats.paragraphs);

  const applications = {} as Record<CompetencyId, ChunkApplication[]>;

  const run = async <C extends CompetencyId>(c: C, theme?: MarkingsByCompetency[2]) => {
    const chunks = retrieval ? retrieval.selected[c] : null;
    const prompt = buildCompetencyPrompt({
      tema: input.tema,
      paragraphsNumbered: numbered,
      motivadores: input.textosMotivadores,
      competency: c,
      retrieved: chunks,
      situations: retrieval?.situations.filter((s) => s.competency === c),
      theme: theme ?? null,
      stats,
    });
    const ids = (chunks ?? []).map((ch) => ch.id);
    const schema = withChunkApplications(MARKING_SCHEMAS[c] as unknown as z.ZodObject, ids);
    const res = await deps.llm.generateJson({
      system: SYSTEM_PROMPT,
      prompt,
      schema: schema as unknown as z.ZodType<MarkingsByCompetency[C] & { aplicacaoTrechos?: ChunkApplication[] }>,
      label: `C${c}`,
    });
    calls++;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    const { aplicacaoTrechos, ...marking } = res.data;
    if (chunks) applications[c] = aplicacaoTrechos ?? [];
    return sanitizeChunkRefs(marking as unknown as MarkingsByCompetency[C], new Set(ids));
  };

  const [c1, c2, c4] = await Promise.all([run(1), run(2), run(4)]);
  const [c3, c5] = await Promise.all([run(3, c2), run(5, c2)]);
  const markings: MarkingsByCompetency = { 1: c1, 2: c2, 3: c3, 4: c4, 5: c5 };

  const reasons = annulmentReasons(stats, c2);
  const annulled = reasons.length ? { reasons, labels: reasons.map((r) => ANNULMENT_LABEL[r]) } : null;
  const scores = annulled ? zeroScores(annulled.labels.join("; ")) : scoreAll(markings, stats);
  const total = COMPETENCY_IDS.reduce((a, c) => a + scores[c].score, 0);

  const toRef = (ch: IndexedChunk, c: CompetencyId) => ({
    id: ch.id,
    title: ch.title,
    type: ch.type,
    rrf: retrieval?.byCompetency[c].find((s) => s.chunk.id === ch.id)?.rrf ?? 0,
  });

  const competencies = COMPETENCY_IDS.map((c) => ({
    ...scores[c],
    feedback: markings[c].feedback,
    retrieved: retrieval ? retrieval.selected[c].map((ch) => toRef(ch, c)) : [],
    ...(retrieval ? { applications: applications[c] ?? [] } : {}),
  }));

  // Parecer geral: chamada curta; se falhar, resume deterministicamente.
  let parecerGeral = "";
  const lines = competencies.map((c) => `C${c.competency}: ${c.score} — ${c.summary} ${c.feedback}`);
  try {
    const p = await deps.llm.generateJson({
      system: "Você é um avaliador do ENEM que redige pareceres claros e encorajadores.",
      prompt: buildParecerPrompt({ tema: input.tema, total, lines }),
      schema: ParecerSchema,
      label: "parecer",
    });
    calls++;
    usage.inputTokens += p.usage.inputTokens;
    usage.outputTokens += p.usage.outputTokens;
    parecerGeral = p.data.parecerGeral;
  } catch {
    parecerGeral = annulled
      ? `Redação anulada: ${annulled.labels.join("; ")}.`
      : `Nota total ${total}/1000. ${competencies.map((c) => `C${c.competency}: ${c.score}`).join(" · ")}.`;
  }

  const result: GradingResult = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode,
    model: deps.llm.model,
    embeddingModel: mode === "rag" ? deps.embeddingModel : null,
    tema: input.tema,
    texto,
    total,
    annulled,
    parecerGeral,
    competencies,
    annotations: buildAnnotations(markings),
    markings,
    stats: {
      wordCount: stats.wordCount,
      paragraphCount: stats.paragraphCount,
      estimatedLines: stats.estimatedLines,
      latencyMs: Date.now() - t0,
      llmCalls: calls,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    },
    situations: (retrieval?.situations ?? []).map((s) => ({ id: s.id, label: s.label, competency: s.competency })),
  };
  return { result, retrieval };
}

/** Remove citações a IDs que não estavam entre os trechos recuperados desta competência. */
function sanitizeChunkRefs<T>(marking: T, valid: Set<string>): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) =>
        k === "trechoRecuperadoId" ? [k, typeof v === "string" && valid.has(v) ? v : ""] : [k, walk(v)],
      ),
    );
  };
  return walk(marking) as T;
}
