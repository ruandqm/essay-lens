"use client";

import { FlaskConical, LineChart, PenLine } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const NAV = [
  { href: "/", label: "Corretor", icon: PenLine },
  { href: "/lab", label: "Lab RAG", icon: FlaskConical },
  { href: "/experimentos", label: "Experimentos", icon: LineChart },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand">
            <PenLine className="size-4.5 text-white" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[15px] font-semibold">
              Essay Lens
            </span>
            <span className="block text-[10px] tracking-[0.2em] text-ink-3">ENEM · INEP</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition sm:px-3.5",
                  active ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
