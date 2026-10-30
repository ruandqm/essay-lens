import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { isRateLimitError } from "@/application/ports";
import { LlmError } from "@/infrastructure/llm/gemini-client";

const t = initTRPC.create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: error.cause instanceof ZodError ? error.cause.issues.map((i) => i.message).join(" · ") : shape.message,
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Converte erros de infraestrutura em mensagens claras para a interface. */
const errorMapper = t.middleware(async ({ next }) => {
  const res = await next();
  if (!res.ok && !(res.error.cause instanceof ZodError) && res.error.code === "INTERNAL_SERVER_ERROR") {
    const cause = res.error.cause;
    console.error("[trpc]", cause ?? res.error);
    if (isRateLimitError(cause)) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: cause.daily
          ? "A cota diária do Gemini acabou. Tente amanhã ou troque GEMINI_MODEL em .env.local."
          : "O Gemini está no limite de requisições. Aguarde um minuto e tente de novo — seu texto continua salvo aqui.",
        cause,
      });
    }
    throw new TRPCError({
      code: cause instanceof LlmError && cause.status === 429 ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR",
      message: cause instanceof Error ? cause.message : res.error.message,
      cause,
    });
  }
  return res;
});

export const publicProcedure = t.procedure.use(errorMapper);
