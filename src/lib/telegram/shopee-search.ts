/**
 * Wrapper da Shopee Affiliate GraphQL API usado pelo cron de disparo Telegram.
 * Lógica espelhada do cron WhatsApp (src/app/api/grupos-venda/cron-disparo/route.ts) — duplicada
 * intencionalmente pra evitar refatoração arriscada do fluxo WhatsApp existente.
 */

import crypto from "crypto";

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

export type ShopeeProductNode = {
  productLink?: string;
  offerLink?: string;
  productName?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
  priceDiscountRate?: number;
};

function buildShopeeAuth(appId: string, secret: string, payload: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

/**
 * Busca até 30 produtos pela keyword (listType 1 = ofertas).
 * Retorna [] em caso de erro.
 */
export async function searchShopeeProducts(
  appId: string,
  secret: string,
  keyword: string,
  limit = 30
): Promise<ShopeeProductNode[]> {
  const queryProduct = `
    query {
      productOfferV2(keyword: "${keyword.replace(/"/g, '\\"')}", listType: 1, sortType: 2, page: 1, limit: ${limit}) {
        nodes {
          productName
          productLink
          offerLink
          imageUrl
          priceMin
          priceMax
          priceDiscountRate
        }
      }
    }
  `;
  const payload = JSON.stringify({ query: queryProduct });
  try {
    const res = await fetch(SHOPEE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildShopeeAuth(appId, secret, payload) },
      body: payload,
    });
    const json = (await res.json()) as { data?: { productOfferV2?: { nodes?: ShopeeProductNode[] } } };
    return json?.data?.productOfferV2?.nodes ?? [];
  } catch {
    return [];
  }
}

/**
 * Gera link de afiliado curto via mutation generateShortLink.
 * Retorna "" em caso de falha.
 */
export async function generateShopeeAffiliateLink(
  appId: string,
  secret: string,
  originUrl: string,
  subIds: string[]
): Promise<string> {
  const subIdsJson = JSON.stringify(subIds);
  const mutation = `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(originUrl)}, subIds: ${subIdsJson} }) { shortLink } }`;
  const payload = JSON.stringify({ query: mutation });
  try {
    const res = await fetch(SHOPEE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: buildShopeeAuth(appId, secret, payload) },
      body: payload,
    });
    const json = (await res.json()) as { data?: { generateShortLink?: { shortLink?: string } } };
    return json?.data?.generateShortLink?.shortLink ?? "";
  } catch {
    return "";
  }
}

/**
 * Escolhe o produto a ser disparado dentro do pool retornado pela busca.
 * Prefere produtos em promoção; fallback no pool inteiro. Usa índice persistido
 * em keyword_pool_indices pra rotacionar sem repetir.
 */
export function pickProductFromPool(
  nodes: ShopeeProductNode[],
  poolIndex: number
): { product: ShopeeProductNode | null; poolSize: number } {
  const emPromocao = nodes.filter((n) => (n.priceDiscountRate ?? 0) > 0);
  const pool = emPromocao.length > 0 ? emPromocao : nodes;
  if (pool.length === 0) return { product: null, poolSize: 0 };
  const idx = poolIndex % pool.length;
  return { product: pool[idx], poolSize: pool.length };
}
