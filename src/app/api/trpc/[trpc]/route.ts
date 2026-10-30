import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Uma correção faz 6 chamadas ao Gemini; dá folga para modelos mais lentos.
export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: "/api/trpc", req, router: appRouter, createContext: () => ({}) });

export { handler as GET, handler as POST };
