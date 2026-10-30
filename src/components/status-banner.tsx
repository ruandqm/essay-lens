"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useTRPC } from "@/lib/trpc";

/** Mostra problemas de configuração (chave do Gemini, índice vetorial). */
export function StatusBanner({ needIndex = true }: { needIndex?: boolean }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.system.status.queryOptions());
  if (!data) return null;
  const issues: string[] = [];
  if (!data.geminiConfigured) issues.push("Defina GEMINI_API_KEY em .env.local e reinicie o servidor (pnpm dev).");
  if (needIndex && !data.index.ok && data.index.reason) issues.push(data.index.reason);
  if (!issues.length) return null;
  return (
    <div className="mt-6 flex gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <ul className="space-y-1">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
