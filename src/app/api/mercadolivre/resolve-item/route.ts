import { NextResponse } from "next/server";
import { fetchMlProductMetaByMlbId, fetchMlProductMetaFromUrl } from "@/lib/mercadolivre/fetch-product-meta";
import { expandMercadoLivreAffiliateLink } from "@/lib/mercadolivre/expand-affiliate-link";
import { parseMlExtensionSessionToCookieHeader } from "@/lib/mercadolivre/ml-session-cookie";
import { isMlSocialListsProfileUrl } from "@/lib/mercadolivre/site-search";
import { gateMercadoLivre } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

/**
 * POST { productUrl?: string, mlbId?: string, affiliateUrl?: string }
 * affiliateUrl: link curto meli.la — o servidor segue o redirect até a página do produto.
 * Metadados via HTML (JSON-LD) do anúncio + cookie de sessão quando enviado — sem REST api.mercadolibre.com.
 */
export async function POST(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const productUrl = String(body?.productUrl ?? body?.product_url ?? "").trim();
    const mlbIdRaw = String(body?.mlbId ?? body?.mlb_id ?? "").trim();
    const affiliateUrl = String(body?.affiliateUrl ?? body?.affiliate_url ?? "").trim();
    const mlCookieHeader =
      parseMlExtensionSessionToCookieHeader(
        String(body?.mlSessionToken ?? body?.ml_session_token ?? "").trim(),
      ) ?? null;

    let meta = null as Awaited<ReturnType<typeof fetchMlProductMetaByMlbId>>;
    if (mlbIdRaw) {
      meta = await fetchMlProductMetaByMlbId(mlbIdRaw, null, mlCookieHeader);
    } else if (productUrl) {
      if (isMlSocialListsProfileUrl(productUrl)) {
        return NextResponse.json(
          {
            error:
              "Esta URL é página de perfil social do Mercado Livre (/social/…), não um anúncio. Use o link da página do produto (produto.mercadolivre.com.br ou similar) ou o ID MLB.",
          },
          { status: 400 },
        );
      }
      meta = await fetchMlProductMetaFromUrl(productUrl, null, mlCookieHeader);
    } else if (affiliateUrl) {
      const expanded = await expandMercadoLivreAffiliateLink(affiliateUrl, mlCookieHeader);
      if (!expanded) {
        return NextResponse.json(
          {
            error:
              "Não foi possível abrir o link de afiliado (meli.la). Confira se é um link completo https://meli.la/… ou cole a URL da página do produto.",
          },
          { status: 400 },
        );
      }
      meta = await fetchMlProductMetaFromUrl(expanded, null, mlCookieHeader);
    }

    if (!meta) {
      return NextResponse.json(
        {
          error:
            "Não foi possível obter o produto. Cole a URL da página do anúncio (com MLB no link), um link meli.la válido ou o ID MLB (ex.: MLB1234567890).",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      data: {
        resolvedId: meta.resolvedId,
        productName: meta.productName,
        subtitle: meta.subtitle ?? null,
        imageUrl: meta.imageUrl,
        priceOriginal: meta.priceOriginal,
        pricePromo: meta.pricePromo,
        discountRate: meta.discountRate,
        currencyId: meta.currencyId ?? null,
        permalink: meta.permalink ?? null,
        condition: meta.condition ?? null,
        availableQuantity: meta.availableQuantity ?? null,
        soldQuantity: meta.soldQuantity ?? null,
        warranty: meta.warranty ?? null,
        listingTypeId: meta.listingTypeId ?? null,
        affiliateCommissionPct: meta.affiliateCommissionPct ?? null,
        usedAppCredentials: false,
        usedBearerToken: false,
        usedMlSessionCookie: !!mlCookieHeader,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
