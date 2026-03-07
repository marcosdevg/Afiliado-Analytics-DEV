/**
 * Dados ATI: cruza Meta Ads + Shopee por Sub-ID e aplica regras de status/diagnóstico.
 * GET /api/ati/data?start=YYYY-MM-DD&end=YYYY-MM-DD
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import {
  getLevelCpcMeta,
  getLevelClickDiscrepancy,
  getLevelCpa,
  getLevelRoas,
  getCreativeStatus,
  getCreativeDiagnosis,
  canValidateCreative,
} from "@/lib/ati/rules";
import type { ATICreativeRow } from "@/lib/ati/types";

type ShopeeRow = {
  "Comissão líquida do afiliado(R$)": string;
  "Valor de Compra(R$)": string;
  Sub_id1: string;
};

function parseMoney(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Agrega por sub_id: comissão, receita, pedidos. Sub_id1 pode ser "a / b". */
function aggregateShopeeBySubId(rows: ShopeeRow[]): Map<string, { commission: number; revenue: number; orders: number }> {
  const map = new Map<string, { commission: number; revenue: number; orders: number }>();
  for (const row of rows) {
    const commission = parseMoney(row["Comissão líquida do afiliado(R$)"]);
    const revenue = parseMoney(row["Valor de Compra(R$)"]);
    const parts = row.Sub_id1
      .split(/\/|\\/)
      .map((s) => s.trim())
      .filter(Boolean);
    const subIds = parts.length > 0 ? parts : ["Sem Sub ID"];
    for (const subId of subIds) {
      const cur = map.get(subId) ?? { commission: 0, revenue: 0, orders: 0 };
      cur.commission += commission;
      cur.revenue += revenue;
      cur.orders += 1;
      map.set(subId, cur);
    }
  }
  return map;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json(
        { error: "Parâmetros start e end são obrigatórios (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const baseUrl = new URL(req.url).origin;

    const [metaRes, shopeeRes] = await Promise.all([
      fetch(`${baseUrl}/api/meta/insights?start=${start}&end=${end}`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
      }),
      fetch(`${baseUrl}/api/shopee/conversion-report?start=${start}&end=${end}`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
      }),
    ]);

    if (!metaRes.ok) {
      const err = (await metaRes.json()) as { error?: string };
      return NextResponse.json(
        { error: err.error ?? "Erro ao buscar dados do Meta" },
        { status: metaRes.status }
      );
    }
    if (!shopeeRes.ok) {
      const err = (await shopeeRes.json()) as { error?: string };
      return NextResponse.json(
        { error: err.error ?? "Erro ao buscar dados da Shopee" },
        { status: shopeeRes.status }
      );
    }

    const metaJson = (await metaRes.json()) as { insights?: Array<{
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
    }> };
    const shopeeJson = (await shopeeRes.json()) as { data?: ShopeeRow[] };

    const insights = metaJson.insights ?? [];
    const shopeeRows = shopeeJson.data ?? [];
    const shopeeBySubId = aggregateShopeeBySubId(shopeeRows);

    const creatives: ATICreativeRow[] = insights.map((m) => {
      const subId = m.ad_id;
      const shopee = shopeeBySubId.get(subId) ?? shopeeBySubId.get(m.ad_name) ?? { commission: 0, revenue: 0, orders: 0 };
      const cost = m.spend;
      const clicksMeta = m.clicks;
      const orders = shopee.orders;
      const commission = shopee.commission;
      const revenue = shopee.revenue;
      const cpa = orders > 0 ? cost / orders : 0;
      const roas = cost > 0 ? commission / cost : 0;
      const epc = clicksMeta > 0 ? commission / clicksMeta : 0;
      const clicksShopee = 0;
      const cpcShopee = 0;
      const clickDiscrepancyPct = clicksMeta > 0 ? ((clicksMeta - clicksShopee) / clicksMeta) * 100 : 0;

      const levelCpcMeta = getLevelCpcMeta(m.cpc);
      const levelClickDiscrepancy = getLevelClickDiscrepancy(clickDiscrepancyPct);
      const levelCpa = getLevelCpa(cpa);
      const levelRoas = getLevelRoas(roas);
      const status = getCreativeStatus(roas, m.cpc, clickDiscrepancyPct, cpa);
      const diagnosis = getCreativeDiagnosis(
        status,
        roas,
        m.cpc,
        levelCpcMeta,
        clickDiscrepancyPct,
        levelClickDiscrepancy,
        orders
      );
      const canValidate = canValidateCreative(status);

      return {
        adId: m.ad_id,
        adName: m.ad_name,
        adSetId: m.adset_id,
        adSetName: m.adset_name,
        campaignId: m.campaign_id,
        campaignName: m.campaign_name,
        subId,
        cost,
        clicksMeta,
        ctrMeta: m.ctr,
        cpcMeta: m.cpc,
        clicksShopee,
        cpcShopee,
        orders,
        revenue,
        commission,
        cpa,
        roas,
        epc,
        clickDiscrepancyPct,
        levelCpcMeta,
        levelClickDiscrepancy,
        levelCpa,
        levelRoas,
        status,
        diagnosis,
        canValidate,
      };
    });

    const validated: Array<{ id: string; adId: string; adName: string; campaignId: string; campaignName: string; scaledAt: string }> = [];
    const { data: validatedRows, error: validatedError } = await supabase
      .from("ati_validated_creatives")
      .select("id, ad_id, ad_name, campaign_id, campaign_name, scaled_at")
      .eq("user_id", user.id);
    if (!validatedError && validatedRows) {
      for (const v of validatedRows) {
        validated.push({
          id: v.id,
          adId: v.ad_id,
          adName: v.ad_name,
          campaignId: v.campaign_id,
          campaignName: v.campaign_name,
          scaledAt: v.scaled_at,
        });
      }
    }

    return NextResponse.json({
      creatives,
      validated,
      dateStart: start,
      dateEnd: end,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar dados ATI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
