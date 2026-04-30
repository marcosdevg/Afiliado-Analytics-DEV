import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "./components/auth/AuthProvider";
import SessionLogic from "./components/cleanDate/SessionLogic";
import { PwaServiceWorker } from "./components/PwaServiceWorker";
import MainFloatingActions from "./components/layout/MainFloatingActions";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Afiliado Analytics",
    default:
      "Afiliado Analytics",
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
      "Afiliado Analytics",
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
  appleWebApp: {
    capable: true,
    title: "Afiliado Analytics",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={spaceGrotesk.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var t = localStorage.getItem('aa-theme');
                  var cls = t === 'light' ? 'light' : 'dark';
                  document.documentElement.classList.add(cls);
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.className} bg-dark-bg`}>
        <Providers>
          <SupabaseProvider>
            <SessionLogic />
            <PwaServiceWorker />
            {children}
            <MainFloatingActions />
          </SupabaseProvider>
        </Providers>
      </body>
    </html>
  );
}
