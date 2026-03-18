/**
 * Meta Ads: campanhas, conjuntos e TODOS os anúncios (ativos ou não).
 *
 * - ATI: GET ?ati=1 — sem datas. Métricas de gasto/cliques = date_preset lifetime (fallback maximum).
 * - Outros: GET ?start=&end= — métricas só naquele intervalo.
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
  ad_account_id?: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

type AdFromApi = {
  id: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
  created_time?: string;
  effective_status?: string;
  adset?: { name?: string };
  campaign?: { name?: string };
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
        ad_account_id: adAccountId,
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

/** Gasto/cliques/impressões por anúncio com date_preset (lifetime, maximum, etc.). */
async function getInsightsByPreset(
  accessToken: string,
  adAccountId: string,
  datePreset: string
): Promise<MetaAdInsight[]> {
  const fields = "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,clicks,impressions,ctr,cpc";
  const params = new URLSearchParams({
    access_token: accessToken,
    fields,
    level: "ad",
    date_preset: datePreset,
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
        ad_account_id: adAccountId,
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

async function getInsightsAtiMode(accessToken: string, adAccountId: string): Promise<MetaAdInsight[]> {
  try {
    return await getInsightsByPreset(accessToken, adAccountId, "lifetime");
  } catch {
    try {
      return await getInsightsByPreset(accessToken, adAccountId, "maximum");
    } catch {
      return [];
    }
  }
}

/** Lista todos os ads da conta (qualquer status), para aparecer no ATI mesmo sem entrega no período. Retorna também mapa de status. */
async function getAllAds(
  accessToken: string,
  adAccountId: string
): Promise<{ ads: AdFromApi[]; adStatusMap: Record<string, string> }> {
  const fields = "id,name,adset_id,campaign_id,created_time,effective_status,adset{name},campaign{name}";
  const params = new URLSearchParams({
    access_token: accessToken,
    fields,
    limit: "500",
  });
  const url = `${GRAPH_BASE}/${adAccountId}/ads?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: AdFromApi[];
    paging?: { next?: string };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message || "Meta API error");

  const out: AdFromApi[] = [];
  const adStatusMap: Record<string, string> = {};
  let data = json.data ?? [];
  let nextUrl: string | null = json.paging?.next ?? null;
  while (data.length > 0 || nextUrl) {
    for (const ad of data) {
      out.push(ad);
      if (ad.id) adStatusMap[ad.id] = ad.effective_status ?? "UNKNOWN";
    }
    if (!nextUrl) break;
    const nextRes = await fetch(nextUrl);
    const nextJson = (await nextRes.json()) as { data?: AdFromApi[]; paging?: { next?: string } };
    data = nextJson.data ?? [];
    nextUrl = nextJson.paging?.next ?? null;
  }
  return { ads: out, adStatusMap };
}

/** Campanhas da conta: id, name, effective_status. Retorna lista para árvore e mapa de status. */
async function getCampaigns(
  accessToken: string,
  adAccountId: string
): Promise<{ campaignStatusMap: Map<string, string>; campaignsList: Array<{ id: string; name: string; ad_account_id: string }> }> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,effective_status",
    limit: "500",
  });
  const url = `${GRAPH_BASE}/${adAccountId}/campaigns?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: Array<{ id: string; name?: string; effective_status?: string }>;
    paging?: { next?: string };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message || "Meta API error");
  const campaignStatusMap = new Map<string, string>();
  const campaignsList: Array<{ id: string; name: string; ad_account_id: string }> = [];
  let data = json.data ?? [];
  let nextUrl: string | null = json.paging?.next ?? null;
  while (data.length > 0 || nextUrl) {
    for (const c of data) {
      if (c.id) {
        campaignStatusMap.set(c.id, c.effective_status ?? "UNKNOWN");
        campaignsList.push({ id: c.id, name: c.name ?? c.id, ad_account_id: adAccountId });
      }
    }
    if (!nextUrl) break;
    const nextRes = await fetch(nextUrl);
    const nextJson = (await nextRes.json()) as {
      data?: Array<{ id: string; name?: string; effective_status?: string }>;
      paging?: { next?: string };
    };
    data = nextJson.data ?? [];
    nextUrl = nextJson.paging?.next ?? null;
  }
  return { campaignStatusMap, campaignsList };
}

/** Todos os conjuntos (ad sets) da conta, para exibir conjuntos sem anúncios no ATI. */
async function getAllAdSets(
  accessToken: string,
  adAccountId: string
): Promise<{
  adSetList: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }>;
  adSetStatusMap: Record<string, string>;
}> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,campaign_id,effective_status",
    limit: "500",
  });
  const url = `${GRAPH_BASE}/${adAccountId}/adsets?${params.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as {
    data?: Array<{ id: string; name?: string; campaign_id?: string; effective_status?: string }>;
    paging?: { next?: string };
    error?: { message: string };
  };
  if (json.error) throw new Error(json.error.message || "Meta API error");
  const adSetList: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }> = [];
  const adSetStatusMap: Record<string, string> = {};
  let data = json.data ?? [];
  let nextUrl: string | null = json.paging?.next ?? null;
  while (data.length > 0 || nextUrl) {
    for (const s of data) {
      if (s.id) {
        adSetList.push({
          id: s.id,
          name: s.name ?? s.id,
          campaign_id: s.campaign_id ?? "",
          ad_account_id: adAccountId,
        });
        adSetStatusMap[s.id] = s.effective_status ?? "UNKNOWN";
      }
    }
    if (!nextUrl) break;
    const nextRes = await fetch(nextUrl);
    const nextJson = (await nextRes.json()) as {
      data?: Array<{ id: string; name?: string; campaign_id?: string; effective_status?: string }>;
      paging?: { next?: string };
    };
    data = nextJson.data ?? [];
    nextUrl = nextJson.paging?.next ?? null;
  }
  return { adSetList, adSetStatusMap };
}

function toInsightFromAd(ad: AdFromApi, adAccountId: string): MetaAdInsight {
  return {
    ad_id: String(ad.id ?? ""),
    ad_name: String(ad.name ?? ad.id ?? "Sem nome"),
    adset_id: String(ad.adset_id ?? ""),
    adset_name: String(ad.adset?.name ?? ad.adset_id ?? ""),
    campaign_id: String(ad.campaign_id ?? ""),
    campaign_name: String(ad.campaign?.name ?? ad.campaign_id ?? ""),
    ad_account_id: adAccountId,
    spend: 0,
    clicks: 0,
    impressions: 0,
    ctr: 0,
    cpc: 0,
  };
}

/** Mapeamento: id do anúncio que está rodando (cópia) -> id exibido no ATI (original). Mescla linhas por display_ad_id. */
function applyMappingAndMerge(rows: MetaAdInsight[], mapping: Map<string, string>): MetaAdInsight[] {
  const byDisplayId = new Map<string, MetaAdInsight>();
  for (const row of rows) {
    const displayId = mapping.get(row.ad_id) ?? row.ad_id;
    const existing = byDisplayId.get(displayId);
    if (existing) {
      existing.spend += row.spend;
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      existing.ctr = existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
      existing.cpc = existing.clicks > 0 ? existing.spend / existing.clicks : 0;
    } else {
      byDisplayId.set(displayId, { ...row, ad_id: displayId });
    }
  }
  return Array.from(byDisplayId.values());
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
    const atiMode = url.searchParams.get("ati") === "1";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!atiMode && (!start || !end)) {
      return NextResponse.json(
        { error: "Parâmetros start e end são obrigatórios (YYYY-MM-DD), exceto no modo ATI (?ati=1)." },
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

    // Por conta: insights, ads (com status), campanhas (com nome), conjuntos
    const allInsights: MetaAdInsight[] = [];
    const campaignStatusMap: Record<string, string> = {};
    const campaignsList: Array<{ id: string; name: string; ad_account_id: string }> = [];
    const adSetList: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }> = [];
    const adSetStatusMap: Record<string, string> = {};
    const adStatusMap: Record<string, string> = {};
    for (const account of accounts) {
      const accountId = account.id;
      try {
        const [adsResult, campaignsResult, adSetsResult] = await Promise.all([
          getAllAds(token, accountId),
          getCampaigns(token, accountId),
          getAllAdSets(token, accountId),
        ]);
        let insights: MetaAdInsight[] = [];
        if (atiMode) {
          insights = await getInsightsAtiMode(token, accountId);
        } else {
          try {
            insights = await getInsights(token, accountId, start!, end!);
          } catch {
            insights = [];
          }
        }
        const ads = adsResult.ads;
        for (const [id, status] of Object.entries(adsResult.adStatusMap)) {
          adStatusMap[id] = status;
        }
        campaignsResult.campaignStatusMap.forEach((status, id) => {
          campaignStatusMap[id] = status;
        });
        campaignsList.push(...campaignsResult.campaignsList);
        adSetList.push(...adSetsResult.adSetList);
        for (const [id, status] of Object.entries(adSetsResult.adSetStatusMap)) {
          adSetStatusMap[id] = status;
        }
        for (const i of insights) i.ad_account_id = accountId;
        const insightByAdId = new Map<string, MetaAdInsight>();
        for (const i of insights) insightByAdId.set(i.ad_id, i);
        const sortedAds = [...ads].sort((a, b) => {
          const ta = a.created_time ? new Date(a.created_time).getTime() : 0;
          const tb = b.created_time ? new Date(b.created_time).getTime() : 0;
          return tb - ta;
        });
        for (const ad of sortedAds) {
          const existing = insightByAdId.get(ad.id);
          if (existing) {
            existing.ad_account_id = accountId;
            allInsights.push(existing);
          } else {
            allInsights.push(toInsightFromAd(ad, accountId));
          }
        }
      } catch (err) {
        continue;
      }
    }

    const { data: mappingRows } = await supabase
      .from("meta_ad_display_mapping")
      .select("delivering_ad_id, display_ad_id")
      .eq("user_id", user.id);
    const mapping = new Map<string, string>();
    if (mappingRows) {
      for (const r of mappingRows) {
        mapping.set(String(r.delivering_ad_id), String(r.display_ad_id));
      }
    }
    const mergedInsights = applyMappingAndMerge(allInsights, mapping);

    return NextResponse.json({
      adAccounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      insights: mergedInsights,
      campaignStatusMap,
      campaignsList,
      adSetList,
      adSetStatusMap,
      adStatusMap,
      ...(atiMode ? { atiLifetimeMetrics: true as const } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar dados do Meta";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
