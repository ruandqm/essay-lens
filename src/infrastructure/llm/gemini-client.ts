import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { RateLimitError, type LlmClient, type LlmJsonRequest, type LlmJsonResponse } from "@/application/ports";
import { Semaphore, sleep } from "../semaphore";
import { toGeminiSchema } from "./json-schema";

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
/** Tentativas para erros transitórios (5xx, rede) e de formato. O 429 é limitado por tempo. */
const MAX_ATTEMPTS = 5;

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * Cliente Gemini com saída JSON validada por Zod, retentativas e limite de concorrência.
 *
 * Limite de requisições (429): todas as chamadas deste cliente entram numa pausa
 * compartilhada ("cooldown"), com a espera sugerida pela API quando disponível,
 * em vez de cada uma insistir sozinha. Se o limite persistir além de
 * `rateLimitMaxWaitMs`, lança `RateLimitError` para o chamador decidir.
 */
export class GeminiLlmClient implements LlmClient {
  private ai: GoogleGenAI;
  private sem: Semaphore;
  private cooldownUntil = 0;
  private strikes = 0;

  constructor(
    apiKey: string,
    readonly model: string,
    private readonly temperature: number,
    maxConcurrency: number,
    private readonly rateLimitMaxWaitMs = 120_000,
  ) {
    if (!apiKey) throw new LlmError("GEMINI_API_KEY não configurada. Adicione a chave em .env.local e reinicie o servidor.");
    this.ai = new GoogleGenAI({ apiKey });
    this.sem = new Semaphore(maxConcurrency);
  }

  async generateJson<T>(req: LlmJsonRequest<T>): Promise<LlmJsonResponse<T>> {
    const jsonSchema = toGeminiSchema(req.schema as z.ZodType);
    const started = Date.now();

    let lastError: unknown;
    let correction = "";
    let attempts = 0;
    while (true) {
      await this.waitCooldown();
      attempts++;
      const t0 = Date.now();
      try {
        const response = await this.sem.run(() =>
          this.ai.models.generateContent({
            model: this.model,
            contents: [{ role: "user", parts: [{ text: req.prompt + correction }] }],
            config: {
              systemInstruction: req.system,
              temperature: this.temperature,
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
            },
          }),
        );
        this.strikes = 0;
        const text = response.text ?? "";
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new SchemaMismatch("Resposta não é JSON válido.");
        }
        const result = req.schema.safeParse(parsed);
        if (!result.success) throw new SchemaMismatch(z.prettifyError(result.error).slice(0, 800));
        return {
          data: result.data,
          latencyMs: Date.now() - t0,
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
          },
        };
      } catch (err) {
        lastError = err;
        if (err instanceof SchemaMismatch) {
          if (attempts >= MAX_ATTEMPTS) break;
          // Reenvia pedindo correção do formato.
          correction = `\n\nATENÇÃO: sua resposta anterior não seguiu o schema (${err.message}). Responda novamente com JSON completo e válido.`;
          continue;
        }
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 429) {
          const info = rateLimitInfo(err);
          if (info.daily) throw new RateLimitError(`Cota diária do Gemini esgotada (${req.label}).`, info.retryAfterMs, true);
          const wait = this.enterCooldown(info.retryAfterMs);
          if (Date.now() - started + wait > this.rateLimitMaxWaitMs) {
            throw new RateLimitError(
              `Limite de requisições do Gemini atingido (${req.label}) e não liberou em ${Math.round(this.rateLimitMaxWaitMs / 1000)} s.`,
              info.retryAfterMs,
            );
          }
          continue;
        }
        if (status && !RETRYABLE.has(status)) {
          throw new LlmError(describe(status, err, this.model), status);
        }
        if (attempts >= MAX_ATTEMPTS) break;
        await sleep(Math.min(30_000, 1000 * 2 ** (attempts - 1) + Math.random() * 500));
      }
    }
    const status = lastError instanceof ApiError ? lastError.status : undefined;
    throw new LlmError(
      `Falha ao obter marcações (${req.label}) após ${attempts} tentativas: ${describe(status, lastError, this.model)}`,
      status,
    );
  }

  private async waitCooldown() {
    let wait = this.cooldownUntil - Date.now();
    while (wait > 0) {
      await sleep(wait);
      wait = this.cooldownUntil - Date.now();
    }
  }

  /** Abre (ou estende) a pausa compartilhada e devolve quanto tempo ela dura a partir de agora. */
  private enterCooldown(retryAfterMs: number | null) {
    this.strikes++;
    const backoff = Math.min(60_000, 2000 * 2 ** (this.strikes - 1));
    const wait = (retryAfterMs ?? backoff) + Math.random() * 1000;
    this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + wait);
    return this.cooldownUntil - Date.now();
  }
}

class SchemaMismatch extends Error {}

/** Extrai da resposta 429 a espera sugerida ("retryDelay": "37s" / "retry in 37.5s") e se a cota é diária. */
export function rateLimitInfo(err: unknown): { retryAfterMs: number | null; daily: boolean } {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retryDelay"?\s*:\s*"(\d+(?:\.\d+)?)s"/i) ?? msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return {
    retryAfterMs: m ? Math.ceil(Number(m[1]) * 1000) : null,
    daily: /per ?day|PerDay|daily/i.test(msg),
  };
}

function describe(status: number | undefined, err: unknown, model: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 400 && /api key/i.test(msg)) return "Chave GEMINI_API_KEY inválida.";
  if (status === 401 || status === 403) return "Chave GEMINI_API_KEY sem permissão.";
  if (status === 404) return `Modelo "${model}" não encontrado. Ajuste GEMINI_MODEL em .env.local.`;
  if (status === 429) return "Limite de requisições do Gemini atingido (429). Reduza GEMINI_MAX_CONCURRENCY ou aguarde.";
  return msg.slice(0, 500);
}
