import { COMPETENCIES, type CompetencyId } from "@/domain/competencies";
import type { KnowledgeChunk } from "@/domain/knowledge";
import type { C2Marking } from "@/domain/markings";
import { renderRubric } from "@/knowledge/rubric";

export const SYSTEM_PROMPT = `Você é um avaliador experiente de redações do ENEM, capacitado pelo INEP.
Sua tarefa NÃO é atribuir notas. Você produz MARCAÇÕES ESTRUTURADAS que identificam, com trechos literais da redação, os aspectos que a Grade Específica manda observar. A nota é calculada depois, por regras determinísticas, a partir das suas marcações.

Regras:
- Responda apenas com o JSON pedido, em português do Brasil.
- Todo campo "trecho" deve ser uma cópia LITERAL e curta da redação (até ~25 palavras), para que possa ser localizado no texto.
- Seja rigoroso e fiel à Grade Específica; não seja generoso nem severo além do que os critérios indicam.
- Quando houver TRECHOS RECUPERADOS, use-os como referência do manual do INEP para decidir os casos que eles tratam. Um trecho só se aplica se a situação que ele descreve ocorrer de fato no texto; nunca adapte a leitura da redação para encaixar um trecho. Marcações decididas por um trecho trazem o seu ID em "trechoRecuperadoId"; nas demais, use "".
- Avalie apenas a competência pedida, sem penalizar aspectos de outras competências.`;

export interface PromptInput {
  tema: string;
  paragraphsNumbered: string;
  motivadores: string;
  competency: CompetencyId;
  retrieved: KnowledgeChunk[] | null;
  /** Situações detectadas na redação para esta competência (modo RAG). */
  situations?: { label: string; evidence: string[] }[];
  theme?: Pick<C2Marking, "abordagemTema" | "justificativaTema"> | null;
  stats: { paragraphCount: number; wordCount: number };
}

const TASKS: Record<CompetencyId, string> = {
  1: "Identifique cada desvio da norma-padrão e cada falha de estrutura sintática, e avalie a fluidez e a complexidade dos períodos.",
  2: "Avalie a abordagem do tema (elementos da frase temática), o tipo textual (partes embrionárias, traços de outros tipos, conclusão incompleta), a cópia dos motivadores, as situações de nota zero e cada repertório sociocultural.",
  3: "Identifique o ponto de vista, a direção do texto, eventual contradição grave, as falhas/deslizes de projeto de texto e cada argumento (desenvolvido ou não).",
  4: "Identifique os elementos coesivos (com parágrafo, posição, tipo, se é operador argumentativo e se está adequado) e as repetições que empobrecem o repertório coesivo.",
  5: "Identifique todas as propostas de intervenção e seus elementos (ação, agente, modo/meio, efeito, detalhamento), elementos nulos, condicionais e eventual desrespeito aos direitos humanos.",
};

export function buildCompetencyPrompt(p: PromptInput): string {
  const info = COMPETENCIES[p.competency];
  const sections: string[] = [
    `# COMPETÊNCIA ${info.roman} — ${info.title}`,
    `## TEMA DA PROPOSTA\n${p.tema}`,
  ];
  if (p.motivadores.trim()) sections.push(`## TEXTOS MOTIVADORES\n${p.motivadores.trim()}`);
  sections.push(
    `## REDAÇÃO (${p.stats.paragraphCount} parágrafos, ${p.stats.wordCount} palavras; § indica o número do parágrafo e não faz parte do texto)\n${p.paragraphsNumbered}`,
  );
  sections.push(`## RUBRICA FIXA DA COMPETÊNCIA ${info.roman}\n${renderRubric(p.competency)}`);

  if (p.theme && (p.competency === 3 || p.competency === 5)) {
    sections.push(
      `## ABORDAGEM DO TEMA (já avaliada na Competência II)\n${p.theme.abordagemTema} — ${p.theme.justificativaTema}`,
    );
  }

  if (p.retrieved) sections.push(renderRetrieved(p.retrieved, p.situations ?? []));

  const ragStep = p.retrieved?.length
    ? `\nAntes das marcações, preencha "aplicacaoTrechos" (uma entrada por trecho recuperado, na ordem) e, em seguida, faça marcações coerentes com as decisões registradas.`
    : "";
  sections.push(`## TAREFA\n${TASKS[p.competency]}${ragStep}\nPreencha todos os campos do JSON.`);
  return sections.join("\n\n");
}

function renderRetrieved(chunks: KnowledgeChunk[], situations: { label: string; evidence: string[] }[]) {
  const head = "## TRECHOS RECUPERADOS DOS MANUAIS DO INEP (RAG)";
  if (!chunks.length) return `${head}\nNenhum trecho atingiu o limiar de relevância; use apenas a rubrica fixa.`;
  const parts = [
    head,
    "Regras e casos-limite do manual do INEP selecionados para esta redação (por situações detectadas no texto e por similaridade). Use-os para decidir os casos que eles tratam; um trecho que não corresponde ao texto deve ser ignorado.",
  ];
  if (situations.length) {
    parts.push(
      `Situações detectadas automaticamente (são pistas, podem ser falsos positivos; confirme no texto):\n${situations
        .map((s) => `- ${s.label}${s.evidence.length ? `: ${s.evidence.join(" | ")}` : ""}`)
        .join("\n")}`,
    );
  }
  parts.push(chunks.map((c, i) => `[${c.id}] (${i + 1}/${chunks.length}) ${c.title} — ${c.type}\n${c.text}`).join("\n\n"));
  parts.push(
    `Como usar os trechos:
1. Para cada trecho, verifique se a situação que ele descreve ocorre no texto. Se ocorrer, registre seAplica=true, o trecho literal da redação e a decisão que a regra indica; se não ocorrer ou houver dúvida, seAplica=false (é normal que vários trechos não se apliquem).
2. Faça as marcações e cite o ID em "trechoRecuperadoId" apenas nas marcações decididas por um trecho aplicado.`,
  );
  return parts.join("\n\n");
}

export function buildParecerPrompt(input: {
  tema: string;
  total: number;
  lines: string[];
}): string {
  return `Escreva o parecer geral (3 a 5 frases, tom pedagógico e direto, em português) de uma redação do ENEM.
Tema: ${input.tema}
Nota total calculada: ${input.total}/1000
Resumo por competência:
${input.lines.join("\n")}

Não altere as notas; destaque pontos fortes e o que mais limita a nota.`;
}
