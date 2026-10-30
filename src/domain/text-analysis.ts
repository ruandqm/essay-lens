/**
 * Análise determinística da superfície do texto. Tudo que pode ser medido sem
 * interpretação (parágrafos, períodos, palavras) é calculado aqui, e não pelo modelo.
 */

export interface TextStats {
  paragraphs: string[];
  paragraphCount: number;
  wordCount: number;
  /** Estimativa de linhas manuscritas na folha oficial (~10 palavras por linha). */
  estimatedLines: number;
  sentencesPerParagraph: number[];
  singleSentenceParagraphs: number;
  /** Mais da metade dos parágrafos tem um único período (diretriz da Competência I). */
  singleSentenceDominant: boolean;
  /** Texto sem paragrafação (Competência IV: não ultrapassa o nível 2). */
  monobloco: boolean;
}

export const WORDS_PER_HANDWRITTEN_LINE = 10;
/** Até 7 linhas = "texto insuficiente" (nota zero). */
export const MIN_LINES = 8;

export function normalizeEssay(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitParagraphs(text: string): string[] {
  const normalized = normalizeEssay(text);
  if (!normalized) return [];
  // Aceita tanto linhas em branco quanto quebras simples como separadores de parágrafo.
  return normalized
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}"“(«0-9])/u)
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);
}

export function analyzeText(text: string): TextStats {
  const paragraphs = splitParagraphs(text);
  const wordCount = countWords(text);
  const sentencesPerParagraph = paragraphs.map((p) => splitSentences(p).length);
  const singleSentenceParagraphs = sentencesPerParagraph.filter((n) => n <= 1).length;
  return {
    paragraphs,
    paragraphCount: paragraphs.length,
    wordCount,
    estimatedLines: Math.ceil(wordCount / WORDS_PER_HANDWRITTEN_LINE),
    sentencesPerParagraph,
    singleSentenceParagraphs,
    singleSentenceDominant: paragraphs.length > 0 && singleSentenceParagraphs > paragraphs.length / 2,
    monobloco: paragraphs.length === 1,
  };
}

/** Texto numerado por parágrafo (§1, §2...) para que o modelo referencie posições. */
export function numberParagraphs(paragraphs: string[]): string {
  return paragraphs.map((p, i) => `§${i + 1} ${p}`).join("\n\n");
}
