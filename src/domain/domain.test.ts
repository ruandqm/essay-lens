import { describe, expect, it } from "vitest";
import { buildBm25, bm25Scores } from "@/application/rag/bm25";
import { buildSituationContext, detectSituations } from "@/application/rag/situations";
import { KNOWLEDGE_CHUNKS } from "@/knowledge";
import { SITUATION_IDS } from "@/application/rag/situations";
import type { C1Marking, C2Marking, C3Marking, C4Marking, C5Marking } from "./markings";
import { compareModes, quadraticWeightedKappa, type CompScores, type EssayPredictions } from "./metrics";
import { scoreC1, scoreC2, scoreC3, scoreC4, scoreC5 } from "./scoring/competencies";
import { analyzeText } from "./text-analysis";

const para = (n: number, sentences = 3) =>
  Array.from({ length: sentences }, (_, i) => `Frase número ${i + 1} do parágrafo ${n} com palavras suficientes para contar bem.`).join(" ");
const stats = analyzeText(Array.from({ length: 4 }, (_, i) => para(i + 1, 6)).join("\n\n"));

const desvio = { trecho: "x", categoria: "ortografia" as const, correcao: "y", explicacao: "", trechoRecuperadoId: "" };
const falha = { trecho: "x", tipo: "truncamento" as const, explicacao: "", trechoRecuperadoId: "" };
const c1 = (d: number, f: number, extra: Partial<C1Marking> = {}): C1Marking => ({
  estruturaSintaticaInexistente: false,
  fluidezComprometida: false,
  construcaoComplexa: true,
  falhasEstrutura: Array(f).fill(falha),
  desvios: Array(d).fill(desvio),
  feedback: "",
  ...extra,
});

describe("Competência I", () => {
  it("nível 5 com até 2 desvios e 1 falha", () => expect(scoreC1(c1(2, 1), stats).level).toBe(5));
  it("dois desvios e duas falhas = nível 4 (exemplo da cartilha)", () => expect(scoreC1(c1(2, 2), stats).level).toBe(4));
  it("três desvios impedem o nível 5", () => expect(scoreC1(c1(3, 0), stats).level).toBe(4));
  it("deficitária COM muitos desvios = nível 1", () =>
    expect(scoreC1(c1(30, 6, { fluidezComprometida: true }), stats).level).toBe(1));
  it("deficitária com poucos desvios = nível 2", () =>
    expect(scoreC1(c1(3, 6, { fluidezComprometida: true }), stats).level).toBe(2));
  it("estrutura inexistente = 0", () => expect(scoreC1(c1(0, 0, { estruturaSintaticaInexistente: true }), stats).level).toBe(0));
  it("predomínio de período único = no máximo 3", () => {
    const s = analyzeText(Array.from({ length: 4 }, (_, i) => para(i, 1)).join("\n"));
    expect(scoreC1(c1(0, 0), s).level).toBe(3);
  });
});

const rep = (o: Partial<C2Marking["repertorios"][number]> = {}) => ({
  trecho: "",
  descricao: "",
  baseadoTextosMotivadores: false,
  legitimado: true,
  pertinente: true,
  usoProdutivo: true,
  explicacao: "",
  trechoRecuperadoId: "",
  ...o,
});
const c2 = (o: Partial<C2Marking> = {}): C2Marking => ({
  elementosTema: [],
  abordagemTema: "completa",
  justificativaTema: "",
  naoAtendeTipoTextual: false,
  aglomeradoPalavras: false,
  tracosConstantesOutrosTipos: false,
  introducaoEmbrionaria: false,
  desenvolvimentoEmbrionario: false,
  conclusaoEmbrionaria: false,
  conclusaoFraseIncompleta: false,
  copiaTextosMotivadores: "nenhuma",
  parteDesconectada: false,
  repertorios: [rep()],
  feedback: "",
  ...o,
});

describe("Competência II", () => {
  it("repertório produtivo = 5", () => expect(scoreC2(c2()).level).toBe(5));
  it("vale o repertório de nível mais alto", () =>
    expect(scoreC2(c2({ repertorios: [rep({ baseadoTextosMotivadores: true }), rep()] })).level).toBe(5));
  it("sem uso produtivo = 4", () => expect(scoreC2(c2({ repertorios: [rep({ usoProdutivo: false })] })).level).toBe(4));
  it("tangente = 1", () => expect(scoreC2(c2({ abordagemTema: "tangente" })).level).toBe(1));
  it("muitos trechos de cópia limitam ao 2", () => expect(scoreC2(c2({ copiaTextosMotivadores: "muitosTrechos" })).level).toBe(2));
  it("uma parte embrionária limita ao 3", () => expect(scoreC2(c2({ conclusaoEmbrionaria: true })).level).toBe(3));
});

const arg = (desenvolvido: boolean) => ({ trecho: "", resumo: "", desenvolvido, explicacao: "", trechoRecuperadoId: "" });
const c3 = (falhas: number, dev: boolean[], o: Partial<C3Marking> = {}): C3Marking => ({
  pontoDeVista: "",
  comDirecao: true,
  contradicaoGrave: { ocorre: false, explicacao: "" },
  falhasProjeto: Array(falhas).fill({ trecho: "", descricao: "", gravidade: "falha", trechoRecuperadoId: "" }),
  argumentos: dev.map(arg),
  feedback: "",
  ...o,
});

describe("Competência III", () => {
  it("estratégico e tudo desenvolvido = 5", () => expect(scoreC3(c3(0, [true, true, true]), "completa").level).toBe(5));
  it("prevalece o nível mais baixo", () => expect(scoreC3(c3(2, [true, false, false, false]), "completa").level).toBe(2));
  it("tangente com direção = 1", () => expect(scoreC3(c3(0, [true, true]), "tangente").level).toBe(1));
  it("contradição grave limita ao 2", () =>
    expect(scoreC3(c3(0, [true, true], { contradicaoGrave: { ocorre: true, explicacao: "" } }), "completa").level).toBe(2));
});

const coes = (paragrafo: number, posicao: "interparagrafo" | "intraparagrafo", adequado = true) => ({
  trecho: "x",
  paragrafo,
  posicao,
  tipo: "sequencial" as const,
  operadorArgumentativo: true,
  adequado,
  explicacao: "",
  trechoRecuperadoId: "",
});
const rich = [
  coes(2, "interparagrafo"),
  coes(3, "interparagrafo"),
  coes(4, "interparagrafo"),
  ...[1, 2, 3, 4].flatMap((p) => [coes(p, "intraparagrafo"), coes(p, "intraparagrafo"), coes(p, "intraparagrafo")]),
];
const c4 = (els: ReturnType<typeof coes>[], o: Partial<C4Marking> = {}): C4Marking => ({
  ausenciaArticulacao: false,
  elementosCoesivos: els,
  repeticoes: [],
  feedback: "",
  ...o,
});

describe("Competência IV", () => {
  it("presença expressiva sem inadequação = 5", () => expect(scoreC4(c4(rich), stats).level).toBe(5));
  it("uma inadequação impede o 5", () => expect(scoreC4(c4([...rich, coes(2, "intraparagrafo", false)]), stats).level).toBe(4));
  it("monobloco limita ao 2", () => expect(scoreC4(c4(rich), analyzeText(para(1, 8))).level).toBeLessThanOrEqual(2));
});

const el = (presente = true) => ({ presente, trecho: presente ? "x" : "" });
const prop = (n: number, condicional = false): C5Marking["propostas"][number] => ({
  trecho: "x",
  relacionadaAoAssunto: true,
  condicional,
  acao: { ...el(n >= 1), nulo: false },
  agente: { ...el(n >= 2), nulo: false },
  modoMeio: el(n >= 3),
  efeito: el(n >= 4),
  detalhamento: { ...el(n >= 5), referente: n >= 5 ? "acao" : "nenhum" },
  trechoRecuperadoId: "",
});
const c5 = (props: C5Marking["propostas"], dh = false): C5Marking => ({
  propostas: props,
  desrespeitoDireitosHumanos: { ocorre: dh, trecho: "", explicacao: "" },
  copiaIntegralProposta: false,
  feedback: "",
});

describe("Competência V", () => {
  it("5 elementos = 5", () => expect(scoreC5(c5([prop(5)]), "completa").level).toBe(5));
  it("proposta mais completa vale", () => expect(scoreC5(c5([prop(2), prop(4)]), "completa").level).toBe(4));
  it("condicional limita ao 2 (caso-limite do manual)", () => expect(scoreC5(c5([prop(5, true)]), "completa").level).toBe(2));
  it("desrespeito aos DH = 0", () => expect(scoreC5(c5([prop(5)], true), "completa").level).toBe(0));
  it("tangente = 1", () => expect(scoreC5(c5([prop(5)]), "tangente").level).toBe(1));
  it("sem proposta = 0", () => expect(scoreC5(c5([]), "completa").level).toBe(0));
});

describe("Métricas", () => {
  // Caso de referência: [humano, sem RAG, com RAG] por redação, C1..C5.
  const T: number[][][] = [
    [[80, 80, 120, 40, 80], [120, 120, 120, 80, 120], [80, 120, 120, 80, 80]],
    [[80, 80, 120, 80, 120], [160, 120, 80, 120, 120], [160, 120, 80, 200, 120]],
    [[120, 120, 120, 160, 80], [120, 120, 80, 200, 120], [160, 160, 160, 160, 180]],
    [[160, 120, 160, 160, 80], [120, 160, 160, 160, 160], [160, 120, 200, 160, 80]],
    [[160, 200, 160, 160, 200], [160, 160, 160, 200, 160], [160, 200, 160, 160, 200]],
    [[120, 160, 120, 120, 160], [120, 120, 160, 160, 120], [120, 160, 120, 120, 160]],
    [[160, 120, 120, 160, 200], [160, 160, 200, 160, 160], [160, 120, 160, 160, 200]],
    [[120, 160, 160, 120, 160], [160, 160, 120, 160, 160], [120, 160, 160, 120, 160]],
    [[200, 180, 160, 180, 200], [160, 160, 160, 160, 160], [200, 180, 160, 180, 200]],
    [[80, 120, 80, 120, 120], [120, 120, 120, 120, 160], [80, 120, 120, 120, 120]],
  ];
  const toScores = (a: number[]) => ({ 1: a[0]!, 2: a[1]!, 3: a[2]!, 4: a[3]!, 5: a[4]! }) as CompScores;
  const rows: EssayPredictions[] = T.map((r, i) => ({
    essayId: `R${i + 1}`,
    label: `R${i + 1}`,
    human: toScores(r[0]!),
    predictions: { baseline: [toScores(r[1]!)], rag: [toScores(r[2]!)] },
  }));

  it("calcula o MAE de um caso de referência (28,8 → 14,0)", () => {
    const cmp = compareModes(rows)!;
    expect(cmp.baseline.maeMean).toBeCloseTo(28.8, 5);
    expect(cmp.rag.maeMean).toBeCloseTo(14.0, 5);
    expect(cmp.baseline.perCompetency[5].mae).toBe(36);
    expect(cmp.rag.perCompetency[5].mae).toBe(10);
    expect(cmp.rag.perCompetency[3].mae).toBe(20);
  });

  it("QWK = 1 para concordância perfeita", () => expect(quadraticWeightedKappa([0, 40, 200], [0, 40, 200])).toBe(1));
});

describe("Base de conhecimento e recuperação", () => {
  it("IDs únicos e situações válidas", () => {
    expect(new Set(KNOWLEDGE_CHUNKS.map((c) => c.id)).size).toBe(KNOWLEDGE_CHUNKS.length);
    for (const c of KNOWLEDGE_CHUNKS) for (const s of c.situations) expect(SITUATION_IDS.has(s), `${c.title}: ${s}`).toBe(true);
    for (const c of KNOWLEDGE_CHUNKS) expect(c.id).toMatch(/^comp[1-5]-[0-9a-f]{10}$/);
  });

  it("detecta proposta condicional", () => {
    const ctx = buildSituationContext(
      "A internet manipula usuários.\n\nPortanto, se o governo criar leis rígidas, os usuários estarão protegidos.",
    );
    expect(detectSituations(ctx).map((s) => s.id)).toContain("c5-condicional");
  });

  it("BM25 favorece documentos com termos da consulta", () => {
    const idx = buildBm25(["oração condicional limita nível", "crase acento grave"]);
    const [a, b] = bm25Scores(idx, "proposta com oração condicional");
    expect(a!).toBeGreaterThan(b!);
  });
});

describe("Detectores com acentos", () => {
  it("reconhece 'é necessário' como proposta e 'você' como agente nulo", () => {
    const ids = detectSituations(buildSituationContext("A internet manipula.\n\nPortanto, é necessário que você reflita.")).map((s) => s.id);
    expect(ids).not.toContain("c5-sem-proposta");
    expect(ids).toContain("c5-agente-nulo");
  });
  it("detecta crase", () => {
    expect(detectSituations(buildSituationContext("Isso leva à exclusão de muitos.")).map((s) => s.id)).toContain("c1-crase");
  });
});
