/**
 * Lista contas de Instagram disponíveis para anúncios.
 * GET /api/meta/instagram-accounts?ad_account_id=act_xxx&page_id=xxx&business_id=xxx
 *
 * Tenta múltiplas fontes da Graph API (deduplica por id).
 * Retorna _debug para diagnóstico quando nenhuma conta é encontrada.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

type IgNode = { id: string; username?: string; profile_pic?: string; name?: string; profile_picture_url?: string };

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("meta_access_token")
      .eq("id", user.id)
      .single();

    const token = profile?.meta_access_token?.trim();
    if (!token) return NextResponse.json({ error: "Token do Meta não configurado." }, { status: 400 });

    const url = new URL(req.url);
    const adAccountId = url.searchParams.get("ad_account_id")?.trim();
    const pageId = url.searchParams.get("page_id")?.trim();
    const businessId = url.searchParams.get("business_id")?.trim();

    if (!adAccountId) return NextResponse.json({ error: "ad_account_id é obrigatório." }, { status: 400 });

    const seen = new Set<string>();
    const accounts: { id: string; username: string; profile_pic: string | null; source: string }[] = [];
    const debug: string[] = [];

    const addAccount = (node: IgNode, source: string) => {
      if (!node.id || seen.has(node.id)) return;
      seen.add(node.id);
      accounts.push({
        id: node.id,
        username: node.username || node.name || node.id,
        profile_pic: node.profile_pic || node.profile_picture_url || null,
        source,
      });
    };

    const fetchJson = async (fetchUrl: string) => {
      const res = await fetch(fetchUrl);
      return res.json();
    };

    // Obter page access token
    let pageAccessToken: string | null = null;
    if (pageId) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(token)}`);
        const match = (json.data as { id: string; access_token?: string }[] | undefined)?.find((p) => p.id === pageId);
        pageAccessToken = match?.access_token ?? null;
        debug.push(`page_token: ${pageAccessToken ? "ok" : "não encontrado"}`);
      } catch { debug.push("page_token: erro"); }
    }

    // 1) /{page_id}/instagram_accounts com page token
    if (pageId && pageAccessToken) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${pageId}/instagram_accounts?fields=id,username,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`);
        debug.push(`page/ig: ${json.data?.length ?? 0}${json.error ? ` err:${json.error.message}` : ""}`);
        if (json.data) (json.data as IgNode[]).forEach((n) => addAccount(n, "page"));
      } catch { debug.push("page/ig: erro"); }
    }

    // 2) /{page_id} fields direto (instagram_business_account + connected_instagram_account)
    if (pageId && accounts.length === 0) {
      const tkn = pageAccessToken || token;
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url},connected_instagram_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(tkn)}`);
        const biz = json.instagram_business_account;
        const conn = json.connected_instagram_account;
        if (biz) addAccount({ id: biz.id, username: biz.username, profile_picture_url: biz.profile_picture_url }, "page_biz");
        if (conn) addAccount({ id: conn.id, username: conn.username, profile_picture_url: conn.profile_picture_url }, "page_conn");
        debug.push(`page_fields: biz=${biz?.id ?? "-"} conn=${conn?.id ?? "-"}${json.error ? ` err:${json.error.message}` : ""}`);
      } catch { debug.push("page_fields: erro"); }
    }

    // 3) /{ad_account_id}/instagram_accounts
    if (accounts.length === 0) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${adAccountId}/instagram_accounts?fields=id,username,profile_pic&access_token=${encodeURIComponent(token)}`);
        debug.push(`adacct/ig: ${json.data?.length ?? 0}${json.error ? ` err:${json.error.message}` : ""}`);
        if (json.data) (json.data as IgNode[]).forEach((n) => addAccount(n, "ad_account"));
      } catch { debug.push("adacct/ig: erro"); }
    }

    // Resolver business_id
    const bizId = businessId || await (async () => {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${adAccountId}?fields=business{id}&access_token=${encodeURIComponent(token)}`);
        return json.business?.id as string | undefined;
      } catch { return undefined; }
    })();

    // 4) /{business_id}/instagram_accounts
    if (bizId && accounts.length === 0) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${bizId}/instagram_accounts?fields=id,username,profile_pic&access_token=${encodeURIComponent(token)}`);
        debug.push(`biz/ig: ${json.data?.length ?? 0}${json.error ? ` err:${json.error.message}` : ""}`);
        if (json.data) (json.data as IgNode[]).forEach((n) => addAccount(n, "business"));
      } catch { debug.push("biz/ig: erro"); }
    }

    // 5) /{business_id}/owned_instagram_accounts
    if (bizId && accounts.length === 0) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${bizId}/owned_instagram_accounts?fields=id,username,profile_pic&access_token=${encodeURIComponent(token)}`);
        debug.push(`biz/owned_ig: ${json.data?.length ?? 0}${json.error ? ` err:${json.error.message}` : ""}`);
        if (json.data) (json.data as IgNode[]).forEach((n) => addAccount(n, "biz_owned"));
      } catch { debug.push("biz/owned_ig: erro"); }
    }

    // 6) /{business_id}/client_instagram_accounts
    if (bizId && accounts.length === 0) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/${bizId}/client_instagram_accounts?fields=id,username,profile_pic&access_token=${encodeURIComponent(token)}`);
        debug.push(`biz/client_ig: ${json.data?.length ?? 0}${json.error ? ` err:${json.error.message}` : ""}`);
        if (json.data) (json.data as IgNode[]).forEach((n) => addAccount(n, "biz_client"));
      } catch { debug.push("biz/client_ig: erro"); }
    }

    // 7) Fallback: me/accounts → instagram_business_account
    if (accounts.length === 0) {
      try {
        const json = await fetchJson(`${GRAPH_BASE}/me/accounts?fields=id,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(token)}`);
        let count = 0;
        if (json.data) {
          for (const page of json.data as { instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[]) {
            if (page.instagram_business_account) {
              addAccount({ id: page.instagram_business_account.id, username: page.instagram_business_account.username, profile_picture_url: page.instagram_business_account.profile_picture_url }, "me_accounts");
              count++;
            }
          }
        }
        debug.push(`me/accounts: ${count}${json.error ? ` err:${json.error.message}` : ""}`);
      } catch { debug.push("me/accounts: erro"); }
    }

    return NextResponse.json({ accounts, _debug: debug });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao listar contas Instagram" }, { status: 500 });
  }
}
