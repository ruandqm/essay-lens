import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Toaster } from "sonner";
import { Providers } from "@/lib/trpc";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Essay Lens — Correção de redações do ENEM",
  description: "Correção de redações do ENEM com base nos manuais do INEP.",
};

export const viewport: Viewport = { themeColor: "#0b0d14" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="bg-grid min-h-screen">
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">{children}</main>
          <Toaster theme="dark" richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
