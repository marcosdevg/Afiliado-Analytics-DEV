/**
 * Busca insights do Meta Ads (campanhas, conjuntos, anúncios) para o período.
 * GET /api/meta/insights?start=YYYY-MM-DD&end=YYYY-MM-DD
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type MetaAdInsight = {
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

async function getAdAccounts(accessToken: string): Promise<{ id: string; name: string }[]> {
  const url = `${GRAPH_BASE}/me/adaccounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const json = (await res.json()) as { data?: { id: string; name: string }[]; error?: { message: string } };
  if (json.error) throw new Error(json.error.message || "Meta API error");
  return json.data ?? [];
}

async function getInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<MetaAdInsight[]> {
  const fields = "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,clicks,impressions,ctr,cpc";
  const params = new URLSearchParams({
    access_token: accessToken,
    fields,
    level: "ad",
    "time_range[since]": since,
    "time_range[until]": until,
  });
  const url = `${GRAPH_BASE}/${adAccountId}/insights?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: Array<Record<string, string | undefined>>;
    paging?: { next?: string };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message || "Meta API error");

  const out: MetaAdInsight[] = [];
  let data = json.data ?? [];

  // Paginar se houver next
  let nextUrl: string | null = json.paging?.next ?? null;
  while (data.length > 0 || nextUrl) {
    for (const row of data) {
      const spend = parseFloat(row.spend ?? "0") || 0;
      const clicks = parseInt(row.clicks ?? "0", 10) || 0;
      const impressions = parseInt(row.impressions ?? "0", 10) || 0;
      const ctr = parseFloat(row.ctr ?? "0") || 0;
      const cpc = parseFloat(row.cpc ?? "0") || (clicks > 0 ? spend / clicks : 0);
      out.push({
        ad_id: String(row.ad_id ?? ""),
        ad_name: String(row.ad_name ?? row.ad_id ?? "Sem nome"),
        adset_id: String(row.adset_id ?? ""),
        adset_name: String(row.adset_name ?? row.adset_id ?? ""),
        campaign_id: String(row.campaign_id ?? ""),
        campaign_name: String(row.campaign_name ?? row.campaign_id ?? ""),
        spend,
        clicks,
        impressions,
        ctr,
        cpc,
      });
    }
    if (!nextUrl) break;
    const nextRes = await fetch(nextUrl);
    const nextJson = (await nextRes.json()) as {
      data?: Array<Record<string, string | undefined>>;
      paging?: { next?: string };
    };
    data = nextJson.data ?? [];
    nextUrl = nextJson.paging?.next ?? null;
  }

  return out;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json(
        { error: "Parâmetros start e end são obrigatórios (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const accounts = await getAdAccounts(token);
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma conta de anúncios encontrada para este token." },
        { status: 400 }
      );
    }

    // Busca insights em TODAS as contas (ex.: Honey Garden HGARDEN1 + Sua conta)
    const allInsights: MetaAdInsight[] = [];
    for (const account of accounts) {
      const accountId = account.id;
      try {
        const insights = await getInsights(token, accountId, start, end);
        allInsights.push(...insights);
      } catch (err) {
        // Uma conta pode falhar (ex.: sem permissão); continua nas outras
        continue;
      }
    }

    return NextResponse.json({
      adAccounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      insights: allInsights,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar dados do Meta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
