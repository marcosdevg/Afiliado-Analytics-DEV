/**
 * Lista páginas do Facebook do usuário (necessário para criar criativo de anúncio).
 * GET /api/meta/pages
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

    const url = `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: {
        id: string;
        name: string;
        access_token?: string;
        instagram_business_account?: { id: string; username?: string };
      }[];
      error?: { message: string };
    };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    const pages = (json.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      instagram_account: p.instagram_business_account
        ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || p.instagram_business_account.id }
        : null,
    }));
    return NextResponse.json({ pages });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar páginas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
