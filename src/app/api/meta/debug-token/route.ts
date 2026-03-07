/**
 * Inspeciona o token do Meta (debug_token) e retorna as permissões que o Meta enxerga.
 * GET /api/meta/debug-token
 * Útil para confirmar se o token em Configurações tem pages_manage_ads e outras permissões.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function GET() {
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

    const url = `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: {
        app_id?: string;
        user_id?: string;
        is_valid?: boolean;
        scopes?: string[];
        expires_at?: number;
        granular_scopes?: Array< { scope: string; target_ids?: string[] }>;
      };
      error?: { message: string };
    };

    if (json.error) {
      return NextResponse.json({ error: json.error.message }, { status: 400 });
    }

    const data = json.data;
    if (!data) return NextResponse.json({ error: "Resposta inválida do Meta" }, { status: 500 });

    return NextResponse.json({
      is_valid: data.is_valid,
      scopes: data.scopes ?? [],
      app_id: data.app_id,
      user_id: data.user_id,
      expires_at: data.expires_at,
      has_pages_manage_ads: (data.scopes ?? []).includes("pages_manage_ads"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao inspecionar token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
