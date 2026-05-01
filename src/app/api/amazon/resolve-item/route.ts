import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";
import { extractAsinFromUrl, looksLikeAmazonProductUrl } from "@/lib/amazon/extract-asin";

export const dynamic = "force-dynamic";

/**
 * POST { productUrl?, asin?, affiliateUrl? }
 *
 * Resolve um item Amazon a partir de URL/ASIN/link encurtado e devolve
 * metadados (nome, imagem, preço, ASIN canônico) — análogo a
 * `/api/mercadolivre/resolve-item`.
 *
 * Por enquanto extrai apenas o ASIN da URL (regex). Os campos de metadados
 * (nome, imagem, preço, etc.) ficam vazios — quando a busca Amazon for
 * plugada (PA-API ou scraping com cookie), substitua o `fetchAmazonPdp` abaixo
 * pra preencher esses campos.
 */
type AmazonResolved = {
  resolvedId: string;
  productName: string;
  imageUrl: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
  permalink: string;
};

async function fetchAmazonPdp(_asin: string): Promise<Partial<AmazonResolved>> {
  // TODO: scraping/PA-API real aqui pra preencher nome/imagem/preço.
  // Por enquanto deixa vazio — o front consegue gerar o link só com o ASIN.
  return {};
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const productUrl = String(body?.productUrl ?? body?.product_url ?? "").trim();
    const affiliateUrl = String(body?.affiliateUrl ?? body?.affiliate_url ?? "").trim();
    const asinExplicit = String(body?.asin ?? "").trim();

    let asin = asinExplicit;
    if (!asin) asin = extractAsinFromUrl(productUrl) ?? extractAsinFromUrl(affiliateUrl) ?? "";

    if (!asin) {
      const tried = [productUrl, affiliateUrl].filter(Boolean).join(" | ");
      return NextResponse.json(
        {
          error:
            "Não consegui identificar o ASIN. Cole a URL canônica /dp/ASIN ou o ASIN direto.",
          tried: tried || null,
        },
        { status: 400 },
      );
    }

    const meta = await fetchAmazonPdp(asin);
    const data: AmazonResolved = {
      resolvedId: asin,
      productName: meta.productName ?? "",
      imageUrl: meta.imageUrl ?? "",
      priceOriginal: meta.priceOriginal ?? null,
      pricePromo: meta.pricePromo ?? null,
      discountRate: meta.discountRate ?? null,
      permalink:
        meta.permalink ??
        (looksLikeAmazonProductUrl(productUrl) ? productUrl : `https://www.amazon.com.br/dp/${asin}`),
    };
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 502 },
    );
  }
}
