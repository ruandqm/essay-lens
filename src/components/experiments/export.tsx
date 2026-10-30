"use client";

import { Check, Copy, Download, ImageDown } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toast } from "sonner";
import type { ChartTheme } from "../charts/charts";
import { Button, Card, CardHeader } from "../ui";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function svgString(el: ReactElement) {
  let s = renderToStaticMarkup(el);
  if (!s.includes("xmlns=")) s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  // Exporta com largura fixa (o viewBox define o tamanho em pixels).
  const vb = s.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (vb) s = s.replace('width="100%"', `width="${vb[1]}" height="${vb[2]}"`);
  return { svg: s, width: Number(vb?.[1] ?? 800), height: Number(vb?.[2] ?? 500) };
}

export async function exportPng(el: ReactElement, filename: string, scale = 3) {
  const { svg, width, height } = svgString(el);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao renderizar o SVG."));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  canvas.toBlob((b) => b && download(b, `${filename}.png`), "image/png");
}

/** Cartão de gráfico com exportação em PNG (300 dpi aprox.) e SVG, em tema claro para documentos. */
export function ChartCard({
  title,
  subtitle,
  filename,
  render,
  children,
}: {
  title: string;
  subtitle?: string;
  filename: string;
  render: (theme: ChartTheme) => ReactElement;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <Button size="sm" onClick={() => exportPng(render("print"), filename).catch((e) => toast.error(e.message))}>
              <ImageDown className="size-3.5" /> PNG
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => download(new Blob([svgString(render("print")).svg], { type: "image/svg+xml" }), `${filename}.svg`)}
            >
              <Download className="size-3.5" /> SVG
            </Button>
          </>
        }
      />
      <div className="p-4 sm:p-5">{render("dark")}</div>
      {children}
    </Card>
  );
}

type Cell = string | number | null | undefined;

export const toTsv = (rows: Cell[][]) => rows.map((r) => r.map((c) => String(c ?? "")).join("\t")).join("\n");
export const toCsv = (rows: Cell[][]) =>
  rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");

/** Copia a tabela como TSV (cola direto como tabela no Word/Google Docs) ou baixa CSV. */
export function CopyTableButton({ rows, filename }: { rows: Cell[][]; filename?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(toTsv(rows));
          setDone(true);
          toast.success("Tabela copiada — cole no Word ou Google Docs");
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copiar
      </Button>
      {filename && (
        <Button size="sm" variant="ghost" onClick={() => download(new Blob(["﻿" + toCsv(rows)], { type: "text/csv" }), `${filename}.csv`)}>
          <Download className="size-3.5" /> CSV
        </Button>
      )}
    </div>
  );
}
