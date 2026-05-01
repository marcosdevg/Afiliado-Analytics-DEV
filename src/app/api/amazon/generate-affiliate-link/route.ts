import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";
import { buildAmazonAffiliateShortLink } from "@/lib/amazon/build-affiliate-link";
import { looksLikeAmazonProductUrl } from "@/lib/amazon/extract-asin";

export const dynamic = "force-dynamic";

/**
 * POST { productPageUrl, affiliateTag, amazonSessionToken? }
 *
 * Gera o link de afiliado Amazon canônico (`/dp/ASIN?tag=USERTAG-20`).
 *
 * Hoje a geração é feita 100% no servidor a partir do ASIN extraído da URL +
 * tag do Associate. Se no futuro for plugada uma chamada à API Amazon
 * (PA-API ou painel via cookie da extensão), basta substituir a chamada a
 * `buildAmazonAffiliateShortLink` por um helper análogo ao
 * `createMercadoLivreAffiliateShortLink`.
 */
function normalizeAffiliateTag(raw: unknown): string | undefined {
  const t = String(raw ?? "").trim().slice(0, 80);
  if (!t) return undefined;
  // Tags Amazon Associates seguem formato `xxxxxx-20` (Brasil) ou variações.
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return undefined;
  return t;
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const productPageUrl = String(body?.productPageUrl ?? body?.product_page_url ?? "").trim();
    const affiliateTag = normalizeAffiliateTag(
      body?.affiliateTag ?? body?.affiliate_tag ?? body?.tag ?? body?.etiqueta,
    );

    if (!affiliateTag) {
      return NextResponse.json(
        {
          error:
            "Informe a tag do Amazon Associates (ex.: meutag-20) — letras, números, _ e - apenas.",
        },
        { status: 400 },
      );
    }
    if (!productPageUrl || !looksLikeAmazonProductUrl(productPageUrl)) {
      return NextResponse.json(
        { error: "Informe a URL completa da página do produto na Amazon." },
        { status: 400 },
      );
    }

    const result = buildAmazonAffiliateShortLink({ productPageUrl, affiliateTag });
    if (!result) {
      return NextResponse.json(
        { error: "Não consegui extrair o ASIN da URL. Use o link canônico /dp/ASIN." },
        { status: 400 },
      );
    }

    return NextResponse.json({ shortLink: result.shortLink, asin: result.asin });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar link";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
