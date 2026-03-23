/**
 * POST: adicionar criativo validado (escalar).
 * DELETE: remover criativo validado.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { gateAti } from "@/lib/require-entitlements";

export async function POST(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const adId = String(body?.ad_id ?? "").trim();
    const adName = String(body?.ad_name ?? "").trim();
    const campaignId = String(body?.campaign_id ?? "").trim();
    const campaignName = String(body?.campaign_name ?? "").trim();

    if (!adId) {
      return NextResponse.json({ error: "ad_id é obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("ati_validated_creatives")
      .insert({
        user_id: user.id,
        ad_id: adId,
        ad_name: adName || adId,
        campaign_id: campaignId,
        campaign_name: campaignName || "",
        scaled_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message === "relation \"ati_validated_creatives\" does not exist" ? "Tabela de criativos validados não existe. Execute a migração no Supabase." : error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: data?.id, ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ati_validated_creatives")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro" },
      { status: 500 }
    );
  }
}
