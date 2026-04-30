/**
 * Cron Telegram: dispara automações ativas com janela válida.
 * Mesmo padrão do cron WhatsApp (`/api/grupos-venda/cron-disparo`), mas:
 *   - lê de telegram_grupos_venda_continuo
 *   - resolve grupos via telegram_grupos_venda
 *   - envia direto via Telegram Bot API (sendPayloadToChats), sem n8n
 *
 * Modos suportados:
 *   - Keywords (Shopee API ao vivo)
 *   - Lista de ofertas Shopee (`minha_lista_ofertas`)
 *   - Lista de ofertas Mercado Livre (`minha_lista_ofertas_ml`)
 *   - Lista Infoprodutor (`minha_lista_ofertas_info`)
 *
 * Auth:
 *   - GET (Vercel cron): exige `Authorization: Bearer ${CRON_SECRET}` em produção.
 *   - POST (teste manual no painel): exige usuário logado; aceita opcionalmente
 *     { configId } pra testar uma única automação.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "utils/supabase/server";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { sendPayloadToChats } from "@/lib/telegram/send";
import {
  buildInfoprodutorMessage,
  buildListaOfferMessage,
  buildShopeeKeywordMessage,
} from "@/lib/telegram/messages";
import {
  generateShopeeAffiliateLink,
  pickProductFromPool,
  searchShopeeProducts,
} from "@/lib/telegram/shopee-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

/** Verifica se o horário atual em Brasília (UTC-3) está dentro da janela. */
function isWithinBrasiliaWindow(horarioInicio: string | null, horarioFim: string | null): boolean {
  if (!horarioInicio || !horarioFim) return true;
  const now = new Date();
  const brasiliaMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() - 180 + 1440) % 1440;
  const [startH, startM] = horarioInicio.split(":").map(Number);
  const [endH, endM] = horarioFim.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes <= endMinutes) {
    return brasiliaMinutes >= startMinutes && brasiliaMinutes <= endMinutes;
  }
  return brasiliaMinutes >= startMinutes || brasiliaMinutes <= endMinutes;
}

type CronResultEntry = {
  userId: string;
  keyword?: string;
  ok: boolean;
  sent?: number;
  failed?: number;
  error?: string;
};

type CronResultBody =
  | { ok: true; processed: 0; message: string }
  | { ok: true; processed: number; results: CronResultEntry[] };

type CronRunOptions = {
  manualUserId?: string | null;
  skipWindowCheck?: boolean;
  singleConfigId?: string | null;
};

async function runCronDisparoTelegram(opts?: CronRunOptions): Promise<CronResultBody> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sel =
    "id, user_id, bot_id, lista_id, lista_ofertas_id, lista_ofertas_ml_id, lista_ofertas_info_id, keywords, sub_id_1, sub_id_2, sub_id_3, proximo_indice, keyword_pool_indices, horario_inicio, horario_fim";

  let configQuery = supabase.from("telegram_grupos_venda_continuo").select(sel);
  if (opts?.singleConfigId && opts.manualUserId) {
    configQuery = configQuery.eq("id", opts.singleConfigId).eq("user_id", opts.manualUserId);
  } else {
    configQuery = configQuery.eq("ativo", true);
    if (opts?.manualUserId) configQuery = configQuery.eq("user_id", opts.manualUserId);
  }

  const { data: configs, error: configError } = await configQuery;

  if (configError) return { ok: true, processed: 0, message: configError.message };
  if (!configs?.length) {
    if (opts?.singleConfigId) {
      return { ok: true, processed: 0, message: "Automação não encontrada ou sem permissão." };
    }
    return { ok: true, processed: 0, message: "Nenhum disparo ativo" };
  }

  const results: CronResultEntry[] = [];

  for (const cfg of configs as Array<{
    id: string;
    user_id: string;
    bot_id: string;
    lista_id: string | null;
    lista_ofertas_id: string | null;
    lista_ofertas_ml_id: string | null;
    lista_ofertas_info_id: string | null;
    keywords: string[];
    sub_id_1: string;
    sub_id_2: string;
    sub_id_3: string;
    proximo_indice: number;
    keyword_pool_indices: unknown;
    horario_inicio: string | null;
    horario_fim: string | null;
  }>) {
    const userId = cfg.user_id;
    const botId = cfg.bot_id;
    const listaId = cfg.lista_id;
    const listaOfertasId = cfg.lista_ofertas_id;
    const listaOfertasMlId = cfg.lista_ofertas_ml_id;
    const listaOfertasInfoId = cfg.lista_ofertas_info_id;
    const keywords = Array.isArray(cfg.keywords) ? cfg.keywords : [];
    const proximoIndice = Number(cfg.proximo_indice) || 0;
    const subIds = [cfg.sub_id_1, cfg.sub_id_2, cfg.sub_id_3].filter(Boolean);
    const horarioInicio = cfg.horario_inicio;
    const horarioFim = cfg.horario_fim;

    // Janela horária obrigatória
    if (!horarioInicio?.trim() || !horarioFim?.trim()) {
      results.push({ userId, ok: true, error: "Sem janela — configure início e fim no app (máx. 14 h)" });
      continue;
    }
    const janelaInv = mensagemErroJanela(horarioInicio, horarioFim);
    if (janelaInv) {
      results.push({ userId, ok: true, error: janelaInv });
      continue;
    }
    if (!opts?.skipWindowCheck && !isWithinBrasiliaWindow(horarioInicio, horarioFim)) {
      results.push({ userId, ok: true, error: "Fora do horário configurado" });
      continue;
    }

    const isListaOfertasMode = !!listaOfertasId || !!listaOfertasMlId;
    const isListaInfoMode = !!listaOfertasInfoId;
    if (!isListaOfertasMode && !isListaInfoMode && keywords.length === 0) {
      results.push({ userId, ok: false, error: "Sem keywords" });
      continue;
    }

    try {
      // Resolve bot (token + ativo)
      const { data: bot } = await supabase
        .from("telegram_bots")
        .select("bot_token, ativo")
        .eq("id", botId)
        .single();
      const botRow = bot as { bot_token?: string; ativo?: boolean } | null;
      if (!botRow?.bot_token) {
        results.push({ userId, ok: false, error: "Bot não encontrado" });
        continue;
      }
      if (!botRow.ativo) {
        results.push({ userId, ok: false, error: "Bot desativado" });
        continue;
      }
      const botToken = botRow.bot_token;

      // Resolve grupos da lista (Telegram requer lista_id sempre — o continuo POST exige)
      const { data: groups } = listaId
        ? await supabase.from("telegram_grupos_venda").select("chat_id").eq("lista_id", listaId)
        : { data: [] as { chat_id: string }[] };
      const chatIds = (groups ?? []).map((g: { chat_id: string }) => g.chat_id);
      if (chatIds.length === 0) {
        results.push({ userId, ok: false, error: "Nenhum grupo na lista" });
        continue;
      }

      // ── Modo Infoprodutor ────────────────────────────────────────────────────
      if (isListaInfoMode) {
        type InfoRow = {
          product_name: string;
          description: string | null;
          image_url: string | null;
          link: string;
          price: number | string | null;
          price_old: number | string | null;
        };
        const { data: itensInfo } = await supabase
          .from("minha_lista_ofertas_info")
          .select("id, product_name, description, image_url, link, price, price_old")
          .eq("lista_id", listaOfertasInfoId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        const infoItems = (itensInfo ?? []) as InfoRow[];
        if (infoItems.length === 0) {
          results.push({ userId, ok: false, error: "Lista Infoprodutor vazia" });
          continue;
        }
        const idx = proximoIndice % infoItems.length;
        const nextIndex = (proximoIndice + 1) % infoItems.length;
        const item = infoItems[idx];
        const link = item.link?.trim() || "";
        if (!link) {
          results.push({ userId, ok: false, error: "Produto sem link" });
          await supabase
            .from("telegram_grupos_venda_continuo")
            .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
            .eq("id", cfg.id);
          continue;
        }
        const preco =
          item.price == null || item.price === "" ? null : Number.isFinite(Number(item.price)) ? Number(item.price) : null;
        const precoAntigo =
          item.price_old == null || item.price_old === ""
            ? null
            : Number.isFinite(Number(item.price_old))
              ? Number(item.price_old)
              : null;

        const text = buildInfoprodutorMessage({
          nomeProduto: item.product_name ?? "",
          descricaoLivre: item.description ?? "",
          link,
          preco,
          precoAntigo,
        });
        const sendResults = await sendPayloadToChats(botToken, chatIds, {
          text,
          imageUrl: item.image_url?.trim() || undefined,
        });
        const sent = sendResults.filter((r) => r.ok).length;
        const failed = sendResults.length - sent;
        results.push({
          userId,
          keyword: (item.product_name ?? "").slice(0, 30),
          ok: sent > 0,
          sent,
          failed,
        });

        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      // ── Modo lista de ofertas Shopee/ML ─────────────────────────────────────
      if (isListaOfertasMode) {
        type ListaRow = {
          product_name: string;
          image_url: string;
          price_original: number | null;
          price_promo: number | null;
          discount_rate: number | null;
          converter_link: string;
        };
        const items: ListaRow[] = [];
        if (listaOfertasId) {
          const { data: itensS } = await supabase
            .from("minha_lista_ofertas")
            .select(
              "id, product_name, image_url, price_original, price_promo, discount_rate, converter_link"
            )
            .eq("lista_id", listaOfertasId)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          items.push(...((itensS ?? []) as ListaRow[]));
        }
        if (listaOfertasMlId) {
          const { data: itensM } = await supabase
            .from("minha_lista_ofertas_ml")
            .select(
              "id, product_name, image_url, price_original, price_promo, discount_rate, converter_link"
            )
            .eq("lista_id", listaOfertasMlId)
            .eq("user_id", userId)
            .order("created_at", { ascending: true });
          items.push(...((itensM ?? []) as ListaRow[]));
        }
        if (items.length === 0) {
          results.push({ userId, ok: false, error: "Lista de ofertas vazia" });
          continue;
        }
        const idx = proximoIndice % items.length;
        const nextIndex = (proximoIndice + 1) % items.length;
        const item = items[idx];
        const linkAfiliado = item.converter_link?.trim() || "";
        if (!linkAfiliado) {
          results.push({ userId, ok: false, error: "Produto sem link" });
          await supabase
            .from("telegram_grupos_venda_continuo")
            .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
            .eq("id", cfg.id);
          continue;
        }
        const nomeProduto = item.product_name ?? "";
        const rate = item.discount_rate ?? 0;
        const precoPorResolved =
          effectiveListaOfferPromoPrice(item.price_original, item.price_promo, item.discount_rate) ??
          item.price_promo ??
          0;
        const precoPor = precoPorResolved || 0;
        const precoRiscado = (item.price_original ?? precoPor) || 0;

        const text = buildListaOfferMessage({
          nomeProduto,
          precoPor,
          precoRiscado,
          discountRate: rate,
          linkAfiliado,
        });
        const sendResults = await sendPayloadToChats(botToken, chatIds, {
          text,
          imageUrl: item.image_url?.trim() || undefined,
        });
        const sent = sendResults.filter((r) => r.ok).length;
        const failed = sendResults.length - sent;
        results.push({
          userId,
          keyword: nomeProduto.slice(0, 30),
          ok: sent > 0,
          sent,
          failed,
        });

        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      // ── Modo keywords (Shopee API ao vivo) ──────────────────────────────────
      const keyword = keywords[proximoIndice % keywords.length];
      const nextIndex = (proximoIndice + 1) % keywords.length;

      const { data: profile } = await supabase
        .from("profiles")
        .select("shopee_app_id, shopee_api_key")
        .eq("id", userId)
        .single();
      const appId = (profile as { shopee_app_id?: string } | null)?.shopee_app_id?.trim();
      const secret = (profile as { shopee_api_key?: string } | null)?.shopee_api_key?.trim();
      if (!appId || !secret) {
        results.push({ userId, keyword, ok: false, error: "Shopee não configurado" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      const nodes = await searchShopeeProducts(appId, secret, keyword, 30);

      const rawIndices = cfg.keyword_pool_indices;
      const keywordPoolIndices: Record<string, number> =
        rawIndices && typeof rawIndices === "object" && !Array.isArray(rawIndices)
          ? (rawIndices as Record<string, number>)
          : {};
      const n = Number.isFinite(keywordPoolIndices[keyword]) ? keywordPoolIndices[keyword]! : 0;
      const { product, poolSize } = pickProductFromPool(nodes, n);
      if (!product || poolSize === 0) {
        results.push({ userId, keyword, ok: false, error: "Nenhum produto encontrado" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }
      const originUrl = product.productLink || product.offerLink || "";
      if (!originUrl) {
        results.push({ userId, keyword, ok: false, error: "Produto sem URL" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({
            proximo_indice: nextIndex,
            ultimo_disparo_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cfg.id);
        continue;
      }

      const linkAfiliado = await generateShopeeAffiliateLink(appId, secret, originUrl, subIds);
      if (!linkAfiliado) {
        results.push({ userId, keyword, ok: false, error: "Falha ao gerar link" });
        await supabase
          .from("telegram_grupos_venda_continuo")
          .update({ proximo_indice: nextIndex, updated_at: new Date().toISOString() })
          .eq("id", cfg.id);
        continue;
      }

      const priceMin = product.priceMin ?? 0;
      const priceMax = product.priceMax ?? 0;
      const rate = product.priceDiscountRate ?? 0;
      const precoPor = priceMin || priceMax;
      const precoRiscado =
        rate > 0 && rate < 100 && priceMin > 0
          ? Math.round((priceMin / (1 - rate / 100)) * 100) / 100
          : priceMax || 0;

      const text = buildShopeeKeywordMessage({
        nomeProduto: product.productName ?? "",
        precoPor,
        precoRiscado,
        discountRate: rate,
        linkAfiliado,
      });
      const sendResults = await sendPayloadToChats(botToken, chatIds, {
        text,
        imageUrl: product.imageUrl?.trim() || undefined,
      });
      const sent = sendResults.filter((r) => r.ok).length;
      const failed = sendResults.length - sent;
      results.push({ userId, keyword, ok: sent > 0, sent, failed });

      // Avança índices: keyword_pool_indices só avança se mandou OK
      const nextKeywordPoolIndices = sent > 0 ? { ...keywordPoolIndices, [keyword]: n + 1 } : keywordPoolIndices;
      await supabase
        .from("telegram_grupos_venda_continuo")
        .update({
          proximo_indice: nextIndex,
          ...(sent > 0 ? { keyword_pool_indices: nextKeywordPoolIndices } : {}),
          ultimo_disparo_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cfg.id);
    } catch (e) {
      results.push({ userId, ok: false, error: e instanceof Error ? e.message : "Erro" });
    }
  }

  return { ok: true, processed: configs.length, results };
}

/**
 * Cron Vercel — exige Bearer CRON_SECRET em produção.
 */
export async function GET(req: NextRequest) {
  const onVercel = process.env.VERCEL === "1";
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  if (onVercel) {
    if (!cronSecret) {
      return NextResponse.json(
        {
          error:
            "CRON_SECRET não configurado na Vercel. Adicione em Settings → Environment Variables e faça redeploy.",
        },
        { status: 503 }
      );
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const body = await runCronDisparoTelegram();
  return NextResponse.json(body);
}

/**
 * Teste manual — exige usuário logado. Aceita { configId } pra testar uma única automação.
 */
export async function POST(req: NextRequest) {
  const supabaseAuth = await createServerClient();
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  const {
    data: { user },
  } = bearer ? await supabaseAuth.auth.getUser(bearer) : await supabaseAuth.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let configId = "";
  try {
    const raw = (await req.json()) as unknown;
    if (raw && typeof raw === "object" && "configId" in raw) {
      const v = (raw as { configId?: unknown }).configId;
      if (typeof v === "string") configId = v.trim();
    }
  } catch {
    /* corpo vazio: teste geral */
  }

  const body = await runCronDisparoTelegram({
    manualUserId: user.id,
    skipWindowCheck: true,
    singleConfigId: configId || null,
  });
  return NextResponse.json(body);
}
