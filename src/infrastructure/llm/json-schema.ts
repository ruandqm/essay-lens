import { z } from "zod";

const ALLOWED = new Set(["type", "properties", "required", "items", "enum", "description", "minItems", "maxItems"]);

/**
 * Converte um schema Zod no subconjunto de JSON Schema aceito pelo Gemini
 * (`responseJsonSchema`), removendo palavras-chave não suportadas
 * (additionalProperties, limites de inteiros etc.).
 */
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" });
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (!ALLOWED.has(k)) continue;
      if (k === "properties") {
        out[k] = Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, clean(pv)]));
      } else out[k] = clean(v);
    }
    // Todos os campos são obrigatórios: força o modelo a preencher cada um.
    if (out.type === "object" && out.properties) out.required = Object.keys(out.properties as object);
    return out;
  };
  return clean(raw) as Record<string, unknown>;
}
