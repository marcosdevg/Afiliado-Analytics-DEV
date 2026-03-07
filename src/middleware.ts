import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

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

// Rotas do dashboard que exigem assinatura ativa
const PAID_DASHBOARD_PREFIXES = ["/dashboard/links", "/dashboard/captura", "/dashboard/gpl", "/dashboard/ati"];

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
    if (isReservedPath(pathname)) return NextResponse.next();

    // ✅ IMPORTANTE: deixa passar arquivos públicos do /public (ex.: /whatsapp.svg)
    if (isPublicAssetPath(pathname)) return NextResponse.next();

    // /<slug>/go -> /capture/<slug>/go
    const goMatch = pathname.match(/^\/([^/]+)\/go\/?$/);
    if (goMatch) {
      const slug = goMatch[1];
      const url = req.nextUrl.clone();
      url.pathname = `/capture/${slug}/go`;
      return NextResponse.rewrite(url);
    }

    // /<slug> -> /capture/<slug>
    const slugMatch = pathname.match(/^\/([^/]+)\/?$/);
    if (slugMatch) {
      const slug = slugMatch[1];
      const url = req.nextUrl.clone();
      url.pathname = `/capture/${slug}`;
      return NextResponse.rewrite(url);
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

  // ✅ Assinatura: bloqueia SOMENTE estas rotas se não estiver "active"
  if (user && isPaidDashboardPath(pathname)) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.subscription_status !== "active") {
      const url = req.nextUrl.clone();
      url.pathname = "/minha-conta/renovar";
      return NextResponse.redirect(url);
    }
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
