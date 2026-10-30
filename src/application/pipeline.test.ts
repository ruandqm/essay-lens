import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SAMPLE } from "@/components/corrector/sample";
import { C1MarkingSchema, C2MarkingSchema, C3MarkingSchema, C4MarkingSchema, C5MarkingSchema, ParecerSchema } from "@/domain/markings";
import { pendingJobs, resumeExperiment, runExperiment, runToPredictions } from "./experiments/run-experiment";
import type { DatasetEssay, ExperimentRun } from "./experiments/types";
import { gradeEssay } from "./grade-essay";
import { RateLimitError, type ExperimentRepository, type LlmClient } from "./ports";
import { compareModes } from "@/domain/metrics";

/** LLM falso: devolve marcações fixas, válidas pelo schema. */
const fake: LlmClient = {
  model: "fake",
  async generateJson({ schema }) {
    const by = new Map<unknown, unknown>([
      [C1MarkingSchema, { estruturaSintaticaInexistente: false, fluidezComprometida: false, construcaoComplexa: true, falhasEstrutura: [], desvios: [{ trecho: "Darcy Ribeiro", categoria: "acentuacao", correcao: "x", explicacao: "teste", trechoRecuperadoId: "" }], feedback: "ok" }],
      [C2MarkingSchema, { elementosTema: [], abordagemTema: "completa", justificativaTema: "", naoAtendeTipoTextual: false, aglomeradoPalavras: false, tracosConstantesOutrosTipos: false, introducaoEmbrionaria: false, desenvolvimentoEmbrionario: false, conclusaoEmbrionaria: false, conclusaoFraseIncompleta: false, copiaTextosMotivadores: "nenhuma", parteDesconectada: false, repertorios: [{ trecho: "Silvio Almeida", descricao: "Racismo estrutural", baseadoTextosMotivadores: false, legitimado: true, pertinente: true, usoProdutivo: true, explicacao: "", trechoRecuperadoId: "" }], feedback: "ok" }],
      [C3MarkingSchema, { pontoDeVista: "x", comDirecao: true, contradicaoGrave: { ocorre: false, explicacao: "" }, falhasProjeto: [], argumentos: [{ trecho: "a", resumo: "", desenvolvido: true, explicacao: "", trechoRecuperadoId: "" }, { trecho: "b", resumo: "", desenvolvido: true, explicacao: "", trechoRecuperadoId: "" }], feedback: "ok" }],
      [C4MarkingSchema, { ausenciaArticulacao: false, elementosCoesivos: [{ trecho: "Além disso", paragrafo: 3, posicao: "interparagrafo", tipo: "sequencial", operadorArgumentativo: true, adequado: true, explicacao: "", trechoRecuperadoId: "" }], repeticoes: [], feedback: "ok" }],
      [C5MarkingSchema, { propostas: [{ trecho: "x", relacionadaAoAssunto: true, condicional: false, acao: { presente: true, trecho: "amplie a formação de professores", nulo: false }, agente: { presente: true, trecho: "o Ministério da Educação", nulo: false }, modoMeio: { presente: true, trecho: "por meio de cursos gratuitos" }, efeito: { presente: true, trecho: "a fim de que a Lei 10.639 seja efetivamente cumprida" }, detalhamento: { presente: false, trecho: "", referente: "nenhum" }, trechoRecuperadoId: "" }], desrespeitoDireitosHumanos: { ocorre: false, trecho: "", explicacao: "" }, copiaIntegralProposta: false, feedback: "ok" }],
      [ParecerSchema, { parecerGeral: "Bom texto." }],
    ]);
    return { data: (schema as z.ZodType).parse(by.get(schema)), usage: { inputTokens: 10, outputTokens: 5 }, latencyMs: 1 } as never;
  },
};

const MARKING_BY_LABEL: Record<string, z.ZodType> = {
  C1: C1MarkingSchema, C2: C2MarkingSchema, C3: C3MarkingSchema, C4: C4MarkingSchema, C5: C5MarkingSchema,
};

const deps = { llm: fake, embeddingModel: "none", getRetriever: async () => { throw new Error("sem RAG"); } };

describe("pipeline de correção", () => {
  it("corrige sem RAG e calcula as notas pela grade", async () => {
    const { result } = await gradeEssay({ tema: SAMPLE.tema, texto: SAMPLE.texto, mode: "baseline" }, deps);
    const by = Object.fromEntries(result.competencies.map((c) => [c.competency, c.score]));
    expect(by).toEqual({ 1: 200, 2: 200, 3: 200, 4: 40, 5: 160 });
    expect(result.total).toBe(800);
    expect(result.stats.llmCalls).toBe(6);
    expect(result.annotations.length).toBeGreaterThan(3);
  });

  it("anula texto insuficiente", async () => {
    const { result } = await gradeEssay({ tema: SAMPLE.tema, texto: "Texto curto demais para ser corrigido como redação.", mode: "baseline" }, deps);
    expect(result.total).toBe(0);
    expect(result.annulled?.reasons).toContain("texto-insuficiente");
  });

  it("executa um experimento e gera métricas", async () => {
    const runs = new Map<string, ExperimentRun>();
    const repo: ExperimentRepository = {
      listDataset: async () => [],
      saveDataset: async () => {},
      listRuns: async () => [...runs.values()],
      getRun: async (id) => runs.get(id) ?? null,
      saveRun: async (r) => void runs.set(r.id, structuredClone(r)),
      deleteRun: async () => {},
    };
    const essay: DatasetEssay = { id: "r1", label: "R01", tema: SAMPLE.tema, texto: SAMPLE.texto, textosMotivadores: "", human: { 1: 160, 2: 160, 3: 160, 4: 120, 5: 160 }, notes: "" };
    const run: ExperimentRun = {
      id: "t1", name: "t", createdAt: "", finishedAt: null, status: "running",
      config: { model: "fake", embeddingModel: "none", modes: ["baseline"], repetitions: 2, essayIds: ["r1"], rag: { topK: 4, minDenseZ: 1, bm25MaxRank: 3, rrfK: 60 } },
      progress: { done: 0, total: 0, current: null }, results: [], human: { r1: { label: "R01", scores: essay.human } }, error: null,
    };
    const done = await runExperiment(run, [essay], { ...deps, repo });
    expect(done.status).toBe("done");
    expect(done.results).toHaveLength(2);
    const rows = runToPredictions(done);
    expect(rows[0]!.predictions.baseline).toHaveLength(2);
    expect(compareModes(rows)).toBeNull(); // só uma configuração
  });

  it("retoma só as correções que falharam", async () => {
    const runs = new Map<string, ExperimentRun>();
    const repo: ExperimentRepository = {
      listDataset: async () => [],
      saveDataset: async () => {},
      listRuns: async () => [...runs.values()],
      getRun: async (id) => runs.get(id) ?? null,
      saveRun: async (r) => void runs.set(r.id, structuredClone(r)),
      deleteRun: async () => {},
    };
    const essay: DatasetEssay = { id: "r1", label: "R01", tema: SAMPLE.tema, texto: SAMPLE.texto, textosMotivadores: "", human: { 1: 160, 2: 160, 3: 160, 4: 120, 5: 160 }, notes: "" };
    const run: ExperimentRun = {
      id: "t2", name: "t", createdAt: "", finishedAt: null, status: "running",
      config: { model: "fake", embeddingModel: "none", modes: ["baseline"], repetitions: 3, essayIds: ["r1"], rag: { topK: 4, minDenseZ: 1, bm25MaxRank: 3, rrfK: 60 } },
      progress: { done: 0, total: 0, current: null }, results: [], human: { r1: { label: "R01", scores: essay.human } }, error: null,
    };
    // A 2ª correção falha (ex.: erro 429 do Gemini).
    let calls = 0;
    let current = "";
    const flaky: LlmClient = {
      model: "fake",
      async generateJson(req) {
        calls++;
        if (current.endsWith("rep. 2")) throw new Error("429 Too Many Requests");
        return fake.generateJson(req);
      },
    };
    const onProgress = (r: ExperimentRun) => void (current = r.progress.current ?? "");
    const first = await runExperiment(run, [essay], { ...deps, llm: flaky, repo, onProgress });
    expect(first.results.filter((r) => r.error).map((r) => r.repetition)).toEqual([2]);
    expect(first.error).toMatch(/1 correção/);

    const before = calls;
    const retried = await resumeExperiment(first, [essay], { ...deps, repo });
    expect(retried.status).toBe("done");
    expect(retried.error).toBeNull();
    expect(retried.results).toHaveLength(3);
    expect(retried.results.every((r) => !r.error)).toBe(true);
    expect(retried.results.map((r) => r.repetition).sort()).toEqual([1, 2, 3]);
    expect(retried.progress).toMatchObject({ done: 3, total: 3 });
    expect(calls).toBe(before); // usou o LLM do retry, não o instável
  });

  const memRepo = () => {
    const runs = new Map<string, ExperimentRun>();
    const repo: ExperimentRepository = {
      listDataset: async () => [],
      saveDataset: async () => {},
      listRuns: async () => [...runs.values()],
      getRun: async (id) => runs.get(id) ?? null,
      saveRun: async (r) => void runs.set(r.id, structuredClone(r)),
      deleteRun: async () => {},
    };
    return { repo, runs };
  };
  const essay: DatasetEssay = { id: "r1", label: "R01", tema: SAMPLE.tema, texto: SAMPLE.texto, textosMotivadores: "", human: { 1: 160, 2: 160, 3: 160, 4: 120, 5: 160 }, notes: "" };
  const newRun = (id: string, repetitions: number): ExperimentRun => ({
    id, name: "t", createdAt: "", finishedAt: null, status: "running",
    config: { model: "fake", embeddingModel: "none", modes: ["baseline"], repetitions, essayIds: ["r1"], rag: { topK: 4, minDenseZ: 1, bm25MaxRank: 3, rrfK: 60 } },
    progress: { done: 0, total: 0, current: null }, results: [], human: { r1: { label: "R01", scores: essay.human } }, error: null,
  });

  it("espera o limite do Gemini liberar e reaproveita as competências já corrigidas", async () => {
    const { repo, runs } = memRepo();
    const seen: string[] = [];
    let c3Fails = 2;
    const limited: LlmClient = {
      model: "fake",
      async generateJson(req) {
        seen.push(req.label);
        if (req.label === "C3" && c3Fails-- > 0) throw new RateLimitError("429", 1000);
        return fake.generateJson(req);
      },
    };
    const waits: number[] = [];
    const done = await runExperiment(newRun("t3", 1), [essay], {
      ...deps, llm: limited, repo, sleep: async (ms) => void waits.push(ms),
    });
    expect(done.status).toBe("done");
    expect(done.results[0]!.error).toBeNull();
    // C1, C2, C4 e C5 rodaram uma vez só; só a C3 foi repetida.
    expect(seen.filter((l) => l === "C1")).toHaveLength(1);
    expect(seen.filter((l) => l === "C5")).toHaveLength(1);
    expect(seen.filter((l) => l === "C3")).toHaveLength(3);
    expect(waits.length).toBeGreaterThan(0);
    expect(runs.get("t3")!.progress.waitingUntil).toBeNull();
  });

  it("pausa quando o limite persiste e retoma de onde parou", async () => {
    const { repo } = memRepo();
    let calls = 0;
    const blocked: LlmClient = {
      model: "fake",
      async generateJson(req) {
        calls++;
        if (calls > 6) throw new RateLimitError("429");
        return fake.generateJson(req);
      },
    };
    const paused = await runExperiment(newRun("t4", 3), [essay], {
      ...deps, llm: blocked, repo, rateLimitPauses: 2, sleep: async () => {},
    });
    expect(paused.status).toBe("paused");
    expect(paused.results).toHaveLength(1); // a 1ª correção ficou salva
    expect(paused.error).toMatch(/Retomar/);
    expect(pendingJobs(paused, [essay])).toHaveLength(2);

    const resumed = await resumeExperiment(paused, [essay], { ...deps, repo });
    expect(resumed.status).toBe("done");
    expect(resumed.results.map((r) => r.repetition).sort()).toEqual([1, 2, 3]);
  });

  it("pausa imediatamente quando a cota diária acaba", async () => {
    const { repo } = memRepo();
    const daily: LlmClient = { model: "fake", generateJson: async () => { throw new RateLimitError("429", null, true); } };
    const run = await runExperiment(newRun("t5", 1), [essay], { ...deps, llm: daily, repo, sleep: async () => {} });
    expect(run.status).toBe("paused");
    expect(run.error).toMatch(/Cota diária/);
  });

  it("modo RAG: registra a aplicação de cada trecho e descarta IDs inventados", async () => {
    const { KNOWLEDGE_CHUNKS } = await import("@/knowledge");
    const pick = (c: number) => KNOWLEDGE_CHUNKS.filter((k) => k.competency === c).slice(0, 2).map((k) => ({ ...k, embedding: [] }));
    const selected = { 1: pick(1), 2: pick(2), 3: pick(3), 4: pick(4), 5: pick(5) };
    const retriever = {
      retrieve: async () => ({ situations: [], byCompetency: { 1: [], 2: [], 3: [], 4: [], 5: [] }, selected, latencyMs: 0 }),
    };
    const ragLlm: LlmClient = {
      model: "fake",
      async generateJson(req) {
        const shape = (req.schema as unknown as z.ZodObject).shape as Record<string, unknown>;
        if (!("aplicacaoTrechos" in shape)) return fake.generateJson(req);
        const ids = [...req.prompt.matchAll(/^\[(comp\d-[0-9a-f]{10})\]/gm)].map((m) => m[1]!);
        const base = (await fake.generateJson({ ...req, schema: MARKING_BY_LABEL[req.label]! })).data as Record<string, unknown>;
        const data = JSON.parse(JSON.stringify(base).replaceAll('"trechoRecuperadoId":""', `"trechoRecuperadoId":"comp9-inventado"`));
        if (req.label === "C5") data.propostas[0].trechoRecuperadoId = ids[0];
        data.aplicacaoTrechos = ids.map((id, i) => ({ id, seAplica: i === 0, trechoRedacao: i === 0 ? "x" : "", decisao: "d" }));
        return { data: (req.schema as z.ZodType).parse(data), usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 1 } as never;
      },
    };
    const { result } = await gradeEssay(
      { tema: SAMPLE.tema, texto: SAMPLE.texto, mode: "rag" },
      { llm: ragLlm, embeddingModel: "fake", getRetriever: async () => retriever as never },
    );
    const c5 = result.competencies.find((c) => c.competency === 5)!;
    expect(c5.applications).toHaveLength(2);
    expect(c5.applications![0]!.seAplica).toBe(true);
    expect(c5.applications![0]!.id).toBe(selected[5][0]!.id);
    const refs = JSON.stringify(result.markings).match(/"trechoRecuperadoId":"[^"]*"/g) ?? [];
    expect(refs.some((r) => r.includes("inventado"))).toBe(false);
    expect(result.markings![5].propostas[0]!.trechoRecuperadoId).toBe(selected[5][0]!.id);
    expect(result.annotations.some((a) => a.chunkId === selected[5][0]!.id)).toBe(true);
  });
});
