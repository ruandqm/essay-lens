/**
 * Critérios operacionais de contagem.
 *
 * A Grade Específica do INEP usa termos como "poucos", "alguns" e "muitos" desvios,
 * que o avaliador humano calibra pelo "conjunto textual". Para tornar a pontuação
 * exata e testável, estes limiares convertem contagens em categorias da grade.
 * As contagens são normalizadas para um texto de referência de 300 palavras
 * (~30 linhas manuscritas), de modo que textos curtos não sejam favorecidos.
 *
 * Os mesmos valores são inseridos na rubrica fixa enviada ao modelo
 * (ver `knowledge/rubric.ts`), garantindo que prompt e cálculo nunca divirjam.
 */
export const REFERENCE_WORDS = 300;
/** Evita que textos muito curtos inflem a densidade. */
export const MIN_WORDS_FOR_DENSITY = 150;

export const per300 = (count: number, words: number) =>
  (count * REFERENCE_WORDS) / Math.max(words, MIN_WORDS_FOR_DENSITY);

export const C1_CRITERIA = {
  /** Nível 5: no máximo 2 desvios (valor absoluto, definido pela própria grade). */
  maxDesviosNivel5: 2,
  /** Nível 5: no máximo 1 falha de estrutura (valor absoluto, definido pela própria grade). */
  maxFalhasNivel5: 1,
  /** Desvios a cada 300 palavras. */
  desviosPoucosAte: 5,
  desviosAlgunsAte: 9,
  /** Falhas de estrutura a cada 300 palavras para "estrutura boa". */
  falhasBoaAte: 3,
} as const;

export const C3_CRITERIA = {
  /** Falhas de projeto (não deslizes): 0 = estratégico, 1 = poucas, 2–3 = algumas, ≥4 = muitas. */
  poucasFalhasAte: 1,
  algumasFalhasAte: 3,
  /** Proporção de argumentos desenvolvidos para "maior parte". */
  maiorParteMin: 0.6,
} as const;

export const C4_CRITERIA = {
  /** Nível 5: operadores argumentativos interparágrafos em ≥ 2 momentos (definido pela grade). */
  interOperadoresNivel5: 2,
  /** Nível 4: operador argumentativo interparágrafos em ≥ 1 momento (definido pela grade). */
  interOperadoresNivel4: 1,
  /** Coesivos sequenciais adequados por parágrafo para "presença expressiva". */
  sequenciaisPorParagrafoExpressiva: 2.5,
  /** Coesivos adequados (qualquer tipo) por parágrafo para "presença constante". */
  coesivosPorParagrafoConstante: 2,
  /** Para "presença regular": ao menos N coesivos sequenciais adequados no texto. */
  sequenciaisRegularMin: 3,
  /** Para "presença pontual": ao menos N coesivos adequados no texto. */
  coesivosPontualMin: 3,
  /**
   * Repetições prejudiciais (operador argumentativo pesa 2) e inadequações:
   * 0–1 raras · 2 poucas · 3–4 algumas · 5–6 muitas · ≥7 excessivas.
   * (Inadequações: 0 = nenhuma · 1–2 poucas · 3–4 algumas · 5–6 muitas · ≥7 excessivas.)
   */
  rarasAte: 1,
  poucasAte: 2,
  algumasAte: 4,
  muitasAte: 6,
} as const;
