import { describe, expect, it } from "vitest";
import type { IndexedChunk, KnowledgeIndex } from "@/domain/knowledge";
import type { EmbeddingProvider } from "../ports";
import { HybridRetriever } from "./retriever";
import { buildSituationContext, detectSituations } from "./situations";

const chunk = (id: string, competency: 1 | 2 | 3 | 4 | 5, embedding: number[], situations: string[] = []): IndexedChunk => ({
  id, competency, source: "teste", type: "regra", title: id, text: `texto ${id}`, situations, embedding,
});

// Toda consulta aponta para o eixo 0.
const embeddings: EmbeddingProvider = {
  id: "fake", model: "fake", dimension: 3,
  embedQueries: async (t) => t.map(() => [1, 0, 0]),
  embedPassages: async (t) => t.map(() => [1, 0, 0]),
};

const index: KnowledgeIndex = {
  version: 1, provider: "fake", model: "fake", dimension: 3, createdAt: "",
  chunks: [
    chunk("proximo", 5, [1, 0, 0]),
    chunk("medio", 5, [0.9, 0.436, 0]),
    chunk("parceria", 5, [0, 1, 0], ["c5-parceria"]), // longe no cosseno, mas roteado
    ...[1, 2, 3, 4].map((c) => chunk(`c${c}`, c as 1 | 2 | 3 | 4, [1, 0, 0])),
  ],
};

const texto = "Introdução sobre o tema.\n\nPortanto, o Estado, em parceria com as escolas, deve criar programas.";

describe("recuperação híbrida", () => {
  it("roteamento de alta precisão tem prioridade nas vagas do top-k", async () => {
    const r = new HybridRetriever(index, embeddings, { topK: 2, minDenseZ: -10, bm25MaxRank: 0, rrfK: 60 });
    const res = await r.retrieve({ tema: "tema", texto });
    expect(res.selected[5].map((c) => c.id)).toEqual(["parceria", "proximo"]);
  });

  it("situações comuns não reservam vaga", () => {
    const sit = detectSituations(buildSituationContext("Isso leva à exclusão.\n\nÉ necessário que o governo, em parceria com ONGs, aja."));
    expect(sit.find((s) => s.id === "c1-crase")?.priority).toBe(false);
    expect(sit.find((s) => s.id === "c5-parceria")?.priority).toBe(true);
    expect(sit.find((s) => s.id === "c5-estrutura-interventiva")?.priority).toBe(true);
  });

  it("detecta texto completo e extenso para a fronteira 4 × 5 da C3", () => {
    const p = (n: number) => Array.from({ length: 7 }, () => `Frase de teste ${n} com várias palavras para compor o parágrafo.`).join(" ");
    const longo = [1, 2, 3, 4].map(p).join("\n\n");
    expect(detectSituations(buildSituationContext(longo)).map((s) => s.id)).toContain("c3-texto-completo");
    expect(detectSituations(buildSituationContext([1, 2].map(p).join("\n\n"))).map((s) => s.id)).not.toContain("c3-texto-completo");
  });
});

describe("detectores da Competência V olham só para a proposta", () => {
  const ids = (t: string) => detectSituations(buildSituationContext(t)).map((s) => s.id);

  it("não confunde o 'se' de 'deve-se' na introdução com condicional", () => {
    const t = "De acordo com a lei, deve-se assegurar educação a todos.\n\nO problema persiste.\n\nPortanto, o governo deve criar escolas, para que todos estudem.";
    expect(ids(t)).not.toContain("c5-condicional");
    expect(ids("Introdução.\n\nPortanto, se o governo criar escolas, todos estudarão.")).toContain("c5-condicional");
  });

  it("ignora marcas que só aparecem no desenvolvimento", () => {
    const t = "Introdução.\n\nFalta investimento no setor, evitando avanços.\n\nPortanto, o Estado deve ampliar vagas, para que todos estudem.";
    expect(ids(t)).not.toContain("c5-constatacao-falta");
    expect(ids(t)).toContain("c5-efeito");
  });

  it("reconhece marcas dos elementos e casos de parceria, agente ausente e ação vaga", () => {
    const t =
      "Introdução.\n\nDesenvolvimento.\n\nCumpre ao Governo Federal, como gestor do orçamento, mediante parceria com o Ministério, ampliar o acesso, a fim de mudar essa realidade.";
    const found = ids(t);
    for (const id of ["c5-modo-meio", "c5-parceria", "c5-efeito", "c5-detalhamento"]) expect(found).toContain(id);
    expect(ids("Introdução.\n\nPortanto, devem ser promovidas campanhas nas escolas.")).toContain("c5-agente-ausente");
    expect(ids("Introdução.\n\nDe certo modo, é importante a atenção do governo às áreas excluídas.")).toEqual(
      expect.arrayContaining(["c5-acao-nula", "c5-estrutura-interventiva"]),
    );
  });

  it("C4: só introdutor de citação no início do parágrafo aciona a exceção do intraparágrafo", () => {
    expect(ids("Intro.\n\nAlém disso, há outro ponto.\n\nPortanto, conclui-se.")).not.toContain("c4-inicio-citacao");
    expect(ids("Intro.\n\nSegundo Bauman, vivemos tempos líquidos.\n\nPortanto, conclui-se.")).toContain("c4-inicio-citacao");
  });
});

describe("detectores que apontam o provável desvio (C1) e referência vaga (C2)", () => {
  const ids = (t: string) => detectSituations(buildSituationContext(t)).map((s) => s.id);
  it("crase, regência, concordância e grafia", () => {
    expect(ids("Isso é relevante no que tange a valorização da arte.")).toContain("c1-crase-provavel");
    expect(ids("Isso é relevante no que tange à valorização da arte.")).not.toContain("c1-crase-provavel");
    expect(ids("Muitas pessoas preferem assistir filmes em casa.")).toContain("c1-regencia-provavel");
    expect(ids("Muitas pessoas preferem assistir a filmes em casa.")).not.toContain("c1-regencia-provavel");
    expect(ids("Não são todos que tem acesso.")).toContain("c1-concordancia-provavel");
    expect(ids("Pois á estados sem cinema, afim de lucrar.")).toContain("c1-grafia-provavel");
    expect(ids("A lei garante acesso à educação.")).not.toContain("c1-grafia-provavel");
  });
  it("referência sem fonte identificável", () => {
    expect(ids("Segundo especialistas, o problema cresce.")).toContain("c2-referencia-vaga");
    expect(ids("A Constituição de 1988, em seu artigo 5º, garante a igualdade.")).not.toContain("c2-referencia-vaga");
  });
});

describe("ajustes de C1 e C4 após o experimento de 30/10 (tarde)", () => {
  const ids = (t: string) => detectSituations(buildSituationContext(t)).map((s) => s.id);
  it("adjunto intercalado com só a vírgula de fechamento", () => {
    expect(ids("O governo promova por meio de um reajuste de prioridades orçamentárias, um destino de recursos.")).toContain("c1-virgula-intercalada");
    expect(ids("O governo promova, por meio de um reajuste de prioridades orçamentárias, um destino de recursos.")).not.toContain("c1-virgula-intercalada");
    expect(ids("Fim da frase. De acordo com o professor americano John Piper, a marca é outra.")).not.toContain("c1-virgula-intercalada");
  });
  it("reconhece aberturas formais de parágrafo como conectivos", () => {
    const t = "Introdução.\n\nSob essa ótica, há um problema.\n\nAdemais, outro.\n\nDestarte, conclui-se.";
    expect(ids(t)).not.toContain("c4-sem-conectivo-interparagrafo");
  });
  it("'desmitificar' não é apontado como erro", () => {
    expect(ids("É preciso desmitificar esse estigma.")).not.toContain("c1-grafia-provavel");
  });
});

describe("C3: parágrafo apoiado em citação", () => {
  const ids = (t: string) => detectSituations(buildSituationContext(t)).map((s) => s.id);
  it("detecta citação em parágrafo de desenvolvimento, não na introdução", () => {
    expect(ids('Intro.\n\nSegundo o filósofo Kant, "os seres humanos possuem dignidade". Isso contrapõe a realidade.\n\nConclusão.')).toContain("c3-argumento-citacao");
    expect(ids('Segundo o filósofo Kant, "os seres humanos possuem dignidade".\n\nDesenvolvimento sem citação.\n\nConclusão.')).not.toContain("c3-argumento-citacao");
  });
});
