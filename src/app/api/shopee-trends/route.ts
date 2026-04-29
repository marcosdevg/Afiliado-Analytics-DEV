/**
 * Devolve a snapshot atual de tendências Shopee + sparklines de 24h.
 *
 *   GET /api/shopee-trends?tab=score|sales|commission|flash|category
 *                          &categoryId=<id> (só com tab=category)
 *                          &limit=50
 *
 * Tabs:
 *   - score:      ordenado por viralization_score desc
 *   - sales:      ordenado por sales desc
 *   - commission: ordenado por commission_rate desc
 *   - flash:      filtra produtos com discountRate >= 0.30 (price_max vs price_min)
 *                 ordenados por discountRate desc — proxy de "Oferta Relâmpago"
 *   - category:   filtra por categoryId no array category_ids[], ordenado por sales desc
 *
 * Resposta:
 *   {
 *     fetchedAt, stagnant,
 *     products: [...],         // produtos da aba selecionada
 *     stats: {
 *       total, viralCount, avgScore,
 *       totalSalesAggregate,    // soma de todas as vendas do snapshot (visão macro)
 *       avgCommission,           // % média de comissão
 *       hottestCategoryId,       // categoria com mais produtos no top 50
 *       topShop                  // loja com mais aparições
 *     },
 *     categoriesAvailable: [{ categoryId, count }]   // pra construir a aba "Por categoria"
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type TabKey = "score" | "sales" | "commission" | "flash" | "category";

type SnapshotRow = {
  item_id: number;
  product_name: string;
  image_url: string | null;
  price: number | string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  sales: number;
  commission_rate: number | string | null;
  rating_star: number | string | null;
  product_link: string | null;
  shop_name: string | null;
  category_ids: number[] | null;
  viralization_score: number | null;
  rank_position: number | null;
  is_viral: boolean;
  fetched_at: string;
};

type ObservationRow = {
  item_id: number;
  observed_at: string;
  sales: number;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeDiscountRate(min: number | null, max: number | null): number {
  if (min == null || max == null || max <= 0 || min >= max) return 0;
  return Math.max(0, Math.min(1, (max - min) / max));
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const tabRaw = url.searchParams.get("tab") ?? "score";
    const tab: TabKey =
      tabRaw === "sales" || tabRaw === "commission" || tabRaw === "flash" || tabRaw === "category"
        ? tabRaw
        : "score";
    const limit = Math.max(10, Math.min(100, Number(url.searchParams.get("limit") ?? 50)));
    const categoryIdFilter = num(url.searchParams.get("categoryId"));

    // Sempre puxamos o snapshot inteiro (até 100 itens) e filtramos/ordenamos
    // no JS. Isso simplifica os filtros compostos (flash, category) e o custo
    // é trivial em 100 rows.
    const { data: snapshot, error: snapErr } = await supabase
      .from("shopee_trend_snapshots")
      .select(
        "item_id, product_name, image_url, price, price_min, price_max, sales, commission_rate, rating_star, product_link, shop_name, category_ids, viralization_score, rank_position, is_viral, fetched_at",
      )
      .order("fetched_at", { ascending: false })
      .limit(200);

    if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });
    if (!snapshot || snapshot.length === 0) {
      return NextResponse.json({
        fetchedAt: null,
        stagnant: true,
        products: [],
        stats: emptyStats(),
        categoriesAvailable: [],
      });
    }

    const allRows = snapshot as SnapshotRow[];
    const fetchedAt = allRows[0]?.fetched_at ?? null;
    const stagnantThreshold = 90 * 60 * 1000;
    const stagnant = fetchedAt
      ? Date.now() - new Date(fetchedAt).getTime() > stagnantThreshold
      : true;

    // Sparklines + delta de vendas (uma única query cobre os dois).
    const itemIds = allRows.map((r) => r.item_id);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: observations } = await supabase
      .from("shopee_trend_observations")
      .select("item_id, observed_at, score, sales")
      .in("item_id", itemIds)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true });

    const sparkByItem = new Map<number, number[]>();
    // Pra cada item, capturamos a primeira e última observação de vendas em
    // 24h. `salesDelta24h = last - first` revela o ritmo real do mercado e é o
    // que a curadoria Sho.IA usa pra ranquear "o que mais vende agora".
    const salesRangeByItem = new Map<number, { first: number; last: number }>();
    for (const obs of (observations ?? []) as Array<
      ObservationRow & { score?: number | null; sales?: number | null }
    >) {
      // Sparkline do SCORE (variação visual mais rica que vendas monotônicas)
      const sArr = sparkByItem.get(obs.item_id) ?? [];
      sArr.push(typeof obs.score === "number" ? obs.score : 0);
      sparkByItem.set(obs.item_id, sArr);

      // Sales range (primeiro = oldest na ordem ASC, last vai sobrescrevendo)
      const salesVal = typeof obs.sales === "number" ? obs.sales : 0;
      const cur = salesRangeByItem.get(obs.item_id);
      if (!cur) {
        salesRangeByItem.set(obs.item_id, { first: salesVal, last: salesVal });
      } else {
        cur.last = salesVal;
      }
    }

    // Mapeia rows → shape público + computa discountRate + salesDelta24h
    const allProducts = allRows.map((r) => {
      const priceMin = num(r.price_min);
      const priceMax = num(r.price_max);
      const discountRate = computeDiscountRate(priceMin, priceMax);
      const score = r.viralization_score ?? 0;
      const range = salesRangeByItem.get(r.item_id);
      const salesDelta24h = range ? Math.max(0, range.last - range.first) : 0;
      return {
        itemId: r.item_id,
        productName: r.product_name,
        imageUrl: r.image_url,
        price: num(r.price),
        priceMin,
        priceMax,
        sales: r.sales,
        salesDelta24h,
        commissionRate: num(r.commission_rate),
        ratingStar: num(r.rating_star),
        productLink: r.product_link,
        shopName: r.shop_name,
        categoryIds: r.category_ids ?? [],
        score,
        isViral: r.is_viral,
        rankPosition: r.rank_position,
        discountRate,
        sparkline: sparkByItem.get(r.item_id) ?? [score],
      };
    });

    // Aplica filtro/ordem por aba.
    let products = allProducts;
    if (tab === "score") {
      products = [...allProducts].sort((a, b) => b.score - a.score);
    } else if (tab === "sales") {
      products = [...allProducts].sort((a, b) => b.sales - a.sales);
    } else if (tab === "commission") {
      products = [...allProducts].sort(
        (a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0),
      );
    } else if (tab === "flash") {
      products = allProducts
        .filter((p) => p.discountRate >= 0.3 && p.sales >= 50)
        .sort((a, b) => b.discountRate - a.discountRate);
    } else if (tab === "category") {
      if (categoryIdFilter != null) {
        products = allProducts
          .filter((p) => p.categoryIds.includes(categoryIdFilter))
          .sort((a, b) => b.sales - a.sales);
      } else {
        products = [];
      }
    }
    products = products.slice(0, limit);

    // Stats globais (usando todo o snapshot, não só a aba)
    const stats = computeStats(allProducts);

    // Categorias com contagem (pra dropdown da aba "Por Categoria"). Nomes
    // resolvidos via `shopee_category_directory` cacheado pelo cron — quando
    // não tiver nome, devolvemos null e o client mostra "Categoria #ID" como
    // fallback ao invés de esconder a opção.
    const catCounts = new Map<number, number>();
    for (const p of allProducts) {
      for (const cid of p.categoryIds) {
        catCounts.set(cid, (catCounts.get(cid) ?? 0) + 1);
      }
    }
    let nameByCategory = new Map<number, string>();
    if (catCounts.size > 0) {
      const ids = [...catCounts.keys()];
      const { data: catRows } = await supabase
        .from("shopee_category_directory")
        .select("category_id, name")
        .in("category_id", ids);
      nameByCategory = new Map(
        ((catRows ?? []) as Array<{ category_id: number; name: string }>).map((r) => [
          r.category_id,
          r.name,
        ]),
      );
    }
    const categoriesAvailable = Array.from(catCounts.entries())
      .map(([categoryId, count]) => ({
        categoryId,
        count,
        name: nameByCategory.get(categoryId) ?? null,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      fetchedAt,
      stagnant,
      products,
      stats,
      categoriesAvailable,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar tendências";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function emptyStats() {
  return {
    total: 0,
    viralCount: 0,
    avgScore: 0,
    totalSalesAggregate: 0,
    avgCommission: 0,
    hottestCategoryId: null as number | null,
    topShop: null as string | null,
  };
}

function computeStats(products: Array<{
  score: number;
  isViral: boolean;
  sales: number;
  commissionRate: number | null;
  categoryIds: number[];
  shopName: string | null;
}>) {
  if (products.length === 0) return emptyStats();
  const totalScore = products.reduce((acc, p) => acc + p.score, 0);
  const totalSales = products.reduce((acc, p) => acc + p.sales, 0);
  const totalComm = products.reduce((acc, p) => acc + (p.commissionRate ?? 0), 0);
  const catCounts = new Map<number, number>();
  for (const p of products) for (const cid of p.categoryIds) {
    catCounts.set(cid, (catCounts.get(cid) ?? 0) + 1);
  }
  const hottestCategoryId =
    catCounts.size > 0
      ? [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;
  const shopCounts = new Map<string, number>();
  for (const p of products) if (p.shopName) {
    shopCounts.set(p.shopName, (shopCounts.get(p.shopName) ?? 0) + 1);
  }
  const topShop =
    shopCounts.size > 0 ? [...shopCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
  return {
    total: products.length,
    viralCount: products.filter((p) => p.isViral).length,
    avgScore: Math.round(totalScore / products.length),
    totalSalesAggregate: totalSales,
    avgCommission: Math.round((totalComm / products.length) * 1000) / 10, // ex: 18.4
    hottestCategoryId,
    topShop,
  };
}
