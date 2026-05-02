/**
 * Probe rápida pra descobrir quais campos o tipo `ConversionItem` (item do
 * relatório de conversões Shopee) expõe — em particular, se tem `imageUrl`
 * ou `productId`/`itemId` que dê pra buscar imagem depois.
 *
 * Apaga depois que a investigação fechar.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

function buildAuthorization(appId: string, secret: string, payload: string) {
  const ts = Math.floor(Date.now() / 1000);
  const sigRaw = `${appId}${ts}${payload}${secret}`;
  const sig = crypto.createHash("sha256").update(sigRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}`;
}

async function shopeeFetch(appId: string, secret: string, query: string) {
  const payload = JSON.stringify({ query });
  const Authorization = buildAuthorization(appId, secret, payload);
  const res = await fetch(SHOPEE_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization },
    body: payload,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* não-JSON */
  }
  return { status: res.status, ok: res.ok, json };
}

export async function GET() {
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
    return NextResponse.json({ error: "Chaves Shopee ausentes" }, { status: 400 });
  }

  // Tipos prováveis de nome — a Shopee pode chamar de "Item", "OrderItem",
  // "ConversionItem", "ConversionOrderItem", etc. Tenta todos.
  const candidateTypes = [
    "ConversionItem",
    "ConversionOrderItem",
    "OrderItem",
    "Item",
    "ConversionReportItem",
  ];

  const results: Record<
    string,
    { exists: boolean; fields: string[] | null; error: string | null }
  > = {};

  for (const typeName of candidateTypes) {
    const query = `
      query Introspect {
        __type(name: "${typeName}") {
          name
          kind
          fields {
            name
            type { name kind ofType { name kind } }
          }
        }
      }
    `;
    const r = await shopeeFetch(appId, secret, query);
    const data = (r.json as {
      data?: { __type?: { name?: string; fields?: Array<{ name: string }> } | null };
      errors?: Array<{ message?: string }>;
    } | null);
    const t = data?.data?.__type;
    if (t?.fields && t.fields.length > 0) {
      results[typeName] = {
        exists: true,
        fields: t.fields.map((f) => f.name),
        error: null,
      };
    } else {
      results[typeName] = {
        exists: false,
        fields: null,
        error: data?.errors?.[0]?.message ?? "tipo não encontrado",
      };
    }
  }

  return NextResponse.json({ candidates: results });
}
