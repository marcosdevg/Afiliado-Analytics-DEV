import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

/**
 * Busca produtos na Amazon por keyword/categoria.
 *
 * Hoje retorna `{ products: [] }` com mensagem informativa — a versão funcional
 * exige uma das duas integrações abaixo, ainda não plugadas:
 *   1. Scraping de `https://www.amazon.com.br/s?k=...` usando o cookie de
 *      sessão capturado pela extensão (mesmo padrão do ML site-search).
 *   2. Amazon PA-API (Product Advertising API) com Access Key/Secret/Tag.
 *
 * Quando uma das opções for ligada, basta substituir o corpo do GET/POST
 * mantendo a mesma forma de resposta `{ products: [...] }`.
 */
type AmazonProduct = {
  asin: string;
  productName: string;
  imageUrl: string;
  productPageUrl: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
};

async function searchAmazonProducts(_args: {
  keyword: string;
  category: string;
  limit: number;
  amazonSessionToken: string;
}): Promise<{ products: AmazonProduct[]; pendingIntegration?: boolean }> {
  // TODO: plugar scraping/PA-API real aqui. Por enquanto retorna vazio.
  return { products: [], pendingIntegration: true };
}

export async function GET(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const url = new URL(req.url);
    const keyword = (url.searchParams.get("q") ?? url.searchParams.get("keyword") ?? "").trim();
    const category = (url.searchParams.get("category") ?? url.searchParams.get("categoria") ?? "").trim();
    const limit = Math.max(1, Math.min(60, Number(url.searchParams.get("limit") ?? "20")));
    const amazonSessionToken = (req.headers.get("x-amazon-session-token") ?? "").trim();
    const result = await searchAmazonProducts({ keyword, category, limit, amazonSessionToken });
    if (result.pendingIntegration) {
      return NextResponse.json({
        products: [],
        message:
          "Busca de produtos Amazon ainda não está conectada. Use 'Adicionar via URL' colando o link da página do produto.",
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const body = await req.json().catch(() => ({}));
    const keyword = String(body?.keyword ?? body?.q ?? "").trim();
    const category = String(body?.category ?? body?.categoria ?? "").trim();
    const limit = Math.max(1, Math.min(60, Number(body?.limit ?? 20)));
    const amazonSessionToken = String(body?.amazonSessionToken ?? body?.amazon_session_token ?? "").trim();
    const result = await searchAmazonProducts({ keyword, category, limit, amazonSessionToken });
    if (result.pendingIntegration) {
      return NextResponse.json({
        products: [],
        message:
          "Busca de produtos Amazon ainda não está conectada. Use 'Adicionar via URL' colando o link da página do produto.",
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 502 },
    );
  }
}
