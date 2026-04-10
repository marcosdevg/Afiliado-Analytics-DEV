import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isTrialBlockedDashboardPath } from "@/lib/trial-dashboard-blocked-paths";

const CAPTURE_HOST = "s.afiliadoanalytics.com.br";

// Rotas que NÃO podem virar slug no subdomínio
const RESERVED_PREFIXES = [
  "/api",
  "/dashboard",
  "/auth",
  "/login",
  "/signup",
  "/minha-conta",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/capture",
];

function isReservedPath(pathname: string) {
  return RESERVED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ✅ NOVO: ignora assets públicos (ex: /whatsapp.svg) para não virarem slug
function isPublicAssetPath(pathname: string) {
  // pega apenas o último segmento (evita confusão com dots em outras partes)
  const last = pathname.split("/").pop() ?? "";
  // se tem extensão (ex: whatsapp.svg, logo.png, styles.css etc.), não reescreve
  return /\.[a-z0-9]+$/i.test(last);
}

// Rotas do dashboard que exigem assinatura ativa (não expirada / cancelada).
// Inclui módulos que trial já bloqueia em `trial-dashboard-blocked-paths.ts`, para o gate
// aplicar também a `subscription_status !== "active"` ao aceder por URL ou favorito.
const PAID_DASHBOARD_PREFIXES = [
  "/dashboard/links",
  "/dashboard/captura",
  "/dashboard/gpl",
  "/dashboard/ati",
  "/dashboard/meta-ads",
  "/dashboard/gerador-links-shopee",
  "/dashboard/grupos-venda",
  "/dashboard/espelhamento-grupos",
  "/dashboard/minha-lista-ofertas",
  "/dashboard/minha-lista-ofertas-ml",
  "/dashboard/video-editor",
  "/dashboard/gerador-especialista",
];

function isPaidDashboardPath(pathname: string) {
  return PAID_DASHBOARD_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const hostHeader = req.headers.get("host") ?? "";
  const host = (hostHeader.split(":")[0] ?? "").toLowerCase();
  const { pathname } = req.nextUrl;

  // 0) Subdomínio do site de captura (público): /<slug> e /<slug>/go
  if (host === CAPTURE_HOST) {
    if (pathname === "/") return NextResponse.next();

    // ✅ IMPORTANTE: deixa passar arquivos públicos do /public (ex.: /whatsapp.svg)
    if (isPublicAssetPath(pathname)) return NextResponse.next();

    // Antes de isReservedPath: /capture está em RESERVED mas /capture/<slug> deve ir para URL limpa
    const directCapture = pathname.match(/^\/capture\/([^/]+)(\/go)?\/?$/);
    if (directCapture) {
      const slugPart = directCapture[1];
      const isGo = Boolean(directCapture[2]);
      const url = req.nextUrl.clone();
      url.pathname = isGo ? `/${slugPart}/go` : `/${slugPart}`;
      const res = NextResponse.redirect(url, 307);
      res.headers.set("Cache-Control", "no-store, max-age=0");
      return res;
    }

    if (isReservedPath(pathname)) return NextResponse.next();

    // /<slug>/go -> /capture/<slug>/go
    const goMatch = pathname.match(/^\/([^/]+)\/go\/?$/);
    if (goMatch) {
      const slug = goMatch[1];
      const url = req.nextUrl.clone();
      url.pathname = `/capture/${slug}/go`;
      const rw = NextResponse.rewrite(url);
      rw.headers.set("Cache-Control", "private, no-store, max-age=0");
      return rw;
    }

    // /<slug> -> /capture/<slug>
    const slugMatch = pathname.match(/^\/([^/]+)\/?$/);
    if (slugMatch) {
      const slug = slugMatch[1];
      const url = req.nextUrl.clone();
      url.pathname = `/capture/${slug}`;
      const rw = NextResponse.rewrite(url);
      rw.headers.set("Cache-Control", "private, no-store, max-age=0");
      return rw;
    }

    return NextResponse.next();
  }

  // 1) Auth / dashboard
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return res;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visitante não acessa /dashboard
  if (!user && pathname.startsWith("/dashboard")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ✅ Assinatura: rotas pagas exigem "active"; trial não acessa módulos bloqueados (GPL, ATI, etc.)
  const needsSubGate =
    user &&
    pathname.startsWith("/dashboard") &&
    (isPaidDashboardPath(pathname) || isTrialBlockedDashboardPath(pathname));

  if (needsSubGate) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("subscription_status, plan_tier, trial_access_until")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      const url = req.nextUrl.clone();
      url.pathname = "/minha-conta/renovar";
      return NextResponse.redirect(url);
    }

    const trialUntil = profile.trial_access_until
      ? new Date(profile.trial_access_until as string).getTime()
      : 0;
    const trialExpired =
      profile.plan_tier === "trial" && trialUntil > 0 && trialUntil < Date.now();

    if (trialExpired || profile.subscription_status !== "active") {
      const url = req.nextUrl.clone();
      url.pathname = "/minha-conta/renovar";
      return NextResponse.redirect(url);
    }

    // Trial em rotas bloqueadas: o layout do dashboard mostra upsell in-page (sidebar visível).
  }

  // Logado não vê Home
  if (user && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
