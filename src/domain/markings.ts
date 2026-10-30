import { z } from "zod";

/**
 * Marcações estruturadas produzidas pelo modelo de linguagem.
 * O modelo NÃO atribui notas: ele apenas identifica, com trechos literais, os
 * aspectos que a Grade Específica do ENEM manda observar. A nota é calculada no
 * servidor pelas regras determinísticas em `domain/scoring`.
 *
 * Os schemas evitam uniões e campos opcionais para manter a saída JSON estável.
 */

const trecho = z.string().describe("Cópia literal e curta (até ~25 palavras) do trecho da redação.");
const chunkRef = z
  .string()
  .describe('ID do trecho recuperado (ex.: "comp5-ab12cd34ef") que fundamentou a decisão, ou "" se nenhum.');
const feedback = z
  .string()
  .describe("Comentário pedagógico (3 a 6 frases) explicando ao participante o desempenho nesta competência.");

// ───────────────────────── Competência I ─────────────────────────

export const DESVIO_CATEGORIAS = [
  "acentuacao",
  "ortografia",
  "hifen",
  "maiusculas-minusculas",
  "translineacao",
  "regencia",
  "concordancia",
  "pontuacao",
  "paralelismo",
  "pronomes",
  "crase",
  "registro-informal",
  "escolha-vocabular",
] as const;

export const FALHA_ESTRUTURA_TIPOS = ["truncamento", "justaposicao", "excesso", "ausencia", "duplicacao"] as const;

export const C1MarkingSchema = z.object({
  estruturaSintaticaInexistente: z
    .boolean()
    .describe("true apenas se o texto não possui sintaxe estruturada (palavras soltas, sem orações)."),
  fluidezComprometida: z
    .boolean()
    .describe("true se truncamentos/justaposições prejudicam a fluidez da leitura NA MAIOR PARTE do texto."),
  construcaoComplexa: z
    .boolean()
    .describe("true se há períodos elaborados (subordinação, orações intercaladas, inversões) com domínio."),
  falhasEstrutura: z
    .array(
      z.object({
        trecho,
        tipo: z.enum(FALHA_ESTRUTURA_TIPOS),
        explicacao: z.string(),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Cada falha de estrutura sintática encontrada (uma entrada por ocorrência)."),
  desvios: z
    .array(
      z.object({
        trecho,
        categoria: z.enum(DESVIO_CATEGORIAS),
        correcao: z.string().describe("Forma correta segundo a norma-padrão."),
        explicacao: z.string(),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Cada desvio contabilizável, já aplicando as regras de contagem (repetições, mesmo radical etc.)."),
  feedback,
});
export type C1Marking = z.infer<typeof C1MarkingSchema>;

// ───────────────────────── Competência II ─────────────────────────

export const C2MarkingSchema = z.object({
  elementosTema: z
    .array(z.object({ elemento: z.string(), abordado: z.boolean(), trecho }))
    .describe("Elementos-chave da frase temática e se cada um foi abordado (com o trecho que o comprova)."),
  abordagemTema: z
    .enum(["completa", "tangente", "fuga"])
    .describe("completa = todos os elementos; tangente = apenas o assunto geral; fuga = nem o assunto."),
  justificativaTema: z.string(),
  naoAtendeTipoTextual: z
    .boolean()
    .describe("true se o texto NÃO é predominantemente dissertativo-argumentativo (situação de nota zero)."),
  aglomeradoPalavras: z.boolean().describe("true se o texto é composto por palavras justapostas."),
  tracosConstantesOutrosTipos: z
    .boolean()
    .describe("true se há marcas constantes de narração, tópicos, carta etc., embora predomine a dissertação."),
  introducaoEmbrionaria: z.boolean().describe("true se a introdução é muito curta por pouca produção."),
  desenvolvimentoEmbrionario: z.boolean(),
  conclusaoEmbrionaria: z.boolean(),
  conclusaoFraseIncompleta: z.boolean().describe("true se o texto termina com período truncado/sem sentido completo."),
  copiaTextosMotivadores: z
    .enum(["nenhuma", "pontual", "muitosTrechos"])
    .describe("muitosTrechos = muitos trechos copiados em relação ao conjunto do texto."),
  parteDesconectada: z
    .boolean()
    .describe("true se há parte do texto deliberadamente desconectada do tema (situação de nota zero)."),
  repertorios: z
    .array(
      z.object({
        trecho,
        descricao: z.string().describe("O que é o repertório (autor, fato, dado, conceito...)."),
        baseadoTextosMotivadores: z.boolean(),
        legitimado: z.boolean().describe("Tem respaldo nas áreas do conhecimento?"),
        pertinente: z.boolean().describe("Associa-se a ao menos um elemento do tema?"),
        usoProdutivo: z.boolean().describe("Está vinculado à discussão proposta pelo participante?"),
        explicacao: z.string(),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Todos os repertórios socioculturais mobilizados como argumento."),
  feedback,
});
export type C2Marking = z.infer<typeof C2MarkingSchema>;

// ───────────────────────── Competência III ─────────────────────────

export const C3MarkingSchema = z.object({
  pontoDeVista: z.string().describe("Tese defendida, em uma frase. Vazio se não for identificável."),
  comDirecao: z
    .boolean()
    .describe("true se as ideias se articulam numa direção única em defesa de um ponto de vista."),
  contradicaoGrave: z.object({
    ocorre: z.boolean().describe("true apenas se há contradição que INVALIDA o ponto de vista defendido."),
    explicacao: z.string(),
  }),
  falhasProjeto: z
    .array(
      z.object({
        trecho,
        descricao: z.string(),
        gravidade: z
          .enum(["falha", "deslize"])
          .describe("falha = prejudica a progressão/estratégia; deslize = pontual, não prejudica a progressão."),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Problemas de seleção, relação, organização ou interpretação das ideias."),
  argumentos: z
    .array(
      z.object({
        trecho,
        resumo: z.string(),
        desenvolvido: z
          .boolean()
          .describe("true se é fundamentado/desdobrado (explicação, exemplo, dado, causa-consequência)."),
        explicacao: z.string(),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Cada informação, fato ou opinião relevante apresentado em defesa do ponto de vista."),
  feedback,
});
export type C3Marking = z.infer<typeof C3MarkingSchema>;

// ───────────────────────── Competência IV ─────────────────────────

export const C4MarkingSchema = z.object({
  ausenciaArticulacao: z
    .boolean()
    .describe("true apenas se palavras e períodos são justapostos e desconexos ao longo de TODO o texto."),
  elementosCoesivos: z
    .array(
      z.object({
        trecho: z.string().describe("O elemento coesivo exatamente como escrito (ex.: 'Além disso')."),
        paragrafo: z.number().int().describe("Número do parágrafo (§) onde aparece."),
        posicao: z
          .enum(["interparagrafo", "intraparagrafo"])
          .describe("interparagrafo = relaciona o parágrafo ao anterior; intraparagrafo = articula ideias internas."),
        tipo: z.enum(["sequencial", "referencial"]).describe("sequencial = conectivo/operador; referencial = retomada."),
        operadorArgumentativo: z.boolean(),
        adequado: z.boolean().describe("false se a relação semântica estabelecida é inadequada (inadequação coesiva)."),
        explicacao: z.string(),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Elementos coesivos relevantes, um por ocorrência."),
  repeticoes: z
    .array(
      z.object({
        termo: z.string(),
        ocorrencias: z.number().int(),
        operadorArgumentativo: z.boolean(),
        prejudicaArticulacao: z
          .boolean()
          .describe("true se a repetição empobrece o repertório coesivo (não conta palavras do tema)."),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Repetições de termos ou conectivos."),
  feedback,
});
export type C4Marking = z.infer<typeof C4MarkingSchema>;

// ───────────────────────── Competência V ─────────────────────────

const elemento = z.object({ presente: z.boolean(), trecho: z.string() });
const elementoAnulavel = z.object({
  presente: z.boolean(),
  trecho: z.string(),
  nulo: z.boolean().describe("true se é elemento nulo (vago/genérico, ex.: 'medidas devem ser tomadas', 'alguém')."),
});

export const C5MarkingSchema = z.object({
  propostas: z
    .array(
      z.object({
        trecho,
        relacionadaAoAssunto: z.boolean(),
        condicional: z
          .boolean()
          .describe("true se construída com oração condicional desenvolvida ('se', 'caso', 'desde que')."),
        acao: elementoAnulavel,
        agente: elementoAnulavel,
        modoMeio: elemento,
        efeito: elemento,
        detalhamento: z.object({
          presente: z.boolean(),
          trecho: z.string(),
          referente: z.enum(["acao", "agente", "modoMeio", "efeito", "nenhum"]),
        }),
        trechoRecuperadoId: chunkRef,
      }),
    )
    .describe("Todas as propostas de intervenção do texto (ou lista vazia se não houver)."),
  desrespeitoDireitosHumanos: z.object({
    ocorre: z.boolean().describe("true se alguma proposta do participante desrespeita explicitamente os DH."),
    trecho: z.string(),
    explicacao: z.string(),
  }),
  copiaIntegralProposta: z.boolean().describe("true se a proposta é cópia integral dos textos da prova."),
  feedback,
});
export type C5Marking = z.infer<typeof C5MarkingSchema>;

export interface MarkingsByCompetency {
  1: C1Marking;
  2: C2Marking;
  3: C3Marking;
  4: C4Marking;
  5: C5Marking;
}

export const MARKING_SCHEMAS = {
  1: C1MarkingSchema,
  2: C2MarkingSchema,
  3: C3MarkingSchema,
  4: C4MarkingSchema,
  5: C5MarkingSchema,
} as const;

export const ParecerSchema = z.object({
  parecerGeral: z.string().describe("Parecer geral de 3 a 5 frases sobre a redação como um todo."),
});

// ───────────────────────── Aplicação dos trechos recuperados (modo RAG) ─────────────────────────

export interface ChunkApplication {
  id: string;
  seAplica: boolean;
  trechoRedacao: string;
  decisao: string;
}

/**
 * No modo RAG, o JSON de cada competência começa por `aplicacaoTrechos`: uma entrada
 * por trecho recuperado, na ordem do prompt, ANTES das marcações. Como a geração
 * segue a ordem dos campos, o modelo confronta cada regra com a redação e só depois
 * marca — e a decisão registrada fica auditável.
 */
export function withChunkApplications<S extends z.ZodObject>(schema: S, chunkIds: string[]) {
  if (!chunkIds.length) return schema;
  const ids = chunkIds as [string, ...string[]];
  const application = z.object({
    id: z.enum(ids).describe("ID do trecho recuperado, na mesma ordem em que aparece no prompt."),
    seAplica: z
      .boolean()
      .describe("true se a situação descrita no trecho ocorre nesta redação; false se não ocorre."),
    trechoRedacao: z
      .string()
      .describe('Cópia literal e curta do trecho da redação em que a situação ocorre; "" se não se aplica.'),
    decisao: z
      .string()
      .describe("Uma frase com a decisão de marcação que a regra impõe (ou por que não se aplica)."),
  });
  return z
    .object({
      aplicacaoTrechos: z
        .array(application)
        .min(ids.length)
        .max(ids.length)
        .describe("Preencha PRIMEIRO: uma entrada para cada trecho recuperado, antes de qualquer marcação."),
    })
    .extend(schema.shape);
}
