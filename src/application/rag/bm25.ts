/**
 * BM25 (Best Matching 25) — canal lexical da recuperação híbrida.
 * Tokenização para português: minúsculas, remoção de acentos e stopwords e
 * "stemming" por truncamento (6 caracteres), simples e eficaz para BM25.
 */

const STOPWORDS = new Set(
  (
    "a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra com sem sob sobre " +
    "e ou mas que se como quando onde qual quais quem cujo cuja ao aos à às entre ate até apos após " +
    "eu tu ele ela nos vos eles elas me te lhe lhes meu minha seu sua seus suas nosso nossa isso isto esse essa este esta " +
    "aquele aquela ja já nao não sim mais menos muito muita muitos muitas pouco tambem também so só ser estar ter haver " +
    "é são foi era sao está estão tem têm há sendo sido pode podem deve devem cada todo toda todos todas outro outra " +
    "assim entao então pois porque porem porém contudo ainda apenas mesmo mesma bem tal tais lo la los las"
  ).split(/\s+/),
);

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function tokenize(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => t.slice(0, 6));
}

export interface Bm25Index {
  docs: string[][];
  df: Map<string, number>;
  avgdl: number;
}

export function buildBm25(texts: string[]): Bm25Index {
  const docs = texts.map(tokenize);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const avgdl = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  return { docs, df, avgdl };
}

export function bm25Scores(index: Bm25Index, query: string, k1 = 1.2, b = 0.75): number[] {
  // Termos únicos: evita que a redação longa domine pela frequência na consulta.
  const q = [...new Set(tokenize(query))];
  const N = index.docs.length;
  return index.docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of q) {
      const f = tf.get(term);
      if (!f) continue;
      const n = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / index.avgdl)));
    }
    return score;
  });
}
