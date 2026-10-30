"use client";

import { useMemo, useState } from "react";
import { COMPETENCIES } from "@/domain/competencies";
import type { Annotation, RetrievedChunkRef } from "@/domain/grading";
import { Badge, cn } from "../ui";

interface Span {
  start: number;
  end: number;
  annotations: Annotation[];
}

/** Localiza o trecho no texto ignorando maiúsculas, espaços e aspas tipográficas. */
export function findQuote(text: string, quote: string, from = 0): [number, number] | null {
  const q = quote.trim().replace(/^[“"'…]+|[”"'…]+$/g, "");
  if (q.length < 2) return null;
  const exact = text.indexOf(q, from);
  if (exact >= 0) return [exact, exact + q.length];
  const norm = (ch: string) => ch.toLowerCase().replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'");
  // Mapa de posições do texto sem espaços repetidos.
  const map: number[] = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      if (flat.endsWith(" ")) continue;
      flat += " ";
    } else flat += norm(c);
    map.push(i);
  }
  const nq = q.replace(/\s+/g, " ").split("").map(norm).join("");
  const idx = flat.indexOf(nq);
  if (idx < 0) return null;
  return [map[idx]!, map[idx + nq.length - 1]! + 1];
}

function buildSpans(text: string, annotations: Annotation[]): Span[] {
  const located: { start: number; end: number; a: Annotation }[] = [];
  for (const a of annotations) {
    const pos = findQuote(text, a.quote);
    if (pos) located.push({ start: pos[0], end: pos[1], a });
  }
  located.sort((x, y) => x.start - y.start || y.end - x.end);
  const spans: Span[] = [];
  for (const l of located) {
    const last = spans[spans.length - 1];
    if (last && l.start < last.end) {
      // Sobreposição: agrupa na marcação existente.
      last.annotations.push(l.a);
      last.end = Math.max(last.end, l.end);
    } else spans.push({ start: l.start, end: l.end, annotations: [l.a] });
  }
  return spans;
}

const KIND_ORDER = { erro: 0, alerta: 1, destaque: 2 } as const;

export function AnnotatedEssay({
  text,
  annotations,
  chunks,
  filter,
}: {
  text: string;
  annotations: Annotation[];
  chunks: Map<string, RetrievedChunkRef>;
  filter: number | null;
}) {
  const visible = useMemo(
    () => annotations.filter((a) => filter === null || a.competency === filter),
    [annotations, filter],
  );
  const spans = useMemo(() => buildSpans(text, visible), [text, visible]);
  const [active, setActive] = useState<number | null>(null);
  const located = spans.reduce((n, s) => n + s.annotations.length, 0);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) nodes.push(text.slice(cursor, s.start));
    const top = [...s.annotations].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind])[0]!;
    const rag = s.annotations.some((a) => a.chunkId && chunks.has(a.chunkId));
    nodes.push(
      <span
        key={i}
        role="button"
        tabIndex={0}
        data-active={active === i}
        onClick={() => setActive(active === i ? null : i)}
        onKeyDown={(e) => e.key === "Enter" && setActive(active === i ? null : i)}
        className={cn("mark", `mark-${top.kind}`, rag && "mark-rag")}
      >
        {text.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  const current = active !== null ? spans[active] : null;

  return (
    <div>
      <div className="rounded-xl border border-line bg-bg/40 p-4 text-[15px] leading-8 whitespace-pre-wrap text-ink/90 sm:p-5">
        {nodes}
      </div>
      <div className="mt-2 text-[11px] text-ink-3">
        {located} de {visible.length} marcações localizadas no texto. Clique em um trecho destacado para ver o comentário.
      </div>
      {current && (
        <div className="mt-3 space-y-2">
          {current.annotations.map((a, i) => {
            const chunk = a.chunkId ? chunks.get(a.chunkId) : undefined;
            return (
              <div key={i} className="rounded-xl border border-line bg-surface-2 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.kind === "erro" ? "bad" : a.kind === "alerta" ? "warn" : "ok"}>{a.label}</Badge>
                  <span className="text-[11px] text-ink-3">
                    C{a.competency} · {COMPETENCIES[a.competency].short}
                  </span>
                </div>
                <p className="mt-2 text-sm text-ink-2">{a.comment}</p>
                {chunk && (
                  <p className="mt-2 text-xs text-rag">
                    Fundamentado no manual: “{chunk.title}” <span className="text-ink-3">({chunk.id})</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
