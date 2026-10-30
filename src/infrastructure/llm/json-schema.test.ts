import { describe, expect, it } from "vitest";
import { MARKING_SCHEMAS } from "@/domain/markings";
import { toGeminiSchema } from "./json-schema";

describe("schema para o Gemini", () => {
  it("usa apenas palavras-chave suportadas", () => {
    const allowed = new Set(["type", "properties", "required", "items", "enum", "description", "minItems", "maxItems"]);
    for (const schema of Object.values(MARKING_SCHEMAS)) {
      const walk = (n: unknown, inProps = false): void => {
        if (Array.isArray(n)) return n.forEach((x) => walk(x));
        if (!n || typeof n !== "object") return;
        for (const [k, v] of Object.entries(n)) {
          if (!inProps) expect(allowed.has(k), k).toBe(true);
          walk(v, k === "properties" && !inProps);
        }
      };
      walk(toGeminiSchema(schema));
    }
  });
});

describe("aplicação dos trechos recuperados", () => {
  it("vem antes das marcações, com um item por trecho e IDs restritos", async () => {
    const { withChunkApplications } = await import("@/domain/markings");
    const ids = ["comp5-aaaaaaaaaa", "comp5-bbbbbbbbbb"];
    const json = toGeminiSchema(withChunkApplications(MARKING_SCHEMAS[5], ids)) as {
      properties: Record<string, { minItems: number; maxItems: number; items: { properties: { id: { enum: string[] } } } }>;
    };
    const keys = Object.keys(json.properties);
    expect(keys[0]).toBe("aplicacaoTrechos");
    expect(keys).toContain("propostas");
    const app = json.properties.aplicacaoTrechos!;
    expect(app.minItems).toBe(2);
    expect(app.maxItems).toBe(2);
    expect(app.items.properties.id.enum).toEqual(ids);
  });

  it("sem trechos, o schema fica igual ao do modo sem RAG", async () => {
    const { withChunkApplications } = await import("@/domain/markings");
    expect(withChunkApplications(MARKING_SCHEMAS[3], [])).toBe(MARKING_SCHEMAS[3]);
  });
});

describe("limite de requisições (429)", () => {
  it("lê a espera sugerida e identifica cota diária", async () => {
    const { rateLimitInfo } = await import("./gemini-client");
    expect(rateLimitInfo(new Error('{"retryDelay": "37s"}')).retryAfterMs).toBe(37000);
    expect(rateLimitInfo(new Error("Please retry in 12.5s.")).retryAfterMs).toBe(12500);
    expect(rateLimitInfo(new Error("Quota exceeded for metric GenerateRequestsPerDayPerProjectPerModel")).daily).toBe(true);
    expect(rateLimitInfo(new Error("Too many requests")).retryAfterMs).toBeNull();
  });
});
