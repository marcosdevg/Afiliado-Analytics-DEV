/**
 * Métricas agregadas de vendas Mercado Pago do vendedor.
 *
 *   GET /api/infoprodutor/mp-sales?period=7d|30d|90d|all
 *
 * Resposta:
 *   {
 *     period, hasProducts,
 *     summary: { totalRevenue, totalSales, avgTicket, totalRefunded, refundRate, uniqueCustomers },
 *     byDay: [{ date, revenue, sales }],
 *     topProducts: [{ produtoId, name, imageUrl, sales, revenue }],
 *     fetchedAt
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";
import { searchMpPayments, type MpPayment } from "@/lib/mercadopago/api";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d" | "all";

function periodStartIso(period: Period): string | undefined {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDateUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function buildDailySeries(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const f = new Date(fromIso);
  f.setUTCHours(0, 0, 0, 0);
  const t = new Date(toIso);
  t.setUTCHours(0, 0, 0, 0);
  for (let d = f.getTime(); d <= t.getTime(); d += 86_400_000) {
    out.push(new Date(d).toISOString().slice(0, 10));
  }
  return out;
}

function parseExternalReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = /^infoprod:([0-9a-f-]{36})$/i.exec(ref.trim());
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const url = new URL(req.url);
    const periodRaw = String(url.searchParams.get("period") ?? "30d").trim().toLowerCase();
    const period: Period = (["7d", "30d", "90d", "all"] as Period[]).includes(periodRaw as Period)
      ? (periodRaw as Period)
      : "30d";

    const { data: profile } = await supabase
      .from("profiles")
      .select("mp_access_token")
      .eq("id", gate.userId)
      .single();
    const accessToken =
      (profile as { mp_access_token?: string | null } | null)?.mp_access_token?.trim() ?? "";
    if (!accessToken) {
      return NextResponse.json(
        { error: "Conta Mercado Pago não conectada. Conecte em Configurações." },
        { status: 400 },
      );
    }

    const { data: produtos } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, image_url")
      .eq("user_id", gate.userId)
      .eq("provider", "mercadopago");

    type ProdInfo = { id: string; name: string; imageUrl: string | null };
    const byProductId = new Map<string, ProdInfo>();
    for (const p of produtos ?? []) {
      const row = p as { id: string; name: string; image_url: string | null };
      byProductId.set(row.id, { id: row.id, name: row.name, imageUrl: row.image_url });
    }

    const empty = {
      period,
      hasProducts: byProductId.size > 0,
      summary: {
        totalRevenue: 0,
        totalSales: 0,
        avgTicket: 0,
        totalRefunded: 0,
        refundRate: 0,
        uniqueCustomers: 0,
      },
      byDay: [] as Array<{ date: string; revenue: number; sales: number }>,
      topProducts: [] as Array<{ produtoId: string; name: string; imageUrl: string | null; sales: number; revenue: number }>,
      fetchedAt: new Date().toISOString(),
    };
    if (byProductId.size === 0) return NextResponse.json(empty);

    const beginDate = periodStartIso(period);
    const matched: MpPayment[] = [];
    let offset = 0;
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await searchMpPayments(
        { begin_date: beginDate, limit: PAGE_SIZE, offset },
        accessToken,
      );
      const results = page.results ?? [];
      for (const p of results) {
        const produtoId = parseExternalReference(p.external_reference);
        if (!produtoId || !byProductId.has(produtoId)) continue;
        matched.push(p);
      }
      if (results.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      if (offset >= (page.paging?.total ?? Infinity)) break;
    }

    // Agregação — só conta `approved` como venda; `refunded` aparece em totalRefunded.
    let totalRevenue = 0;
    let totalSales = 0;
    let totalRefunded = 0;
    const dailyMap = new Map<string, { revenue: number; sales: number }>();
    const produtoMap = new Map<string, { sales: number; revenue: number }>();
    const customers = new Set<string>();

    for (const p of matched) {
      const amount = typeof p.transaction_amount === "number" ? p.transaction_amount : 0;
      const day = isoDateUtc(p.date_created);
      const produtoId = parseExternalReference(p.external_reference) ?? "";

      if (p.status === "approved") {
        totalRevenue += amount;
        totalSales += 1;
        if (day) {
          const entry = dailyMap.get(day) ?? { revenue: 0, sales: 0 };
          entry.revenue += amount;
          entry.sales += 1;
          dailyMap.set(day, entry);
        }
        if (produtoId) {
          const entry = produtoMap.get(produtoId) ?? { sales: 0, revenue: 0 };
          entry.sales += 1;
          entry.revenue += amount;
          produtoMap.set(produtoId, entry);
        }
        const email = p.payer?.email?.trim().toLowerCase();
        if (email) customers.add(email);
      } else if (p.status === "refunded") {
        totalRefunded += amount;
      }
    }

    // byDay — preenche dias zerados pra UI poder fazer linha contínua
    const fromIso = beginDate ?? matched[matched.length - 1]?.date_created ?? new Date().toISOString();
    const toIso = new Date().toISOString();
    const dailyDates = buildDailySeries(fromIso, toIso);
    const byDay = dailyDates.map((date) => {
      const entry = dailyMap.get(date) ?? { revenue: 0, sales: 0 };
      return { date, revenue: entry.revenue, sales: entry.sales };
    });

    const topProducts = [...produtoMap.entries()]
      .map(([pid, agg]) => {
        const info = byProductId.get(pid);
        return {
          produtoId: pid,
          name: info?.name ?? "Produto removido",
          imageUrl: info?.imageUrl ?? null,
          sales: agg.sales,
          revenue: agg.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({
      period,
      hasProducts: true,
      summary: {
        totalRevenue,
        totalSales,
        avgTicket: totalSales > 0 ? totalRevenue / totalSales : 0,
        totalRefunded,
        refundRate: totalRevenue > 0 ? totalRefunded / totalRevenue : 0,
        uniqueCustomers: customers.size,
      },
      byDay,
      topProducts,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
