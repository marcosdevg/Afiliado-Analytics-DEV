import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { fetchMlProductMetaForStoredListItem } from "@/lib/mercadolivre/fetch-meta-for-stored-list-item";
import { parseMlExtensionSessionToCookieHeader } from "@/lib/mercadolivre/ml-session-cookie";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { gateMercadoLivre } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Máximo de linhas por POST (o cliente envia vários POSTs em sequência se a lista for maior). */
const MAX_ROWS_PER_REQUEST = 120;

/** Chamadas ML/HTML em paralelo por leva (reduz timeout vs. sequencial). */
const REFRESH_CONCURRENCY = 6;

type MlRow = {
  id: string;
  product_name: string | null;
  image_url: string | null;
  converter_link: string | null;
  product_page_url: string | null;
};

type RowOutcome = { updated: boolean; err?: string };

async function refreshOneMlRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  row: MlRow,
  accessToken: string | null,
  mlCookieHeader: string | null,
): Promise<RowOutcome> {
  const converter = String(row.converter_link ?? "").trim();
  if (!converter) {
    return { updated: false, err: `${row.product_name?.slice(0, 40) || row.id}: sem link de afiliado` };
  }

  const storedPage = String(row.product_page_url ?? "").trim();
  const meta = await fetchMlProductMetaForStoredListItem(
    converter,
    storedPage || null,
    accessToken,
    mlCookieHeader,
  );
  if (!meta) {
    return {
      updated: false,
      err: `${row.product_name?.slice(0, 40) || row.id}: não foi possível obter dados (tente de novo ou salve de novo com a URL do produto + meli.la)`,
    };
  }

  const po = meta.priceOriginal;
  let pp = meta.pricePromo;
  const dr = meta.discountRate;
  const adj = effectiveListaOfferPromoPrice(po, pp, dr);
  if (adj != null) pp = adj;

  const permalink = (meta.permalink ?? "").trim();
  const nextProductPage = permalink || (storedPage && storedPage.length > 0 ? storedPage : "");

  const { error: upErr } = await supabase
    .from("minha_lista_ofertas_ml")
    .update({
      product_name: meta.productName?.trim() || row.product_name || "",
      image_url: meta.imageUrl?.trim() || row.image_url || "",
      price_original: po,
      price_promo: pp,
      discount_rate: dr,
      ...(nextProductPage ? { product_page_url: nextProductPage } : {}),
    })
    .eq("id", row.id)
    .eq("user_id", userId);

  if (upErr) {
    return { updated: false, err: `${row.product_name?.slice(0, 40) || row.id}: ${upErr.message}` };
  }

  return { updated: true };
}

/**
 * POST { itemId?: string, listaId?: string, itemIds?: string[] }
 * Reabre o link de afiliado (meli.la → PDP), busca meta no ML e atualiza nome, imagem e preços.
 * Com listas grandes, o cliente envia itemIds em fatias (vários POSTs).
 */
export async function POST(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const mlCookieHeader =
      parseMlExtensionSessionToCookieHeader(
        String(body?.mlSessionToken ?? body?.ml_session_token ?? "").trim(),
      ) ?? null;

    const itemId = String(body?.itemId ?? body?.item_id ?? "").trim();
    const listaId = String(body?.listaId ?? body?.lista_id ?? "").trim();
    const rawItemIds = body?.itemIds ?? body?.item_ids;
    const itemIdsFilter: string[] = Array.isArray(rawItemIds)
      ? rawItemIds.map((x: unknown) => String(x).trim()).filter(Boolean)
      : [];

    if (!itemId && !listaId) {
      return NextResponse.json({ error: "Informe itemId ou listaId." }, { status: 400 });
    }

    let rows: MlRow[] = [];

    if (itemId) {
      const { data: row, error } = await supabase
        .from("minha_lista_ofertas_ml")
        .select("id, product_name, image_url, converter_link, product_page_url")
        .eq("id", itemId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!row) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      rows = [row as MlRow];
    } else {
      const { data: lista, error: listaErr } = await supabase
        .from("listas_ofertas_ml")
        .select("id")
        .eq("id", listaId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (listaErr) return NextResponse.json({ error: listaErr.message }, { status: 500 });
      if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

      const { data: items, error } = await supabase
        .from("minha_lista_ofertas_ml")
        .select("id, product_name, image_url, converter_link, product_page_url")
        .eq("lista_id", listaId)
        .eq("user_id", user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      rows = (items ?? []) as MlRow[];
      if (itemIdsFilter.length > 0) {
        const want = new Set(itemIdsFilter);
        rows = rows.filter((r) => want.has(r.id));
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ data: { updated: 0, failed: 0, errors: [] as string[] } });
    }

    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Máximo de ${MAX_ROWS_PER_REQUEST} itens por requisição. O app deve enviar em fatias (itemIds).`,
        },
        { status: 400 },
      );
    }

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += REFRESH_CONCURRENCY) {
      const batch = rows.slice(i, i + REFRESH_CONCURRENCY);
      const outcomes = await Promise.all(
        batch.map((row) => refreshOneMlRow(supabase, user.id, row, null, mlCookieHeader)),
      );
      for (const o of outcomes) {
        if (o.updated) updated += 1;
        else {
          failed += 1;
          if (o.err) errors.push(o.err);
        }
      }
    }

    return NextResponse.json({
      data: {
        updated,
        failed,
        errors: errors.slice(0, 12),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
