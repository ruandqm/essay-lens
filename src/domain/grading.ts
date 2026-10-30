import { COMPETENCY_IDS, type CompetencyId, type GradingMode } from "./competencies";
import type { ChunkApplication, MarkingsByCompetency } from "./markings";
import { scoreC1, scoreC2, scoreC3, scoreC4, scoreC5 } from "./scoring/competencies";
import type { CompetencyScore } from "./scoring/types";
import { MIN_LINES, type TextStats } from "./text-analysis";

export type AnnulmentReason =
  | "texto-insuficiente"
  | "fuga-ao-tema"
  | "nao-atende-tipo"
  | "parte-desconectada";

export const ANNULMENT_LABEL: Record<AnnulmentReason, string> = {
  "texto-insuficiente": "Texto insuficiente (até 7 linhas)",
  "fuga-ao-tema": "Fuga total ao tema",
  "nao-atende-tipo": "Não atendimento ao tipo dissertativo-argumentativo",
  "parte-desconectada": "Parte do texto deliberadamente desconectada do tema",
};

export function annulmentReasons(stats: TextStats, c2?: MarkingsByCompetency[2]): AnnulmentReason[] {
  const reasons: AnnulmentReason[] = [];
  if (stats.estimatedLines < MIN_LINES) reasons.push("texto-insuficiente");
  if (c2?.abordagemTema === "fuga") reasons.push("fuga-ao-tema");
  if (c2?.naoAtendeTipoTextual) reasons.push("nao-atende-tipo");
  if (c2?.parteDesconectada) reasons.push("parte-desconectada");
  return reasons;
}

/** Aplica as regras determinísticas da Grade Específica às marcações do modelo. */
export function scoreAll(markings: MarkingsByCompetency, stats: TextStats): Record<CompetencyId, CompetencyScore> {
  const theme = markings[2].abordagemTema;
  return {
    1: scoreC1(markings[1], stats),
    2: scoreC2(markings[2]),
    3: scoreC3(markings[3], theme),
    4: scoreC4(markings[4], stats),
    5: scoreC5(markings[5], theme),
  };
}

export function zeroScores(reason: string): Record<CompetencyId, CompetencyScore> {
  return Object.fromEntries(
    COMPETENCY_IDS.map((id) => [
      id,
      { competency: id, level: 0, score: 0, axes: [], restricting: [], summary: `Redação anulada: ${reason}.` },
    ]),
  ) as unknown as Record<CompetencyId, CompetencyScore>;
}

// ───────────────────────── Anotações inline ─────────────────────────

export type AnnotationKind = "erro" | "alerta" | "destaque";

export interface Annotation {
  competency: CompetencyId;
  kind: AnnotationKind;
  quote: string;
  label: string;
  comment: string;
  /** Preenchido quando a decisão foi fundamentada por um trecho recuperado (RAG). */
  chunkId: string | null;
}

const ref = (id: string) => (id && id.trim() ? id.trim() : null);

/** Converte as marcações em anotações posicionáveis sobre o texto. */
export function buildAnnotations(m: MarkingsByCompetency): Annotation[] {
  const out: Annotation[] = [];
  for (const d of m[1].desvios) {
    out.push({
      competency: 1,
      kind: "erro",
      quote: d.trecho,
      label: `Desvio · ${d.categoria}`,
      comment: `${d.explicacao}${d.correcao ? ` Correção: “${d.correcao}”.` : ""}`,
      chunkId: ref(d.trechoRecuperadoId),
    });
  }
  for (const f of m[1].falhasEstrutura) {
    out.push({
      competency: 1,
      kind: "alerta",
      quote: f.trecho,
      label: `Estrutura sintática · ${f.tipo}`,
      comment: f.explicacao,
      chunkId: ref(f.trechoRecuperadoId),
    });
  }
  for (const r of m[2].repertorios) {
    const good = r.legitimado && r.pertinente && r.usoProdutivo && !r.baseadoTextosMotivadores;
    out.push({
      competency: 2,
      kind: good ? "destaque" : "alerta",
      quote: r.trecho,
      label: good ? "Repertório produtivo" : "Repertório",
      comment: `${r.descricao}. ${r.explicacao}`,
      chunkId: ref(r.trechoRecuperadoId),
    });
  }
  for (const f of m[3].falhasProjeto) {
    out.push({
      competency: 3,
      kind: f.gravidade === "falha" ? "alerta" : "destaque",
      quote: f.trecho,
      label: f.gravidade === "falha" ? "Falha de projeto" : "Deslize pontual",
      comment: f.descricao,
      chunkId: ref(f.trechoRecuperadoId),
    });
  }
  for (const a of m[3].argumentos) {
    if (a.desenvolvido) continue;
    out.push({
      competency: 3,
      kind: "alerta",
      quote: a.trecho,
      label: "Argumento sem desenvolvimento",
      comment: a.explicacao,
      chunkId: ref(a.trechoRecuperadoId),
    });
  }
  for (const e of m[4].elementosCoesivos) {
    out.push({
      competency: 4,
      kind: e.adequado ? "destaque" : "erro",
      quote: e.trecho,
      label: e.adequado
        ? `Coesivo ${e.posicao === "interparagrafo" ? "entre parágrafos" : "no parágrafo"}`
        : "Inadequação coesiva",
      comment: e.explicacao,
      chunkId: ref(e.trechoRecuperadoId),
    });
  }
  for (const p of m[5].propostas) {
    const parts: [string, { presente: boolean; trecho: string }][] = [
      ["Ação", p.acao],
      ["Agente", p.agente],
      ["Modo/meio", p.modoMeio],
      ["Efeito", p.efeito],
      ["Detalhamento", p.detalhamento],
    ];
    for (const [label, el] of parts) {
      if (!el.presente || !el.trecho) continue;
      const nulo = "nulo" in el && (el as { nulo: boolean }).nulo;
      out.push({
        competency: 5,
        kind: nulo ? "alerta" : p.condicional ? "alerta" : "destaque",
        quote: el.trecho,
        label: `${label}${nulo ? " (nulo)" : ""}`,
        comment: nulo
          ? `Elemento nulo: genérico demais para ser contabilizado.`
          : p.condicional
            ? "Elemento de proposta construída com oração condicional (limitada ao nível 2)."
            : `Elemento válido da proposta de intervenção.`,
        chunkId: ref(p.trechoRecuperadoId),
      });
    }
  }
  if (m[5].desrespeitoDireitosHumanos.ocorre && m[5].desrespeitoDireitosHumanos.trecho) {
    out.push({
      competency: 5,
      kind: "erro",
      quote: m[5].desrespeitoDireitosHumanos.trecho,
      label: "Desrespeito aos direitos humanos",
      comment: m[5].desrespeitoDireitosHumanos.explicacao,
      chunkId: null,
    });
  }
  return out.filter((a) => a.quote.trim().length > 0);
}

// ───────────────────────── Resultado ─────────────────────────

export interface RetrievedChunkRef {
  id: string;
  title: string;
  type: "regra" | "caso-limite";
  rrf: number;
}

export interface CompetencyResult extends CompetencyScore {
  feedback: string;
  retrieved: RetrievedChunkRef[];
  /** Modo RAG: como cada trecho recuperado foi confrontado com a redação. */
  applications?: ChunkApplication[];
}

export interface GradingResult {
  id: string;
  createdAt: string;
  mode: GradingMode;
  model: string;
  embeddingModel: string | null;
  tema: string;
  texto: string;
  total: number;
  annulled: { reasons: AnnulmentReason[]; labels: string[] } | null;
  parecerGeral: string;
  competencies: CompetencyResult[];
  annotations: Annotation[];
  markings: MarkingsByCompetency | null;
  stats: {
    wordCount: number;
    paragraphCount: number;
    estimatedLines: number;
    latencyMs: number;
    llmCalls: number;
    inputTokens: number;
    outputTokens: number;
  };
  situations: { id: string; label: string; competency: CompetencyId }[];
}
