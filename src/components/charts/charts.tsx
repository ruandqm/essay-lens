/**
 * Gráficos SVG próprios: o mesmo componente renderiza no tema escuro da interface
 * e no tema "print" (fundo branco) usado na exportação PNG/SVG.
 * Paleta categórica validada (CVD e contraste) para os dois fundos.
 */

export type ChartTheme = "dark" | "print";

export const SERIES_COLORS = {
  human: { dark: "#14a394", print: "#0f9488" },
  baseline: { dark: "#3b82f6", print: "#2563eb" },
  rag: { dark: "#e8590c", print: "#e8590c" },
} as const;

export function themeTokens(theme: ChartTheme) {
  return theme === "print"
    ? { bg: "#ffffff", ink: "#111827", ink2: "#374151", ink3: "#6b7280", grid: "#e5e7eb", axis: "#9ca3af", font: "Arial, Helvetica, sans-serif" }
    : { bg: "transparent", ink: "#eef0f7", ink2: "#a9aec4", ink3: "#6f7590", grid: "#262b40", axis: "#353b55", font: "var(--font-inter), sans-serif" };
}

export interface Series {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
}

const fmt = (v: number, decimals: number) => v.toFixed(decimals).replace(".", ",");

function niceMax(v: number) {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function Legend({ series, x, y, theme }: { series: { label: string; color: string }[]; x: number; y: number; theme: ChartTheme }) {
  const t = themeTokens(theme);
  let cx = x;
  return (
    <g>
      {series.map((s) => {
        const w = 22 + s.label.length * 6.6 + 18;
        const node = (
          <g key={s.label} transform={`translate(${cx},${y})`}>
            <rect width={12} height={12} rx={3} fill={s.color} />
            <text x={18} y={10.5} fontSize={12} fill={t.ink2} fontFamily={t.font}>
              {s.label}
            </text>
          </g>
        );
        cx += w;
        return node;
      })}
    </g>
  );
}

export function GroupedBarChart({
  title,
  categories,
  series,
  yLabel,
  xLabel,
  theme,
  decimals = 0,
  width = 760,
  height = 420,
  yMax,
  showValues,
}: {
  showValues?: boolean;
  title?: string;
  categories: string[];
  series: Series[];
  yLabel: string;
  xLabel?: string;
  theme: ChartTheme;
  decimals?: number;
  width?: number;
  height?: number;
  yMax?: number;
}) {
  const t = themeTokens(theme);
  const m = { top: title ? 64 : 40, right: 20, bottom: xLabel ? 58 : 40, left: 62 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = yMax ?? niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null))) * 1.12);
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const groupW = w / categories.length;
  const gap = 2;
  const barW = Math.min(46, (groupW * 0.72 - gap * (series.length - 1)) / series.length);
  const y = (v: number) => m.top + h - (v / max) * h;
  const labels = showValues ?? categories.length * series.length <= 16;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? yLabel} style={{ background: t.bg, fontFamily: t.font }}>
      {title && (
        <text x={width / 2} y={24} textAnchor="middle" fontSize={16} fontWeight={600} fill={t.ink}>
          {title}
        </text>
      )}
      <Legend series={series} x={m.left} y={title ? 36 : 10} theme={theme} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke={t.grid} strokeWidth={1} />
          <text x={m.left - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={t.ink3}>
            {fmt(v, max < 10 ? 1 : 0)}
          </text>
        </g>
      ))}
      <line x1={m.left} x2={m.left + w} y1={m.top + h} y2={m.top + h} stroke={t.axis} />
      <text transform={`translate(16,${m.top + h / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill={t.ink2}>
        {yLabel}
      </text>
      {xLabel && (
        <text x={m.left + w / 2} y={height - 12} textAnchor="middle" fontSize={12} fill={t.ink2}>
          {xLabel}
        </text>
      )}
      {categories.map((cat, ci) => {
        const gx = m.left + ci * groupW + (groupW - (barW * series.length + gap * (series.length - 1))) / 2;
        return (
          <g key={cat}>
            {series.map((s, si) => {
              const v = s.values[ci];
              if (v === null || v === undefined) return null;
              const x = gx + si * (barW + gap);
              const top = y(v);
              const bh = Math.max(0, m.top + h - top);
              const r = Math.min(4, bh / 2, barW / 2);
              // Retângulo com cantos superiores arredondados, ancorado na base.
              const d = `M${x},${m.top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${m.top + h} Z`;
              return (
                <g key={s.key} className="chart-mark">
                  <path d={d} fill={s.color}>
                    <title>{`${cat} · ${s.label}: ${fmt(v, decimals)}`}</title>
                  </path>
                  {labels && (
                    <text x={x + barW / 2} y={top - 6} textAnchor="middle" fontSize={11} fill={t.ink2}>
                      {fmt(v, decimals)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={m.left + ci * groupW + groupW / 2} y={m.top + h + 18} textAnchor="middle" fontSize={12} fill={t.ink2}>
              {cat}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ScatterChart({
  title,
  points,
  theme,
  max = 1000,
  width = 560,
  height = 480,
  xLabel,
  yLabel,
}: {
  title?: string;
  points: { series: string; color: string; x: number; y: number; label: string }[];
  theme: ChartTheme;
  max?: number;
  width?: number;
  height?: number;
  xLabel: string;
  yLabel: string;
}) {
  const t = themeTokens(theme);
  const m = { top: title ? 64 : 40, right: 24, bottom: 52, left: 62 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const sx = (v: number) => m.left + (v / max) * w;
  const sy = (v: number) => m.top + h - (v / max) * h;
  const ticks = Array.from({ length: 6 }, (_, i) => (max / 5) * i);
  const series = [...new Map(points.map((p) => [p.series, p.color])).entries()].map(([label, color]) => ({ label, color }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? "Dispersão"} style={{ background: t.bg, fontFamily: t.font }}>
      {title && (
        <text x={width / 2} y={24} textAnchor="middle" fontSize={16} fontWeight={600} fill={t.ink}>
          {title}
        </text>
      )}
      <Legend series={series} x={m.left} y={title ? 36 : 10} theme={theme} />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={m.left} x2={m.left + w} y1={sy(v)} y2={sy(v)} stroke={t.grid} />
          <line x1={sx(v)} x2={sx(v)} y1={m.top} y2={m.top + h} stroke={t.grid} />
          <text x={m.left - 8} y={sy(v) + 4} textAnchor="end" fontSize={11} fill={t.ink3}>
            {v}
          </text>
          <text x={sx(v)} y={m.top + h + 16} textAnchor="middle" fontSize={11} fill={t.ink3}>
            {v}
          </text>
        </g>
      ))}
      <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke={t.ink3} strokeDasharray="5 5" strokeWidth={1.5} />
      {/* Rótulo na parte baixa da diagonal, onde quase nunca há pontos. */}
      <text
        x={sx(max * 0.16)}
        y={sy(max * 0.16) - 8}
        textAnchor="middle"
        fontSize={11}
        fill={t.ink3}
        transform={`rotate(${(-Math.atan2(h, w) * 180) / Math.PI} ${sx(max * 0.16)} ${sy(max * 0.16) - 8})`}
      >
        concordância perfeita
      </text>
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={6} fill={p.color} stroke={theme === "print" ? "#fff" : "#121522"} strokeWidth={2} fillOpacity={0.9}>
          <title>{`${p.label} · ${p.series}: humano ${p.x}, IA ${Math.round(p.y)}`}</title>
        </circle>
      ))}
      <text x={m.left + w / 2} y={height - 10} textAnchor="middle" fontSize={12} fill={t.ink2}>
        {xLabel}
      </text>
      <text transform={`translate(16,${m.top + h / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill={t.ink2}>
        {yLabel}
      </text>
    </svg>
  );
}

/** Mapa de calor do erro absoluto (sequencial, uma matiz). */
export function Heatmap({
  title,
  rows,
  cols,
  values,
  theme,
  max = 200,
  width = 760,
}: {
  title?: string;
  rows: string[];
  cols: string[];
  values: number[][];
  theme: ChartTheme;
  max?: number;
  width?: number;
}) {
  const t = themeTokens(theme);
  const cell = 34;
  const m = { top: title ? 60 : 30, left: 70, right: 20, bottom: 50 };
  const w = width - m.left - m.right;
  const cw = w / cols.length;
  const height = m.top + rows.length * cell + m.bottom;
  const color = (v: number) => {
    const k = Math.min(1, v / max);
    // Rampa de laranja: claro (erro 0) → escuro (erro máximo).
    const from = theme === "print" ? [255, 247, 237] : [30, 34, 52];
    const to = [194, 65, 12];
    return `rgb(${from.map((f, i) => Math.round(f + (to[i]! - f) * k)).join(",")})`;
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? "Mapa de calor"} style={{ background: t.bg, fontFamily: t.font }}>
      {title && (
        <text x={width / 2} y={24} textAnchor="middle" fontSize={16} fontWeight={600} fill={t.ink}>
          {title}
        </text>
      )}
      {cols.map((c, j) => (
        <text key={c} x={m.left + j * cw + cw / 2} y={m.top - 8} textAnchor="middle" fontSize={11} fill={t.ink2}>
          {c}
        </text>
      ))}
      {rows.map((r, i) => (
        <g key={r}>
          <text x={m.left - 8} y={m.top + i * cell + cell / 2 + 4} textAnchor="end" fontSize={11} fill={t.ink2}>
            {r}
          </text>
          {cols.map((c, j) => {
            const v = values[i]?.[j] ?? 0;
            return (
              <g key={c}>
                <rect x={m.left + j * cw + 1} y={m.top + i * cell + 1} width={cw - 2} height={cell - 2} rx={4} fill={color(v)}>
                  <title>{`${r} · ${c}: erro ${Math.round(v)}`}</title>
                </rect>
                <text
                  x={m.left + j * cw + cw / 2}
                  y={m.top + i * cell + cell / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill={v / max > 0.5 ? "#fff" : t.ink}
                >
                  {Math.round(v)}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      <text x={m.left} y={height - 16} fontSize={11} fill={t.ink3}>
        Erro absoluto |IA − humano| em pontos (0 a {max}).
      </text>
    </svg>
  );
}
