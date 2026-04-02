import { assertVideoEditorPro } from "@/lib/gate-video-editor-request";
import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { scrape } from "../../../../server/shopee-scraper-light";
import { extractShopeeItemIdFromInput } from "@/lib/shopee-extract-item-id";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VIDEO_RE = /\.(mp4|m3u8|webm|ts)(\?|$)/i;
const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

type MediaItem = { url: string; type: "image" | "video"; label: string };

function buildAuthorization(appId: string, secret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function mergeMedia(primary: MediaItem[], secondary: MediaItem[]): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...secondary]) {
    if (!item?.url || !isHttpUrl(item.url)) continue;
    const key = `${item.type}|${item.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function tryAffiliateMediaByItemId(userId: string, itemId: number): Promise<{
  productName: string;
  media: MediaItem[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("shopee_app_id, shopee_api_key")
    .eq("id", userId)
    .single();

  const appId = profile?.shopee_app_id?.trim();
  const secret = profile?.shopee_api_key?.trim();
  if (!appId || !secret) {
    return {
      productName: "Produto Shopee",
      media: [],
      error: "Integração Shopee não configurada pelo usuário.",
    };
  }

  const query = `
    query {
      productOfferV2(itemId: ${itemId}, listType: 1, sortType: 5, page: 1, limit: 1) {
        nodes {
          itemId
          productName
          imageUrl
        }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const Authorization = buildAuthorization(appId, secret, payload);

  const res = await fetch(SHOPEE_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization,
    },
    body: payload,
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: { productOfferV2?: { nodes?: Array<{ productName?: string; imageUrl?: string }> } };
    errors?: { message?: string }[];
  };
  if (!res.ok || json?.errors?.length) {
    return {
      productName: "Produto Shopee",
      media: [],
      error: json?.errors?.[0]?.message || `Shopee error (${res.status})`,
    };
  }

  const node = json?.data?.productOfferV2?.nodes?.[0];
  const productName = String(node?.productName || "Produto Shopee");
  const imageUrl = node?.imageUrl;
  if (!isHttpUrl(imageUrl)) {
    return { productName, media: [] };
  }

  return {
    productName,
    media: [{ url: imageUrl, type: "image", label: "Imagem 1" }],
  };
}

export async function POST(req: Request) {
  try {
    const gate = await assertVideoEditorPro();
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const shopeeUrl = String(body?.url ?? "").trim();
    const mode = String(body?.mode ?? "scrape");

    if (!shopeeUrl) {
      return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
    }

    if (mode === "proxy") {
      try {
        const res = await fetch(shopeeUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        });
        if (!res.ok) return NextResponse.json({ error: `Erro ${res.status}` }, { status: 502 });
        const buf = await res.arrayBuffer();
        const ct = res.headers.get("content-type") || "application/octet-stream";
        const isVideo = VIDEO_RE.test(shopeeUrl) || ct.includes("video");
        return new NextResponse(buf, {
          headers: { "Content-Type": ct, "X-Media-Type": isVideo ? "video" : "image" },
        });
      } catch {
        return NextResponse.json({ error: "Falha ao baixar mídia" }, { status: 502 });
      }
    }

    const itemId = extractShopeeItemIdFromInput(shopeeUrl);

    // 1) Tenta API oficial de afiliado (imagem principal) quando conseguimos itemId
    let result: { productName: string; media: MediaItem[]; error?: string } = {
      productName: "Produto Shopee",
      media: [],
    };
    if (itemId) {
      result = await tryAffiliateMediaByItemId(gate.userId, itemId);
    }

    // 2) Tenta scraper para complementar carrossel (imagens/videos)
    // Se a API afiliado trouxer só 1 imagem, o scraper pode trazer mais.
    const scraped = await scrape(shopeeUrl);
    if (result.media?.length) {
      result = {
        productName: result.productName || scraped.productName,
        media: mergeMedia(result.media, scraped.media ?? []),
        error: result.error ?? scraped.error,
      };
    } else {
      result = scraped;
    }

    if (result.error && (!result.media || result.media.length === 0)) {
      return NextResponse.json({
        productName: "Produto Shopee",
        media: [],
        fallbackCta: "Nenhuma mídia encontrada automaticamente. Use o upload manual abaixo.",
        warning: result.error,
      });
    }

    if (!result.media || result.media.length === 0) {
      return NextResponse.json({
        productName: result.productName || "Produto Shopee",
        media: [],
        fallbackCta: "Nenhuma mídia encontrada automaticamente. Use o upload manual abaixo.",
      });
    }

    return NextResponse.json({
      productName: result.productName,
      media: result.media,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao processar" },
      { status: 500 }
    );
  }
}
