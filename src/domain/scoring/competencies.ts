import type { Level } from "../competencies";
import type { C1Marking, C2Marking, C3Marking, C4Marking, C5Marking } from "../markings";
import type { TextStats } from "../text-analysis";
import { C1_CRITERIA, C3_CRITERIA, C4_CRITERIA, per300 } from "./criteria";
import { buildScore, type CompetencyScore, type ScoringAxis } from "./types";

export type ThemeApproach = C2Marking["abordagemTema"];

// ───────────────────────── Competência I ─────────────────────────
// Grade: 0 inexistente · 1 deficitária COM muitos desvios · 2 deficitária OU muitos ·
// 3 regular E alguns · 4 boa E poucos · 5 excelente (≤1 falha) E ≤2 desvios.

export function scoreC1(m: C1Marking, stats: TextStats): CompetencyScore {
  const desvios = m.desvios.length;
  const falhas = m.falhasEstrutura.length;
  const desviosNorm = per300(desvios, stats.wordCount);
  const falhasNorm = per300(falhas, stats.wordCount);

  let desvioAxis: ScoringAxis;
  if (desvios <= C1_CRITERIA.maxDesviosNivel5) {
    desvioAxis = axis("desvios", "Desvios", String(desvios), "no máximo dois desvios", 5);
  } else if (desviosNorm <= C1_CRITERIA.desviosPoucosAte) {
    desvioAxis = axis("desvios", "Desvios", String(desvios), "poucos desvios", 4);
  } else if (desviosNorm <= C1_CRITERIA.desviosAlgunsAte) {
    desvioAxis = axis("desvios", "Desvios", String(desvios), "alguns desvios", 3);
  } else {
    desvioAxis = axis("desvios", "Desvios", String(desvios), "muitos desvios", 2);
  }

  let structAxis: ScoringAxis;
  const value = String(falhas);
  if (m.estruturaSintaticaInexistente) {
    structAxis = axis("estrutura", "Estrutura sintática", value, "estrutura sintática inexistente", 0);
  } else if (m.fluidezComprometida) {
    structAxis = axis("estrutura", "Estrutura sintática", value, "estrutura sintática deficitária", 2);
  } else if (stats.singleSentenceDominant) {
    structAxis = axis(
      "estrutura",
      "Estrutura sintática",
      value,
      "estrutura sintática regular (predomínio de parágrafos de período único)",
      3,
    );
  } else if (falhas <= C1_CRITERIA.maxFalhasNivel5 && m.construcaoComplexa) {
    structAxis = axis("estrutura", "Estrutura sintática", value, "estrutura sintática excelente", 5);
  } else if (falhasNorm <= C1_CRITERIA.falhasBoaAte) {
    structAxis = axis("estrutura", "Estrutura sintática", value, "estrutura sintática boa", 4);
  } else {
    structAxis = axis("estrutura", "Estrutura sintática", value, "estrutura sintática regular", 3);
  }

  const axes = [desvioAxis, structAxis];
  // Caso especial do nível 1: deficitária COM muitos desvios.
  if (structAxis.maxLevel === 2 && desvioAxis.maxLevel === 2) return buildScore(1, axes, 1);
  return buildScore(1, axes);
}

// ───────────────────────── Competência II ─────────────────────────
// Grade: 1 tangência OU aglomerado OU traços constantes · 2 completa E (2 embrionárias OU
// conclusão incompleta) — muita cópia não passa daqui · 3 completa E ≤1 embrionária E
// repertório motivador/não legitimado/não pertinente · 4 completa E nenhuma embrionária E
// legitimado e pertinente sem uso produtivo · 5 idem COM uso produtivo.

export function repertoireLevel(r: C2Marking["repertorios"][number]): Level {
  if (r.baseadoTextosMotivadores || !r.legitimado || !r.pertinente) return 3;
  return r.usoProdutivo ? 5 : 4;
}

export function scoreC2(m: C2Marking): CompetencyScore {
  const tema: ScoringAxis =
    m.abordagemTema === "completa"
      ? axis("tema", "Abordagem do tema", "completa", "abordagem completa do tema", 5)
      : m.abordagemTema === "tangente"
        ? axis("tema", "Abordagem do tema", "tangente", "tangência ao tema", 1)
        : axis("tema", "Abordagem do tema", "fuga", "fuga ao tema", 0);

  const tipo: ScoringAxis = m.aglomeradoPalavras
    ? axis("tipo", "Tipo textual", "aglomerado", "texto composto por aglomerado de palavras", 1)
    : m.tracosConstantesOutrosTipos
      ? axis("tipo", "Tipo textual", "traços de outros tipos", "traços constantes de outros tipos textuais", 1)
      : axis("tipo", "Tipo textual", "dissertativo-argumentativo", "domínio do tipo textual", 5);

  const embrionarias = [m.introducaoEmbrionaria, m.desenvolvimentoEmbrionario, m.conclusaoEmbrionaria].filter(
    Boolean,
  ).length;
  const estrutura: ScoringAxis =
    embrionarias >= 2
      ? axis("partes", "Partes do texto", `${embrionarias} embrionárias`, "3 partes do texto (2 delas embrionárias)", 2)
      : m.conclusaoFraseIncompleta
        ? axis("partes", "Partes do texto", "conclusão incompleta", "conclusão finalizada por frase incompleta", 2)
        : embrionarias === 1
          ? axis("partes", "Partes do texto", "1 embrionária", "3 partes do texto (1 pode ser embrionária)", 3)
          : axis("partes", "Partes do texto", "nenhuma embrionária", "3 partes do texto (nenhuma embrionária)", 5);

  const copia: ScoringAxis =
    m.copiaTextosMotivadores === "muitosTrechos"
      ? axis("copia", "Cópia dos motivadores", "muitos trechos", "muitos trechos de cópia dos textos motivadores", 2)
      : axis(
          "copia",
          "Cópia dos motivadores",
          m.copiaTextosMotivadores === "pontual" ? "pontual" : "nenhuma",
          "sem muitos trechos de cópia",
          5,
        );

  // Repertório: vale o MELHOR repertório presente (não se avalia predominância).
  const best = m.repertorios.reduce<Level>((acc, r) => Math.max(acc, repertoireLevel(r)) as Level, 3);
  const repCategory =
    best === 5
      ? "repertório legitimado e pertinente, com uso produtivo"
      : best === 4
        ? "repertório legitimado e pertinente, sem uso produtivo"
        : m.repertorios.length === 0
          ? "sem repertório além do senso comum"
          : "repertório baseado nos motivadores, não legitimado ou não pertinente";
  const repertorio = axis("repertorio", "Repertório", `${m.repertorios.length} identificado(s)`, repCategory, best);

  return buildScore(2, [tema, tipo, estrutura, copia, repertorio]);
}

// ───────────────────────── Competência III ─────────────────────────
// Grade: 0 tangente E sem direção · 1 tangente E com direção OU completa E sem direção ·
// 2 projeto com muitas falhas E sem desenvolvimento (contradição grave não passa daqui) ·
// 3 algumas falhas E desenvolvimento de algumas · 4 poucas falhas E maior parte ·
// 5 projeto estratégico E desenvolvimento em todo o texto (admite deslizes).

export function scoreC3(m: C3Marking, theme: ThemeApproach): CompetencyScore {
  const axes: ScoringAxis[] = [];

  if (theme !== "completa") {
    axes.push(
      axis(
        "tema",
        "Tema e direção",
        `${theme === "fuga" ? "fuga" : "tangente"}, ${m.comDirecao ? "com" : "sem"} direção`,
        m.comDirecao ? "tangente ao tema e com direção" : "tangente ao tema e sem direção",
        theme === "fuga" ? 0 : m.comDirecao ? 1 : 0,
      ),
    );
  } else if (!m.comDirecao) {
    axes.push(axis("tema", "Tema e direção", "completa, sem direção", "abordagem completa e sem direção", 1));
  } else {
    axes.push(axis("tema", "Tema e direção", "completa, com direção", "abordagem completa e com direção", 5));
  }

  if (m.contradicaoGrave.ocorre) {
    axes.push(axis("contradicao", "Contradição grave", "sim", "contradição grave invalida o ponto de vista", 2));
  }

  const falhas = m.falhasProjeto.filter((f) => f.gravidade === "falha").length;
  const deslizes = m.falhasProjeto.length - falhas;
  const projectValue = `${falhas} falha(s)${deslizes ? `, ${deslizes} deslize(s)` : ""}`;
  axes.push(
    falhas === 0
      ? axis("projeto", "Projeto de texto", projectValue, "projeto de texto estratégico", 5)
      : falhas <= C3_CRITERIA.poucasFalhasAte
        ? axis("projeto", "Projeto de texto", projectValue, "projeto de texto com poucas falhas", 4)
        : falhas <= C3_CRITERIA.algumasFalhasAte
          ? axis("projeto", "Projeto de texto", projectValue, "projeto de texto com algumas falhas", 3)
          : axis("projeto", "Projeto de texto", projectValue, "projeto de texto com muitas falhas", 2),
  );

  const n = m.argumentos.length;
  const d = m.argumentos.filter((a) => a.desenvolvido).length;
  const devValue = `${d} de ${n} desenvolvidos`;
  axes.push(
    d <= 1
      ? axis(
          "desenvolvimento",
          "Desenvolvimento",
          devValue,
          "sem desenvolvimento ou com desenvolvimento de apenas uma informação",
          2,
        )
      : d === n
        ? axis("desenvolvimento", "Desenvolvimento", devValue, "desenvolvimento em todo o texto", 5)
        : d / n >= C3_CRITERIA.maiorParteMin
          ? axis("desenvolvimento", "Desenvolvimento", devValue, "desenvolvimento da maior parte", 4)
          : axis("desenvolvimento", "Desenvolvimento", devValue, "desenvolvimento de algumas informações", 3),
  );

  return buildScore(3, axes);
}

// ───────────────────────── Competência IV ─────────────────────────
// Grade: 0 ausência de articulação · 1 presença rara · 2 pontual (monobloco não passa daqui) ·
// 3 regular · 4 constante (+ ≥1 operador interparágrafos) · 5 expressiva (+ ≥2 operadores
// interparágrafos e coesivo em todos os parágrafos) E raras repetições E sem inadequação.

/** Converte contagem de repetições prejudiciais na faixa da grade. */
export function bandLevel(count: number): Level {
  const c = C4_CRITERIA;
  if (count <= c.rarasAte) return 5;
  if (count <= c.poucasAte) return 4;
  if (count <= c.algumasAte) return 3;
  if (count <= c.muitasAte) return 2;
  return 1;
}

const BAND_LABEL: Record<number, string> = {
  5: "raras ou ausentes",
  4: "poucas",
  3: "algumas",
  2: "muitas",
  1: "excessivas",
};

export function scoreC4(m: C4Marking, stats: TextStats): CompetencyScore {
  const c = C4_CRITERIA;
  const P = Math.max(1, stats.paragraphCount);
  const ok = m.elementosCoesivos.filter((e) => e.adequado && e.paragrafo >= 1 && e.paragrafo <= P);
  const interOps = new Set(
    ok
      .filter((e) => e.posicao === "interparagrafo" && e.operadorArgumentativo && e.paragrafo >= 2)
      .map((e) => e.paragrafo),
  ).size;
  const intraParas = new Set(ok.filter((e) => e.posicao === "intraparagrafo").map((e) => e.paragrafo));
  const allParagraphsHaveIntra = intraParas.size >= P;
  const sequential = ok.filter((e) => e.tipo === "sequencial").length;
  const total = ok.length;

  let presence: ScoringAxis;
  const presValue = `${total} adequados · ${interOps} operador(es) entre parágrafos`;
  if (interOps >= c.interOperadoresNivel5 && allParagraphsHaveIntra && sequential / P >= c.sequenciaisPorParagrafoExpressiva) {
    presence = axis("presenca", "Presença de coesivos", presValue, "presença expressiva inter e intraparágrafos", 5);
  } else if (interOps >= c.interOperadoresNivel4 && total / P >= c.coesivosPorParagrafoConstante) {
    presence = axis("presenca", "Presença de coesivos", presValue, "presença constante inter e intraparágrafos", 4);
  } else if (sequential >= c.sequenciaisRegularMin) {
    presence = axis("presenca", "Presença de coesivos", presValue, "presença regular de elementos coesivos", 3);
  } else if (total >= c.coesivosPontualMin) {
    presence = axis("presenca", "Presença de coesivos", presValue, "presença pontual de elementos coesivos", 2);
  } else {
    presence = axis("presenca", "Presença de coesivos", presValue, "presença rara de elementos coesivos", 1);
  }

  const repWeight = m.repeticoes
    .filter((r) => r.prejudicaArticulacao)
    .reduce((acc, r) => acc + (r.operadorArgumentativo ? 2 : 1), 0);
  const repLevel = bandLevel(repWeight);
  const repetition = axis("repeticoes", "Repetições", String(repWeight), `${BAND_LABEL[repLevel]} repetições`, repLevel);

  const inadequacies = m.elementosCoesivos.filter((e) => !e.adequado).length;
  const inadLevel: Level =
    inadequacies === 0
      ? 5
      : inadequacies <= c.poucasAte
        ? 4
        : inadequacies <= c.algumasAte
          ? 3
          : inadequacies <= c.muitasAte
            ? 2
            : 1;
  const inadequacy = axis(
    "inadequacoes",
    "Inadequações",
    String(inadequacies),
    inadequacies === 0 ? "sem inadequação" : `${BAND_LABEL[inadLevel]} inadequações`,
    inadLevel,
  );

  const axes = [presence, repetition, inadequacy];
  if (stats.monobloco) axes.push(axis("monobloco", "Paragrafação", "monobloco", "texto em monobloco", 2));
  if (m.ausenciaArticulacao) {
    axes.push(axis("articulacao", "Articulação", "ausente", "palavras e períodos justapostos e desconexos", 0));
  }
  return buildScore(4, axes);
}

// ───────────────────────── Competência V ─────────────────────────
// Grade: 0 ausência/cópia OU desrespeito aos DH OU não relacionada ao assunto ·
// 1 tangência OU só elementos nulos OU 1 elemento válido · 2–5 = nº de elementos válidos
// (ação, agente, modo/meio, efeito, detalhamento). Condicional com ≥2 válidos fica no nível 2.

type Proposal = C5Marking["propostas"][number];

export function validElements(p: Proposal): number {
  return (
    (p.acao.presente && !p.acao.nulo ? 1 : 0) +
    (p.agente.presente && !p.agente.nulo ? 1 : 0) +
    (p.modoMeio.presente ? 1 : 0) +
    (p.efeito.presente ? 1 : 0) +
    (p.detalhamento.presente ? 1 : 0)
  );
}

export function scoreC5(m: C5Marking, theme: ThemeApproach): CompetencyScore {
  if (m.desrespeitoDireitosHumanos.ocorre) {
    return buildScore(5, [
      axis("dh", "Direitos humanos", "desrespeito", "proposta que desrespeita os direitos humanos", 0),
    ]);
  }
  const related = m.propostas.filter((p) => p.relacionadaAoAssunto);
  if (m.propostas.length === 0 || m.copiaIntegralProposta) {
    return buildScore(5, [
      axis("proposta", "Proposta", "ausente", m.copiaIntegralProposta ? "cópia integral de proposta" : "ausência de proposta", 0),
    ]);
  }
  if (related.length === 0) {
    return buildScore(5, [
      axis("proposta", "Proposta", "não relacionada", "proposta não relacionada sequer ao assunto", 0),
    ]);
  }

  const effective = related.map((p) => {
    const valid = validElements(p);
    return { p, valid, capped: p.condicional ? Math.min(valid, 2) : valid };
  });
  const best = effective.reduce((a, b) => (b.capped > a.capped ? b : a));
  const axes: ScoringAxis[] = [];

  axes.push(
    theme === "completa"
      ? axis("tema", "Relação com o tema", "completa", "proposta em texto com abordagem completa", 5)
      : axis("tema", "Relação com o tema", "tangente", "proposta em texto tangente ao tema", 1),
  );

  const elementsLevel = Math.max(1, Math.min(5, best.valid)) as Level;
  axes.push(
    axis(
      "elementos",
      "Elementos válidos",
      `${best.valid} de 5`,
      best.valid === 0 ? "apenas elementos nulos" : `${best.valid} elemento(s) válido(s)`,
      elementsLevel,
    ),
  );
  if (best.p.condicional && best.valid >= 2) {
    axes.push(axis("condicional", "Estrutura condicional", "sim", "proposta construída com oração condicional", 2));
  }
  return buildScore(5, axes);
}

function axis(key: string, label: string, value: string, category: string, maxLevel: Level): ScoringAxis {
  return { key, label, value, category, maxLevel };
}

