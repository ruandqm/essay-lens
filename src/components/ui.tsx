"use client";

import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export const cn = clsx;

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface", className)}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-brand text-white hover:bg-brand-2",
        variant === "secondary" && "border border-line-strong bg-surface-2 text-ink hover:border-ink-3",
        variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "border border-bad/30 bg-bad/10 text-bad hover:bg-bad/20",
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "brand" | "ok" | "warn" | "bad" | "info" | "rag" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        tone === "neutral" && "border-line-strong bg-surface-2 text-ink-2",
        tone === "brand" && "border-brand/40 bg-brand/10 text-brand-2",
        tone === "ok" && "border-ok/40 bg-ok/10 text-ok",
        tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
        tone === "bad" && "border-bad/40 bg-bad/10 text-bad",
        tone === "info" && "border-info/40 bg-info/10 text-info",
        tone === "rag" && "border-rag/40 bg-rag/10 text-rag",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-ink-2 uppercase">{children}</span>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </div>
  );
}

const field =
  "w-full rounded-xl border border-line-strong bg-surface-2/80 px-3.5 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "py-3 leading-relaxed", className)} {...props} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        checked ? "bg-brand" : "bg-line-strong",
      )}
    >
      <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            value === o.value ? "bg-brand/15 text-brand-2" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
      <div className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-brand">{icon}</div>}
      <div className="font-display text-base font-semibold">{title}</div>
      {children && <div className="mt-1.5 max-w-sm text-sm text-ink-3">{children}</div>}
    </div>
  );
}

export function levelColor(level: number) {
  return level >= 5 ? "#34d399" : level >= 4 ? "#a3e635" : level >= 3 ? "#fbbf24" : level >= 2 ? "#fb923c" : "#f87171";
}
