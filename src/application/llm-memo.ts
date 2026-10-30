import type { LlmClient, LlmJsonRequest, LlmJsonResponse } from "./ports";

/**
 * Decorador que reaproveita respostas já obtidas para o mesmo pedido.
 * Usado por correção de experimento: se o limite do Gemini interromper a correção
 * no meio, a nova tentativa reaproveita as competências que já tinham voltado
 * (o prompt é determinístico) e só refaz as que faltaram.
 */
export function memoizeLlm(llm: LlmClient): LlmClient {
  const cache = new Map<string, Promise<LlmJsonResponse<unknown>>>();
  return {
    model: llm.model,
    generateJson<T>(req: LlmJsonRequest<T>): Promise<LlmJsonResponse<T>> {
      const key = `${req.label}\u0000${req.system}\u0000${req.prompt}`;
      const hit = cache.get(key);
      if (hit) return hit as Promise<LlmJsonResponse<T>>;
      const pending = llm.generateJson(req);
      cache.set(key, pending);
      pending.catch(() => cache.delete(key));
      return pending;
    },
  };
}
