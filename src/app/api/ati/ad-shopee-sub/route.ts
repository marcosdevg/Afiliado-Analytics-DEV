/**
 * Sub ID Shopee por anúncio (ATI).
 * GET → { mappings: { adId, shopeeSubId }[] }
 * POST { adId, shopeeSubId } → salvar (trim, 1–64 chars)
 * DELETE ?adId= → remover vínculo
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { gateAti } from "@/lib/require-entitlements";

function normalizeSub(s: string) {
  return s.trim().slice(0, 64);
}

export async function GET() {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase
      .from("ati_ad_shopee_sub")
      .select("ad_id, shopee_sub_id")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      mappings: (data ?? []).map((r) => ({ adId: r.ad_id, shopeeSubId: r.shopee_sub_id })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const adId = typeof body.adId === "string" ? body.adId.trim() : "";
    const shopeeSubId = normalizeSub(typeof body.shopeeSubId === "string" ? body.shopeeSubId : "");
    if (!adId) return NextResponse.json({ error: "adId é obrigatório." }, { status: 400 });
    if (!shopeeSubId || shopeeSubId.length < 2) {
      return NextResponse.json({ error: "shopeeSubId deve ter ao menos 2 caracteres (ex.: o Sub ID 1 do link)." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_\-.]+$/.test(shopeeSubId)) {
      return NextResponse.json({ error: "Use apenas letras, números, hífen, ponto e underscore." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { error: delErr } = await supabase.from("ati_ad_shopee_sub").delete().eq("user_id", user.id).eq("shopee_sub_id", shopeeSubId).neq("ad_id", adId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    const { error } = await supabase.from("ati_ad_shopee_sub").upsert(
      { user_id: user.id, ad_id: adId, shopee_sub_id: shopeeSubId, updated_at: now },
      { onConflict: "user_id,ad_id" }
    );
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Este Sub ID já está em outro anúncio." }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const adId = new URL(req.url).searchParams.get("adId")?.trim();
    if (!adId) return NextResponse.json({ error: "adId é obrigatório." }, { status: 400 });
    const { error } = await supabase.from("ati_ad_shopee_sub").delete().eq("user_id", user.id).eq("ad_id", adId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
