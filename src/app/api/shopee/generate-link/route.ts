/**
 * Gera link curto de afiliado Shopee (generateShortLink).
 * POST { originUrl: string, subIds?: string[] }
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

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const originUrl = String(body?.originUrl ?? "").trim();
    const subIds = Array.isArray(body?.subIds) ? body.subIds.map((s: unknown) => String(s).trim()).filter(Boolean) : [];

    if (!originUrl) {
      return NextResponse.json({ error: "originUrl é obrigatório" }, { status: 400 });
    }

    const subIdsJson = JSON.stringify(subIds);
    const mutation = `
      mutation {
        generateShortLink(input: {
          originUrl: ${JSON.stringify(originUrl)}
          subIds: ${subIdsJson}
        }) {
          shortLink
        }
      }
    `;

    const payload = JSON.stringify({ query: mutation });
    const Authorization = buildAuthorization(appId, secret, payload);

    const res = await fetch(SHOPEE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization },
      body: payload,
    });

    const json = (await res.json()) as { data?: { generateShortLink?: { shortLink?: string } }; errors?: { message?: string }[] };
    if (!res.ok || json?.errors?.length) {
      const msg = json?.errors?.[0]?.message ?? `Shopee error (${res.status})`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const shortLink = json?.data?.generateShortLink?.shortLink ?? "";
    if (!shortLink) return NextResponse.json({ error: "Resposta da Shopee sem shortLink" }, { status: 500 });

    return NextResponse.json({ shortLink, subIds });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao gerar link" }, { status: 500 });
  }
}
