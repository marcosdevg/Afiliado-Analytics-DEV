/**
 * Busca produtos na API de Afiliados Shopee (productOfferV2).
 * GET ?keyword=xxx ou ?itemId=123
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

function buildAuthorization(appId: string, secret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("shopee_app_id, shopee_api_key")
      .eq("id", user.id)
      .single();

    const appId = profile?.shopee_app_id?.trim();
    const secret = profile?.shopee_api_key?.trim();
    if (!appId || !secret) {
      return NextResponse.json({ error: "Chaves da Shopee não configuradas. Vá em Configurações > Integração Shopee." }, { status: 400 });
    }

    const url = new URL(req.url);
    const keyword = url.searchParams.get("keyword")?.trim() || "";
    const itemIdParam = url.searchParams.get("itemId");
    const itemId = itemIdParam ? parseInt(itemIdParam, 10) : undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));

    if (!keyword && !Number.isFinite(itemId)) {
      return NextResponse.json({ error: "Informe keyword ou itemId" }, { status: 400 });
    }

    const itemIdArg = Number.isFinite(itemId) ? `itemId: ${itemId}` : "";
    const keywordArg = keyword ? `keyword: "${keyword.replace(/"/g, '\\"')}"` : "";
    const args = [keywordArg, itemIdArg, `listType: 1`, `sortType: 5`, `page: ${page}`, `limit: ${limit}`].filter(Boolean).join(", ");

    const query = `
      query {
        productOfferV2(${args}) {
          nodes {
            itemId
            productName
            productLink
            offerLink
            imageUrl
            priceMin
            priceMax
            priceDiscountRate
            sales
            ratingStar
            commissionRate
            sellerCommissionRate
            shopeeCommissionRate
            commission
            shopId
            shopName
            shopType
          }
          pageInfo {
            page
            limit
            hasNextPage
          }
        }
      }
    `;

    const payload = JSON.stringify({ query });
    const Authorization = buildAuthorization(appId, secret, payload);

    const res = await fetch(SHOPEE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization },
      body: payload,
    });

    const json = (await res.json()) as { data?: { productOfferV2?: { nodes?: unknown[]; pageInfo?: { hasNextPage?: boolean } } }; errors?: { message?: string }[] };
    if (!res.ok || json?.errors?.length) {
      const msg = json?.errors?.[0]?.message ?? `Shopee error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const nodes = json?.data?.productOfferV2?.nodes ?? [];
    const pageInfo = json?.data?.productOfferV2?.pageInfo ?? {};

    return NextResponse.json({
      products: nodes.map((n: Record<string, unknown>) => ({
        itemId: n.itemId,
        productName: n.productName ?? "",
        productLink: n.productLink ?? "",
        offerLink: n.offerLink ?? "",
        imageUrl: n.imageUrl ?? "",
        priceMin: Number(n.priceMin) || 0,
        priceMax: Number(n.priceMax) || 0,
        priceDiscountRate: Number(n.priceDiscountRate) || 0,
        sales: Number(n.sales) || 0,
        ratingStar: Number(n.ratingStar) || 0,
        commissionRate: Number(n.commissionRate) || 0,
        commission: Number(n.commission) || 0,
        shopId: n.shopId,
        shopName: n.shopName ?? "",
      })),
      hasNextPage: !!pageInfo.hasNextPage,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao buscar produtos" }, { status: 500 });
  }
}
