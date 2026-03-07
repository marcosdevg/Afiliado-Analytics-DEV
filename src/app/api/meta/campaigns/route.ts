/**
 * Cria campanha no Meta Ads via Marketing API.
 * POST /api/meta/campaigns
 * Body: { ad_account_id: string, name: string, objective?: string }
 */

const ALLOWED_OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_SALES",
  "OUTCOME_LEADS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
  "OUTCOME_APP_PROMOTION",
];

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
    const name = body?.name?.trim();
    const objective = (body?.objective?.trim() || "OUTCOME_TRAFFIC").toUpperCase();
    if (!ad_account_id || !name) {
      return NextResponse.json(
        { error: "ad_account_id e name são obrigatórios." },
        { status: 400 }
      );
    }
    if (!ALLOWED_OBJECTIVES.includes(objective)) {
      return NextResponse.json(
        { error: `objective inválido. Use: ${ALLOWED_OBJECTIVES.join(", ")}` },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("name", name);
    params.set("objective", objective);
    params.set("status", "PAUSED");
    params.set("special_ad_categories", "[]");
    params.set("is_adset_budget_sharing_enabled", "false");

    const url = `${GRAPH_BASE}/${ad_account_id}/campaigns`;
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
    return NextResponse.json({ campaign_id: json.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar campanha";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
