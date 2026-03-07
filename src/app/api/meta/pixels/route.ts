/**
 * Lista pixels da conta de anúncios (para conversão no conjunto).
 * GET /api/meta/pixels?ad_account_id=act_xxx
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const ad_account_id = url.searchParams.get("ad_account_id")?.trim();
    if (!ad_account_id) {
      return NextResponse.json(
        { error: "ad_account_id é obrigatório." },
        { status: 400 }
      );
    }

    const apiUrl = `${GRAPH_BASE}/${ad_account_id}/adspixels?fields=id,name&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(apiUrl);
    const json = (await res.json()) as {
      data?: { id: string; name?: string }[];
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    const pixels = (json.data ?? []).map((p) => ({ id: p.id, name: p.name || p.id }));
    return NextResponse.json({ pixels });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar pixels";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
