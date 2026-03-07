import type {
  TemporalChartData,
  ChannelData,
  SubIdData,
  ProductData,
  CategoryNode,
  TopCategoryData,
  AttributionData,
} from "@/types";

export interface CommissionDataRow {
  "ID do pedido": string;
  "Comissão líquida do afiliado(R$)": string;
  "Valor de Compra(R$)": string;
  "Status do Pedido": string;
  "Horário do pedido": string;
  Canal: string;
  Sub_id1: string;
  "Nome do Item": string;
  Qtd: string;
  "Categoria Global L1": string;
  "Categoria Global L2": string;
  "Categoria Global L3": string;
  "Tipo de atribuição": string;
}

type TemporalAggTemp = {
  orderIds: Set<string>;
  concluidos: Set<string>;
  pendentes: Set<string>;
  cancelados: Set<string>;
  nao_pagos: Set<string>;
};

type WeeklyAggTemp = TemporalAggTemp & { startDate: Date; endDate: Date };
type ChannelOrSubIdAggTemp = { commission: number; orderIds: Set<string> };
type ProductAgg = { commission: number; qty: number };
type CategoryL1Agg = { commission: number };

interface CategoryMapNode {
  commission: number;
  orderIds: Set<string>;
  children: Map<string, CategoryMapNode>;
}

// Normaliza valores monetários pt-BR (ex.: "R$ 1.234,56" -> 1234.56) e preserva formatos já com ponto decimal
export function parseMoneyPt(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  const cleaned = s
    .replace(/\s/g, "")
    .replace(/[R$\u00A0]/g, "")
    .replace(/[%]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

const emptyTemporalAgg = (): TemporalAggTemp => ({
  orderIds: new Set(),
  concluidos: new Set(),
  pendentes: new Set(),
  cancelados: new Set(),
  nao_pagos: new Set(),
});

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
};

const localYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const localYM = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

type CanonicalStatus = "completed" | "pending" | "canceled" | "unpaid" | "unknown";

function stripDiacritics(s: string) {
  // remove acentos (ex.: "Concluído" -> "Concluido")
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Normaliza status (CSV e API) para um conjunto canônico interno
function normalizeStatus(raw: string | undefined): CanonicalStatus {
  const s = stripDiacritics(String(raw ?? "")).toLowerCase().trim();
  if (!s) return "unknown";

  // Completed
  if (s === "completed" || s === "concluido" || s === "concluida") return "completed";

  // Pending
  if (s === "pending" || s === "pendente") return "pending";

  // Canceled (API às vezes vem "cancelled")
  if (s === "canceled" || s === "cancelled" || s === "cancelado" || s === "cancelada")
    return "canceled";

  // Unpaid
  if (s === "unpaid" || s === "nao pago" || s === "nao_pago" || s === "nao-pago") return "unpaid";

  return "unknown";
}

// Whitelist: apenas statuses conhecidos como "receita real" somam comissão e vendas.
const isEarning = (status: CanonicalStatus) => status === "completed" || status === "pending";

type CanonicalAttribution = "direct" | "indirect" | "unknown";

// Normaliza "Tipo de atribuição" (CSV) para direta vs indireta
function normalizeAttribution(raw: unknown): CanonicalAttribution {
  const s = stripDiacritics(String(raw ?? "")).toLowerCase().trim();
  if (!s) return "unknown";

  // Mapeamento exato pro seu CSV
  // - "Pedido na mesma loja" => direct
  // - "Pedido em loja diferente" => indirect
  if (s.includes("loja diferente")) return "indirect";
  if (s.includes("mesma loja")) return "direct";

  // Se Shopee mudar e vier explícito (direta/indireta)
  if (s.includes("indiret")) return "indirect";
  if (s.includes("diret")) return "direct";

  // Outros padrões possíveis (caso apareçam futuramente)
  if (s.includes("produto diferente") || s.includes("item diferente")) return "indirect";
  if (s.includes("mesmo produto") || s.includes("mesmo item")) return "direct";

  return "unknown";
}

export type CommissionAnalytics = {
  totalCommission: number;
  totalSales: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  canceledOrders: number;
  unpaidOrders: number;
  minDate: Date | null;
  maxDate: Date | null;
  ordersByHour: TemporalChartData[];
  ordersByDay: Record<string, TemporalAggTemp>;
  ordersByWeek: TemporalChartData[];
  ordersByMonth: TemporalChartData[];
  channelData: ChannelData[];
  subIdData: SubIdData[];
  productData: ProductData[];
  topCategoriesData: TopCategoryData[];
  categoryTreeData: CategoryNode[];
  attributionData: AttributionData | null;
};

export function buildCommissionAnalytics(rows: CommissionDataRow[]): CommissionAnalytics {
  if (!rows || rows.length === 0) {
    return {
      totalCommission: 0,
      totalSales: 0,
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      canceledOrders: 0,
      unpaidOrders: 0,
      minDate: null,
      maxDate: null,
      ordersByHour: [],
      ordersByDay: {},
      ordersByWeek: [],
      ordersByMonth: [],
      channelData: [],
      subIdData: [],
      productData: [],
      topCategoriesData: [],
      categoryTreeData: [],
      attributionData: null,
    };
  }

  let commissionSum = 0;
  let salesSum = 0;

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  const orderIds = new Set<string>();
  const completedOrderIds = new Set<string>();
  const pendingOrderIds = new Set<string>();
  const canceledOrderIds = new Set<string>();
  const unpaidOrderIds = new Set<string>();

  const hourlyAgg: Record<string, TemporalAggTemp> = {};
  const dailyAgg: Record<string, TemporalAggTemp> = {};
  const weeklyAgg: Record<string, WeeklyAggTemp> = {};
  const monthlyAgg: Record<string, TemporalAggTemp> = {};

  // IMPORTANTE: agora essas agregações só acumulam se for "earning"
  const channelAgg: Record<string, ChannelOrSubIdAggTemp> = {};
  const subIdAgg: Record<string, ChannelOrSubIdAggTemp> = {};
  const productAgg: Record<string, ProductAgg> = {};
  const categoryL1Agg: Record<string, CategoryL1Agg> = {};
  const categoryTreeAgg = new Map<string, CategoryMapNode>();

  // attribution: só earning
  const direct = { commission: 0, orderIds: new Set<string>() };
  const indirect = { commission: 0, orderIds: new Set<string>() };

  rows.forEach((row) => {
    const orderId = row["ID do pedido"];
    if (orderId) orderIds.add(orderId);

    const status = normalizeStatus(row["Status do Pedido"]);
    const earning = isEarning(status);

    const commission = parseMoneyPt(row["Comissão líquida do afiliado(R$)"]);
    const saleValue = parseMoneyPt(row["Valor de Compra(R$)"]);

    if (earning) {
      commissionSum += commission;
      salesSum += saleValue;
    }

    if (orderId) {
      switch (status) {
        case "completed":
          completedOrderIds.add(orderId);
          break;
        case "pending":
          pendingOrderIds.add(orderId);
          break;
        case "canceled":
          canceledOrderIds.add(orderId);
          break;
        case "unpaid":
          unpaidOrderIds.add(orderId);
          break;
      }
    }

    // Agregações temporais (gráficos) continuam contando pedidos por status (inclui cancelado/não pago)
    const orderTimeStr = row["Horário do pedido"];
    if (orderTimeStr && orderId) {
      try {
        const orderDate = new Date(orderTimeStr);
        if (!Number.isNaN(orderDate.getTime())) {
          const hourKey = `${String(orderDate.getHours()).padStart(2, "0")}h`;

          if (!hourlyAgg[hourKey]) hourlyAgg[hourKey] = emptyTemporalAgg();
          hourlyAgg[hourKey].orderIds.add(orderId);

          const startOfWeek = getStartOfWeek(orderDate);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const weekKey = localYMD(startOfWeek);

          if (!weeklyAgg[weekKey]) {
            weeklyAgg[weekKey] = { ...emptyTemporalAgg(), startDate: startOfWeek, endDate: endOfWeek };
          }
          weeklyAgg[weekKey].orderIds.add(orderId);

          const dayKey = localYMD(orderDate);
          if (!dailyAgg[dayKey]) dailyAgg[dayKey] = emptyTemporalAgg();
          dailyAgg[dayKey].orderIds.add(orderId);

          const monthKey = localYM(new Date(orderDate.getFullYear(), orderDate.getMonth(), 1));
          if (!monthlyAgg[monthKey]) monthlyAgg[monthKey] = emptyTemporalAgg();
          monthlyAgg[monthKey].orderIds.add(orderId);

          switch (status) {
            case "completed":
              hourlyAgg[hourKey].concluidos.add(orderId);
              weeklyAgg[weekKey].concluidos.add(orderId);
              dailyAgg[dayKey].concluidos.add(orderId);
              monthlyAgg[monthKey].concluidos.add(orderId);
              break;
            case "pending":
              hourlyAgg[hourKey].pendentes.add(orderId);
              weeklyAgg[weekKey].pendentes.add(orderId);
              dailyAgg[dayKey].pendentes.add(orderId);
              monthlyAgg[monthKey].pendentes.add(orderId);
              break;
            case "canceled":
              hourlyAgg[hourKey].cancelados.add(orderId);
              weeklyAgg[weekKey].cancelados.add(orderId);
              dailyAgg[dayKey].cancelados.add(orderId);
              monthlyAgg[monthKey].cancelados.add(orderId);
              break;
            case "unpaid":
              hourlyAgg[hourKey].nao_pagos.add(orderId);
              weeklyAgg[weekKey].nao_pagos.add(orderId);
              dailyAgg[dayKey].nao_pagos.add(orderId);
              monthlyAgg[monthKey].nao_pagos.add(orderId);
              break;
          }

          if (!minDate || orderDate < minDate) minDate = orderDate;
          if (!maxDate || orderDate > maxDate) maxDate = orderDate;
        }
      } catch {
        // ignore
      }
    }

    // Quebras por Canal/SubId/Produto/Categoria: SOMENTE earning
    if (!earning) return;

    const channel = row["Canal"] || "N/A";
    const subId = row["Sub_id1"] || "Sem Sub ID";
    const productName = row["Nome do Item"] || "Produto Desconhecido";
    const qty = Number.parseInt(row["Qtd"] || "0", 10);
    const safeQty = Number.isFinite(qty) ? qty : 0;

    if (!channelAgg[channel]) channelAgg[channel] = { commission: 0, orderIds: new Set() };
    channelAgg[channel].commission += commission;
    if (orderId) channelAgg[channel].orderIds.add(orderId);

    if (!subIdAgg[subId]) subIdAgg[subId] = { commission: 0, orderIds: new Set() };
    subIdAgg[subId].commission += commission;
    if (orderId) subIdAgg[subId].orderIds.add(orderId);

    if (!productAgg[productName]) productAgg[productName] = { commission: 0, qty: 0 };
    productAgg[productName].commission += commission;
    productAgg[productName].qty += safeQty;

    const categoryL1 = row["Categoria Global L1"] || "Sem Categoria";
    const categoryL2 = row["Categoria Global L2"] || "N/A";
    const categoryL3 = row["Categoria Global L3"] || "N/A";

    if (!categoryL1Agg[categoryL1]) categoryL1Agg[categoryL1] = { commission: 0 };
    categoryL1Agg[categoryL1].commission += commission;

    if (!categoryTreeAgg.has(categoryL1)) {
      categoryTreeAgg.set(categoryL1, { commission: 0, orderIds: new Set(), children: new Map() });
    }
    const l1Node = categoryTreeAgg.get(categoryL1)!;
    l1Node.commission += commission;
    if (orderId) l1Node.orderIds.add(orderId);

    if (!l1Node.children.has(categoryL2)) {
      l1Node.children.set(categoryL2, { commission: 0, orderIds: new Set(), children: new Map() });
    }
    const l2Node = l1Node.children.get(categoryL2)!;
    l2Node.commission += commission;
    if (orderId) l2Node.orderIds.add(orderId);

    if (!l2Node.children.has(categoryL3)) {
      l2Node.children.set(categoryL3, { commission: 0, orderIds: new Set(), children: new Map() });
    }
    const l3Node = l2Node.children.get(categoryL3)!;
    l3Node.commission += commission;
    if (orderId) l3Node.orderIds.add(orderId);

    // Attribution (somente earning)
    const attributionKind = normalizeAttribution(row["Tipo de atribuição"]);
    if (attributionKind === "direct") {
      direct.commission += commission;
      if (orderId) direct.orderIds.add(orderId);
    } else if (attributionKind === "indirect") {
      indirect.commission += commission;
      if (orderId) indirect.orderIds.add(orderId);
    }
  });

  const ordersByHour: TemporalChartData[] = Array.from({ length: 24 }).map((_, i) => {
    const hourKey = `${String(i).padStart(2, "0")}h`;
    const agg = hourlyAgg[hourKey];
    return agg
      ? {
          label: hourKey,
          pedidos: agg.orderIds.size,
          concluidos: agg.concluidos.size,
          pendentes: agg.pendentes.size,
          cancelados: agg.cancelados.size,
          nao_pagos: agg.nao_pagos.size,
        }
      : { label: hourKey, pedidos: 0, concluidos: 0, pendentes: 0, cancelados: 0, nao_pagos: 0 };
  });

  const ordersByWeek: TemporalChartData[] = Object.values(weeklyAgg)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((w) => ({
      label: `${w.startDate.toLocaleDateString("pt-BR", { day: "2-digit" })}/${w.startDate.toLocaleDateString(
        "pt-BR",
        { month: "2-digit" }
      )}`,
      pedidos: w.orderIds.size,
      concluidos: w.concluidos.size,
      pendentes: w.pendentes.size,
      cancelados: w.cancelados.size,
      nao_pagos: w.nao_pagos.size,
      startDate: w.startDate,
      endDate: w.endDate,
    }));

  const ordersByMonth: TemporalChartData[] = Object.entries(monthlyAgg)
    .sort(([a], [b]) => new Date(`${a}-01T00:00:00`).getTime() - new Date(`${b}-01T00:00:00`).getTime())
    .map(([key, value]) => ({
      label: new Date(`${key}-01T00:00:00`)
        .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(". de", "/")
        .replace(".", ""),
      pedidos: value.orderIds.size,
      concluidos: value.concluidos.size,
      pendentes: value.pendentes.size,
      cancelados: value.cancelados.size,
      nao_pagos: value.nao_pagos.size,
    }));

  const processAndSortWithSets = <T extends ChannelOrSubIdAggTemp>(
    agg: Record<string, T>,
    keyName: "channel" | "subId"
  ) =>
    Object.entries(agg)
      .map(([key, value]) => ({
        [keyName]: key,
        commission: value.commission,
        orders: value.orderIds.size,
      }))
      .sort((a, b) => b.commission - a.commission);

  const channelData = processAndSortWithSets(channelAgg, "channel") as unknown as ChannelData[];
  const subIdData = processAndSortWithSets(subIdAgg, "subId") as unknown as SubIdData[];

  const productData = Object.entries(productAgg)
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.qty - a.qty) as unknown as ProductData[];

  const topCategoriesData: TopCategoryData[] = Object.entries(categoryL1Agg)
    .map(([category, { commission }]) => ({ category, commission }))
    .sort((a, b) => b.commission - a.commission)
    .slice(0, 5) as TopCategoryData[];

  const convertMapToTree = (map: Map<string, CategoryMapNode>): CategoryNode[] =>
    Array.from(map.entries())
      .map(([name, data]) => {
        const node: CategoryNode = {
          name,
          totalCommission: data.commission,
          totalOrders: data.orderIds.size,
        };
        if (data.children && data.children.size > 0) node.children = convertMapToTree(data.children);
        return node;
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);

  const categoryTreeData = convertMapToTree(categoryTreeAgg);

  const attributionData: AttributionData = {
    direct: { commission: direct.commission, orders: direct.orderIds.size },
    indirect: { commission: indirect.commission, orders: indirect.orderIds.size },
  };

  return {
    totalCommission: commissionSum,
    totalSales: salesSum,
    totalOrders: orderIds.size,
    completedOrders: completedOrderIds.size,
    pendingOrders: pendingOrderIds.size,
    canceledOrders: canceledOrderIds.size,
    unpaidOrders: unpaidOrderIds.size,
    minDate,
    maxDate,
    ordersByHour,
    ordersByDay: dailyAgg,
    ordersByWeek,
    ordersByMonth,
    channelData,
    subIdData,
    productData,
    topCategoriesData,
    categoryTreeData,
    attributionData,
  };
}

export function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
