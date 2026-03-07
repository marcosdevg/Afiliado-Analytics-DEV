import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "./components/auth/AuthProvider";
import SessionLogic from "./components/cleanDate/SessionLogic";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Afiliado Analytics",
    default:
      "Afiliado Analytics – Análise de relatórios da Shopee para afiliados",
  },
  description:
    "Afiliado Analytics é uma ferramenta para afiliados da Shopee que transforma seus relatórios em dashboards, gráficos e métricas claras de desempenho. Faça upload do arquivo de vendas e veja seus resultados em segundos.",
  alternates: {
    canonical: "https://www.afiliadoanalytics.com.br/",
    languages: {
      "pt-BR": "https://www.afiliadoanalytics.com.br/",
    },
  },
  openGraph: {
    title:
      "Afiliado Analytics – Análise de relatórios da Shopee para afiliados",
    description:
      "Transforme seus relatórios em dashboards e métricas claras. Upload rápido e visualização em segundos.",
    url: "https://www.afiliadoanalytics.com.br/",
    siteName: "Afiliado Analytics",
    locale: "pt_BR",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16" },
      { url: "/favicon.ico" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-900`}>
        <Providers>
          <SupabaseProvider>
            <SessionLogic />
            {children}
          </SupabaseProvider>
        </Providers>
      </body>
    </html>
  );
}
