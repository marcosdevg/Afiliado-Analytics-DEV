/**
 * Tags de campanha ATI (ex: "Tráfego para Grupos").
 * GET: ?tag=Tráfego%20para%20Grupos → { campaignIds: string[] }
 * POST: { campaign_id, tag, add: boolean } → add/remove tag
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { gateAti } from "@/lib/require-entitlements";

const TAG_TRAFICO_GRUPOS = "Tráfego para Grupos";

export async function GET(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tag = new URL(req.url).searchParams.get("tag") ?? TAG_TRAFICO_GRUPOS;

    const { data: rows, error } = await supabase
      .from("ati_campaign_tags")
      .select("campaign_id")
      .eq("user_id", user.id)
      .eq("tag", tag);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const campaignIds = (rows ?? []).map((r) => r.campaign_id);
    return NextResponse.json({ campaignIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar tags";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as { campaign_id?: string; tag?: string; add?: boolean };
    const campaignId = body?.campaign_id?.trim();
    const tag = (body?.tag?.trim() ?? TAG_TRAFICO_GRUPOS);
    const add = body?.add === true;

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaign_id é obrigatório" },
        { status: 400 }
      );
    }

    if (add) {
      const { error: insertError } = await supabase
        .from("ati_campaign_tags")
        .upsert(
          { user_id: user.id, campaign_id: campaignId, tag },
          { onConflict: "user_id,campaign_id,tag" }
        );
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, added: true });
    } else {
      const { error: deleteError } = await supabase
        .from("ati_campaign_tags")
        .delete()
        .eq("user_id", user.id)
        .eq("campaign_id", campaignId)
        .eq("tag", tag);
      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, removed: true });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar tag";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
