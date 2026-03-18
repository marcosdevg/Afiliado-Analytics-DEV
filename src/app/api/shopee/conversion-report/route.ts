import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

type CommissionDataRow = {
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
};

const SHOPEE_GQL = "https://open-api.affiliate.shopee.com.br/graphql";

function toUnixSeconds(dateStr: string, endOfDay = false) {
  const iso = endOfDay ? `${dateStr}T23:59:59-03:00` : `${dateStr}T00:00:00-03:00`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

function buildAuthorization(appId: string, secret: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureRaw = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash("sha256").update(signatureRaw).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

type ShopeeGqlError = { message?: string };

type ShopeeItem = {
  itemName?: unknown;
  qty?: unknown;
  itemPrice?: unknown;
  actualAmount?: unknown;
  itemTotalCommission?: unknown;
  attributionType?: unknown;
  globalCategoryLv1Name?: unknown;
  globalCategoryLv2Name?: unknown;
  globalCategoryLv3Name?: unknown;
};

type ShopeeOrder = {
  orderId?: unknown;
  orderStatus?: unknown;
  items?: unknown;
};

type ShopeeNode = {
  purchaseTime?: unknown;
  device?: unknown;
  utmContent?: unknown;
  referrer?: unknown;
  orders?: unknown;
  subId1?: unknown;
  subId2?: unknown;
  subId3?: unknown;
};

type ShopeePageInfo = {
  hasNextPage?: unknown;
  scrollId?: unknown;
};

type ShopeeGqlResponse = {
  data?: {
    conversionReport?: { nodes?: unknown; pageInfo?: unknown };
  };
  errors?: ShopeeGqlError[];
};

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function safeNumber(v: unknown) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function mapAttributionType(raw: string): "Direta" | "Indireta" | "Desconhecido" {
  if (!raw) return "Desconhecido";
  const s = String(raw).toUpperCase();
  if (s.includes("ORDERED_IN_SAME_SHOP")) return "Direta";
  if (s.includes("ORDERED_IN_DIFFERENT_SHOP")) return "Indireta";
  if (s.includes("DIRECT")) return "Direta";
  if (s.includes("INDIRECT")) return "Indireta";
  return "Desconhecido";
}

function safeString(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function parseUtmContent(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => safeString(x).trim())
      .filter(Boolean)
      .filter((s) => s !== "----");
  }

  const raw = safeString(value).trim();
  if (!raw || raw === "----") return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((x) => safeString(x).trim())
          .filter(Boolean)
          .filter((s) => s !== "----");
      }
    } catch {
      /* ignore */
    }
  }

  if (raw.includes("----")) {
    return raw
      .split("----")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((s) => s !== "----");
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((s) => s !== "----");
  }

  return [raw].filter((s) => s !== "----");
}

/** Chave principal para cruzar com Sub ID 1 do gerador (API ou utm). */
function primaryTrackKey(n: ShopeeNode): string {
  for (const k of [n.subId1, n.subId2, n.subId3]) {
    const v = safeString(k).trim();
    if (v && v !== "----") return v;
  }
  const utm = parseUtmContent(n.utmContent);
  if (utm.length > 0) return utm[0];
  return "Sem Sub ID";
}

async function shopeeFetch(appId: string, secret: string, query: string): Promise<ShopeeGqlResponse> {
  const payload = JSON.stringify({ query });
  const Authorization = buildAuthorization(appId, secret, payload);

  const res = await fetch(SHOPEE_GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization },
    body: payload,
  });

  const json = (await res.json()) as ShopeeGqlResponse;
  if (!res.ok || json?.errors) {
    const msg = json?.errors?.[0]?.message ?? `Shopee error (${res.status})`;
    throw new Error(msg);
  }
  return json;
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
      .select("shopee_app_id, shopee_api_key")
      .eq("id", user.id)
      .single();

    const appId = profile?.shopee_app_id?.trim();
    const secret = profile?.shopee_api_key?.trim();

    if (!appId || !secret) {
      return NextResponse.json({ error: "Chaves da Shopee não configuradas" }, { status: 400 });
    }

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start e end são obrigatórios (YYYY-MM-DD)" }, { status: 400 });
    }

    const purchaseTimeStart = toUnixSeconds(start, false);
    const purchaseTimeEnd = toUnixSeconds(end, true);

    let useSubFields = true;
    try {
      const probe = `
        query {
          conversionReport(purchaseTimeStart: ${purchaseTimeStart}, purchaseTimeEnd: ${purchaseTimeEnd}, limit: 1) {
            nodes { subId1 utmContent purchaseTime orders { orderId orderStatus items { itemName } } }
            pageInfo { hasNextPage scrollId }
          }
        }
      `;
      await shopeeFetch(appId, secret, probe);
    } catch {
      useSubFields = false;
    }

    const nodeFields = useSubFields
      ? `purchaseTime device utmContent referrer subId1 subId2 subId3`
      : `purchaseTime device utmContent referrer`;

    const rows: CommissionDataRow[] = [];
    let scrollId: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const scrollArg = scrollId ? `, scrollId: "${scrollId}"` : "";

      const query = `
        query {
          conversionReport(
            purchaseTimeStart: ${purchaseTimeStart},
            purchaseTimeEnd: ${purchaseTimeEnd},
            limit: 50
            ${scrollArg}
          ) {
            nodes {
              ${nodeFields}
              orders {
                orderId
                orderStatus
                items {
                  itemName
                  qty
                  itemPrice
                  actualAmount
                  itemTotalCommission
                  attributionType
                  globalCategoryLv1Name
                  globalCategoryLv2Name
                  globalCategoryLv3Name
                }
              }
            }
            pageInfo { hasNextPage scrollId }
          }
        }
      `;

      const json = await shopeeFetch(appId, secret, query);

      const conn = json?.data?.conversionReport;
      const nodesUnknown = conn?.nodes;
      const pageInfoObj = (conn?.pageInfo ?? {}) as ShopeePageInfo;

      for (const n of asArray<ShopeeNode>(nodesUnknown)) {
        const purchaseIso =
          typeof n.purchaseTime === "number"
            ? new Date(n.purchaseTime * 1000).toISOString()
            : String(n.purchaseTime ?? "");

        const trackKey = primaryTrackKey(n);
        const sub1 = trackKey;

        const referrer = safeString(n.referrer).trim();
        const device = safeString(n.device).trim();
        const canal = referrer || device || "API";

        for (const o of asArray<ShopeeOrder>(n.orders)) {
          const orderId = String(o.orderId ?? "");
          const orderStatus = String(o.orderStatus ?? "").toLowerCase().trim();

          for (const it of asArray<ShopeeItem>(o.items)) {
            const qty = safeNumber(it.qty ?? 0);
            const itemPrice = safeNumber(it.itemPrice ?? 0);
            const actualAmount = safeNumber(it.actualAmount);

            let saleValue = Number.isFinite(actualAmount) && actualAmount > 0 ? actualAmount : itemPrice;

            const isCancelled = orderStatus === "cancelled";
            if (isCancelled || (Number.isFinite(qty) && qty <= 0)) saleValue = 0;

            let commission = safeNumber(it.itemTotalCommission ?? 0);
            if (isCancelled) commission = 0;

            const attributionLabel = mapAttributionType(safeString(it.attributionType));

            const g1 = String(it.globalCategoryLv1Name ?? "").trim();
            const g2 = String(it.globalCategoryLv2Name ?? "").trim();
            const g3 = String(it.globalCategoryLv3Name ?? "").trim();

            rows.push({
              "ID do pedido": orderId,
              "Comissão líquida do afiliado(R$)": String(Number.isFinite(commission) ? commission : 0),
              "Valor de Compra(R$)": String(Number.isFinite(saleValue) ? saleValue : 0),
              "Status do Pedido": orderStatus,
              "Horário do pedido": purchaseIso,
              Canal: canal,
              Sub_id1: sub1,
              "Nome do Item": String(it.itemName ?? "Produto Desconhecido"),
              Qtd: String(Number.isFinite(qty) ? qty : 0),
              "Categoria Global L1": g1 || "Sem Categoria",
              "Categoria Global L2": g2 || "N/A",
              "Categoria Global L3": g3 || "N/A",
              "Tipo de atribuição": attributionLabel,
            });
          }
        }
      }

      hasNextPage = !!pageInfoObj.hasNextPage;
      scrollId = (pageInfoObj.scrollId ?? null) as string | null;

      if (!hasNextPage) break;
      if (!scrollId) break;
    }

    return NextResponse.json({ data: rows, _subFieldsFromApi: useSubFields });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
