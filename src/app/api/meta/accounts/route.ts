/**
 * Lista contas de anúncios do Meta para o usuário logado.
 * GET /api/meta/accounts
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function getAdAccounts(accessToken: string): Promise<{ id: string; name: string; business_id?: string }[]> {
  let url = `${GRAPH_BASE}/me/adaccounts?fields=id,name,business&access_token=${encodeURIComponent(accessToken)}`;
  let res = await fetch(url);
  let json = (await res.json()) as {
    data?: { id: string; name: string; business?: { id: string } }[];
    error?: { message: string };
  };
  if (json.error) {
    url = `${GRAPH_BASE}/me/adaccounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
    res = await fetch(url);
    json = (await res.json()) as { data?: { id: string; name: string }[]; error?: { message: string } };
    if (json.error) throw new Error(json.error.message || "Meta API error");
    return (json.data ?? []).map((a) => ({ id: a.id, name: a.name }));
  }
  return (json.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    business_id: a.business?.id,
  }));
}

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
        { error: "Token do Meta não configurado. Configure em Configurações." },
        { status: 400 }
      );
    }

    const accounts = await getAdAccounts(token);
    return NextResponse.json({ adAccounts: accounts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar contas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
