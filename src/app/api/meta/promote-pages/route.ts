/**
 * Lista Páginas que podem ser usadas com esta conta de anúncios.
 * - Se a conta tem negócio (portfólio): usa owned_pages do negócio (só Páginas reivindicadas).
 * - Se a conta não tem negócio (pessoal): usa promote_pages.
 * GET /api/meta/promote-pages?ad_account_id=act_xxx&business_id=xxx (opcional; se enviado, usa só owned_pages)
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

type PageNode = {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username?: string };
};

function mapPages(data: PageNode[] | undefined) {
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    instagram_account: p.instagram_business_account
      ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || p.instagram_business_account.id }
      : null,
  }));
}

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
      return NextResponse.json({ error: "Token do Meta não configurado." }, { status: 400 });
    }

    const url = new URL(req.url);
    const ad_account_id = url.searchParams.get("ad_account_id")?.trim();
    const business_id_param = url.searchParams.get("business_id")?.trim();
    if (!ad_account_id) {
      return NextResponse.json({ error: "ad_account_id é obrigatório." }, { status: 400 });
    }

    if (business_id_param) {
      const ownedRes = await fetch(
        `${GRAPH_BASE}/${business_id_param}/owned_pages?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      );
      const ownedJson = (await ownedRes.json()) as {
        data?: PageNode[];
        error?: { message: string };
      };
      if (ownedJson.error) throw new Error(ownedJson.error.message || "Meta API error");
      return NextResponse.json({ pages: mapPages(ownedJson.data), source: "owned" });
    }

    let business_id: string | undefined;
    try {
      const adAccountRes = await fetch(
        `${GRAPH_BASE}/${ad_account_id}?fields=business_id,business,owner_business&access_token=${encodeURIComponent(token)}`
      );
      const adAccountJson = (await adAccountRes.json()) as {
        business_id?: string;
        business?: { id: string } | string;
        owner_business?: { id: string } | string;
        error?: { message: string };
      };
      if (adAccountJson.error) throw new Error(adAccountJson.error.message || "Meta API error");
      business_id = adAccountJson.business_id;
      if (!business_id) {
        const businessObj = adAccountJson.business ?? adAccountJson.owner_business;
        business_id = typeof businessObj === "string" ? businessObj : businessObj?.id;
      }
    } catch {
      business_id = undefined;
    }

    if (business_id) {
      const ownedRes = await fetch(
        `${GRAPH_BASE}/${business_id}/owned_pages?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      );
      const ownedJson = (await ownedRes.json()) as {
        data?: PageNode[];
        error?: { message: string };
      };
      if (ownedJson.error) throw new Error(ownedJson.error.message || "Meta API error");
      return NextResponse.json({ pages: mapPages(ownedJson.data), source: "owned" });
    }

    const promoteRes = await fetch(
      `${GRAPH_BASE}/${ad_account_id}/promote_pages?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
    );
    const promoteJson = (await promoteRes.json()) as {
      data?: PageNode[];
      error?: { message: string };
    };
    if (promoteJson.error) throw new Error(promoteJson.error.message || "Meta API error");
    return NextResponse.json({ pages: mapPages(promoteJson.data), source: "promote" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar páginas da conta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
