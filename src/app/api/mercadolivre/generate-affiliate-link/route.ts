import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseMlExtensionSessionToCookieHeader } from "@/lib/mercadolivre/ml-session-cookie";
import { createMercadoLivreAffiliateShortLink } from "@/lib/mercadolivre/ml-create-affiliate-link";
import { looksLikeMercadoLivreProductUrl } from "@/lib/mercadolivre/extract-mlb-id";
import { gateMercadoLivre } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

/**
 * POST { mlSessionToken, productPageUrl, affiliateTag }
 * Usa a sessão ML (ssid) para chamar a API interna createLink e devolver o meli.la.
 * affiliateTag = etiqueta em uso no linkbuilder (ex.: cake9265169), obrigatória.
 */
function normalizeAffiliateTag(raw: unknown): string | undefined {
  const t = String(raw ?? "").trim().slice(0, 80);
  if (!t) return undefined;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) {
    return undefined;
  }
  return t;
}

export async function POST(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const rawTok = String(body?.mlSessionToken ?? body?.ml_session_token ?? "").trim();
    const productPageUrl = String(body?.productPageUrl ?? body?.product_page_url ?? "").trim();
    const affiliateTag = normalizeAffiliateTag(
      body?.affiliateTag ?? body?.affiliate_tag ?? body?.tag ?? body?.etiqueta,
    );

    const cookieHeader = parseMlExtensionSessionToCookieHeader(rawTok);
    if (!cookieHeader) {
      return NextResponse.json(
        { error: "Cole o token da extensão (sessão ML) em Configurar — formato ssid ou base64." },
        { status: 400 },
      );
    }
    if (!affiliateTag) {
      return NextResponse.json(
        {
          error:
            "Informe a etiqueta em uso (tag do programa de afiliados), ex.: cake9265169 — letras, números, _ e - apenas.",
        },
        { status: 400 },
      );
    }
    if (!productPageUrl || !looksLikeMercadoLivreProductUrl(productPageUrl)) {
      return NextResponse.json(
        { error: "Informe a URL completa da página do anúncio no Mercado Livre (permalink)." },
        { status: 400 },
      );
    }

    const { shortLink } = await createMercadoLivreAffiliateShortLink({
      cookieHeader,
      productPageUrl,
      affiliateTag,
    });

    return NextResponse.json({ shortLink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar link";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
