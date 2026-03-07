/**
 * Cria conjunto de anúncios (ad set) no Meta Ads.
 * POST /api/meta/adsets
 * Body: { ad_account_id, campaign_id, name, daily_budget, country_code?, age_min?, age_max?, gender?, optimization_goal?, pixel_id?, custom_conversion_id?, conversion_event? }
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("meta_access_token")
      .eq("id", user.id)
      .single();

    const token = profile?.meta_access_token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Token do Meta não configurado." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const ad_account_id = body?.ad_account_id?.trim();
    const campaign_id = body?.campaign_id?.trim();
    const name = body?.name?.trim();
    const daily_budget = body?.daily_budget != null ? Number(body.daily_budget) : NaN;
    const country_code = (body?.country_code?.trim() || "BR").toUpperCase().slice(0, 2);
    const age_min = body?.age_min != null ? Number(body.age_min) : 18;
    const age_max = body?.age_max != null ? Number(body.age_max) : 65;
    const gender = body?.gender || "all"; // all | male | female
    const optimization_goal = (body?.optimization_goal?.trim() || "LINK_CLICKS").toUpperCase();
    const pixel_id = body?.pixel_id?.trim();
    const custom_conversion_id = body?.custom_conversion_id?.trim();
    let conversion_event = (body?.conversion_event?.trim() || "PAGE_VIEW").toUpperCase();
    if (conversion_event === "VIEW_CONTENT") conversion_event = "CONTENT_VIEW";

    if (!ad_account_id || !campaign_id || !name) {
      return NextResponse.json(
        { error: "ad_account_id, campaign_id e name são obrigatórios." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(daily_budget) || daily_budget < 100) {
      return NextResponse.json(
        { error: "daily_budget obrigatório (mínimo 100 centavos, ex: 1000 = R$ 10)." },
        { status: 400 }
      );
    }

    const targeting: Record<string, unknown> = {
      geo_locations: { countries: [country_code] },
      age_min,
      age_max,
      publisher_platforms: ["facebook"],
    };
    if (gender !== "all") {
      targeting.genders = gender === "female" ? [2] : [1];
    }

    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("campaign_id", campaign_id);
    params.set("name", name);
    params.set("daily_budget", String(Math.round(daily_budget)));
    params.set("billing_event", "IMPRESSIONS");
    params.set("optimization_goal", optimization_goal);
    params.set("targeting", JSON.stringify(targeting));
    params.set("status", "PAUSED");
    params.set("start_time", new Date().toISOString());
    params.set("destination_type", "WEBSITE");
    params.set("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
    const conversionGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (pixel_id && conversionGoals.includes(optimization_goal)) {
      const promotedObject: { pixel_id: string; custom_event_type?: string } = { pixel_id };
      promotedObject.custom_event_type = conversion_event;
      params.set("promoted_object", JSON.stringify(promotedObject));
      if (custom_conversion_id && /^\d+$/.test(custom_conversion_id)) params.set("custom_conversion_id", custom_conversion_id);
    }
    const url = `${GRAPH_BASE}/${ad_account_id}/adsets`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = (await res.json()) as {
      id?: string;
      error?: {
        message: string;
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
        error_user_title?: string;
        type?: string;
      };
    };
    if (json.error) {
      const err = json.error;
      const detail = [err.message];
      if (err.error_user_msg) detail.push(err.error_user_msg);
      if (err.code != null) detail.push(`(código: ${err.code})`);
      if (err.error_subcode != null) detail.push(`(subcódigo: ${err.error_subcode})`);
      throw new Error(detail.join(" "));
    }
    return NextResponse.json({ adset_id: json.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar conjunto de anúncios";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
