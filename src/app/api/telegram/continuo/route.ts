/**
 * CRUD de automações contínuas Telegram (espelha grupos_venda_continuo).
 * Janela obrigatória: início/fim HH:MM, duração máxima 14 horas.
 *
 *   GET  /api/telegram/continuo                                    → lista do usuário
 *   POST { listaId, keywords, subId1..3, listaOfertas*Id?,
 *          horarioInicio, horarioFim, ativo }                      → criar
 *   POST { id, updateOnly: true, ...campos }                       → editar mantendo ativo/proximo_indice
 *   POST { id, ativo: false }                                      → pausar (reseta keyword_pool_indices)
 *   DELETE ?id=                                                    → excluir
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";

export const dynamic = "force-dynamic";

type ContinuoRow = {
  id: string;
  lista_id: string | null;
  bot_id: string;
  lista_ofertas_id?: string | null;
  lista_ofertas_ml_id?: string | null;
  lista_ofertas_info_id?: string | null;
  keywords: string[];
  sub_id_1: string;
  sub_id_2: string;
  sub_id_3: string;
  ativo: boolean;
  proximo_indice: number;
  ultimo_disparo_at: string | null;
  updated_at: string;
  horario_inicio: string | null;
  horario_fim: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: rows, error } = await supabase
      .from("telegram_grupos_venda_continuo")
      .select(
        "id, lista_id, bot_id, lista_ofertas_id, lista_ofertas_ml_id, lista_ofertas_info_id, keywords, sub_id_1, sub_id_2, sub_id_3, ativo, proximo_indice, ultimo_disparo_at, updated_at, horario_inicio, horario_fim"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (rows ?? []) as ContinuoRow[];

    // Hidrata nomes auxiliares
    const listaIds = [...new Set(list.map((r) => r.lista_id).filter(Boolean))] as string[];
    const listasMap: Record<string, string> = {};
    if (listaIds.length > 0) {
      const { data: listas } = await supabase
        .from("telegram_listas_grupos_venda")
        .select("id, nome_lista")
        .in("id", listaIds);
      (listas ?? []).forEach((l: { id: string; nome_lista: string }) => {
        listasMap[l.id] = l.nome_lista;
      });
    }
    const botIds = [...new Set(list.map((r) => r.bot_id).filter(Boolean))];
    const botsMap: Record<string, { username: string; name: string }> = {};
    if (botIds.length > 0) {
      const { data: bots } = await supabase
        .from("telegram_bots")
        .select("id, bot_username, bot_name")
        .in("id", botIds);
      (bots ?? []).forEach((b: { id: string; bot_username: string; bot_name: string }) => {
        botsMap[b.id] = { username: b.bot_username, name: b.bot_name };
      });
    }
    const listaOfertasIds = [...new Set(list.map((r) => r.lista_ofertas_id).filter(Boolean))] as string[];
    const listasOfertasMap: Record<string, string> = {};
    if (listaOfertasIds.length > 0) {
      const { data: listasOfertas } = await supabase
        .from("listas_ofertas")
        .select("id, nome")
        .in("id", listaOfertasIds);
      (listasOfertas ?? []).forEach((l: { id: string; nome: string }) => {
        listasOfertasMap[l.id] = l.nome ?? "";
      });
    }
    const listaOfertasMlIds = [...new Set(list.map((r) => r.lista_ofertas_ml_id).filter(Boolean))] as string[];
    const listasOfertasMlMap: Record<string, string> = {};
    if (listaOfertasMlIds.length > 0) {
      const { data: listasMl } = await supabase
        .from("listas_ofertas_ml")
        .select("id, nome")
        .in("id", listaOfertasMlIds);
      (listasMl ?? []).forEach((l: { id: string; nome: string }) => {
        listasOfertasMlMap[l.id] = l.nome ?? "";
      });
    }
    const listaOfertasInfoIds = [...new Set(list.map((r) => r.lista_ofertas_info_id).filter(Boolean))] as string[];
    const listasOfertasInfoMap: Record<string, string> = {};
    if (listaOfertasInfoIds.length > 0) {
      const { data: listasInfo } = await supabase
        .from("listas_ofertas_info")
        .select("id, nome")
        .in("id", listaOfertasInfoIds);
      (listasInfo ?? []).forEach((l: { id: string; nome: string }) => {
        listasOfertasInfoMap[l.id] = l.nome ?? "";
      });
    }

    const data = list.map((r) => {
      const keywords = Array.isArray(r.keywords) ? r.keywords : [];
      const idx = r.proximo_indice ?? 0;
      const bot = botsMap[r.bot_id];
      return {
        id: r.id,
        listaId: r.lista_id,
        listaNome: (r.lista_id && listasMap[r.lista_id]) || "—",
        botId: r.bot_id,
        botUsername: bot?.username ?? null,
        botName: bot?.name ?? null,
        listaOfertasId: r.lista_ofertas_id ?? null,
        listaOfertasNome: (r.lista_ofertas_id && listasOfertasMap[r.lista_ofertas_id]) || null,
        listaOfertasMlId: r.lista_ofertas_ml_id ?? null,
        listaOfertasMlNome: (r.lista_ofertas_ml_id && listasOfertasMlMap[r.lista_ofertas_ml_id]) || null,
        listaOfertasInfoId: r.lista_ofertas_info_id ?? null,
        listaOfertasInfoNome:
          (r.lista_ofertas_info_id && listasOfertasInfoMap[r.lista_ofertas_info_id]) || null,
        keywords,
        subId1: r.sub_id_1 ?? "",
        subId2: r.sub_id_2 ?? "",
        subId3: r.sub_id_3 ?? "",
        ativo: !!r.ativo,
        proximoIndice: idx,
        ultimoDisparoAt: r.ultimo_disparo_at,
        updatedAt: r.updated_at,
        proximaKeyword: keywords.length > 0 ? keywords[idx % keywords.length] : null,
        horarioInicio: r.horario_inicio ?? null,
        horarioFim: r.horario_fim ?? null,
      };
    });

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const updateOnly =
      Boolean(id) && (body.updateOnly === true || body.updateOnly === "true");
    const listaId = typeof body.listaId === "string" ? body.listaId.trim() : "";
    const listaOfertasId =
      typeof body.listaOfertasId === "string" ? body.listaOfertasId.trim() || null : null;
    const listaOfertasMlId =
      typeof body.listaOfertasMlId === "string" ? body.listaOfertasMlId.trim() || null : null;
    const listaOfertasInfoId =
      typeof body.listaOfertasInfoId === "string" ? body.listaOfertasInfoId.trim() || null : null;
    const ativo = body.ativo === true || body.ativo === "true";
    const keywordsRaw = body.keywords;
    const keywords: string[] = Array.isArray(keywordsRaw)
      ? keywordsRaw.map((k: unknown) => String(k).trim()).filter(Boolean)
      : typeof keywordsRaw === "string"
        ? keywordsRaw.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];
    const subId1 = typeof body.subId1 === "string" ? body.subId1.trim() : "";
    const subId2 = typeof body.subId2 === "string" ? body.subId2.trim() : "";
    const subId3 = typeof body.subId3 === "string" ? body.subId3.trim() : "";
    const horarioInicio =
      typeof body.horarioInicio === "string" && body.horarioInicio.trim()
        ? body.horarioInicio.trim()
        : null;
    const horarioFim =
      typeof body.horarioFim === "string" && body.horarioFim.trim() ? body.horarioFim.trim() : null;

    const now = new Date().toISOString();

    // Pausar (ativo=false em automação existente)
    if (!ativo && id && !updateOnly) {
      const { data: updated, error } = await supabase
        .from("telegram_grupos_venda_continuo")
        .update({ ativo: false, keyword_pool_indices: {}, updated_at: now })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, ativo, proximo_indice, ultimo_disparo_at")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        success: true,
        ativo: false,
        id: updated?.id,
        proximoIndice: (updated as { proximo_indice?: number })?.proximo_indice ?? 0,
        ultimoDisparoAt: (updated as { ultimo_disparo_at?: string | null })?.ultimo_disparo_at,
      });
    }

    // Validações de modo
    if (!listaId) {
      return NextResponse.json({ error: "Lista de grupos é obrigatória." }, { status: 400 });
    }
    const isListaShopee = !!listaOfertasId;
    const isListaMl = !!listaOfertasMlId;
    const isListaInfo = !!listaOfertasInfoId;
    const isCrossover = isListaShopee && isListaMl;
    const isListaOfertasMode = isListaShopee || isListaMl || isListaInfo;
    if (!isListaOfertasMode && keywords.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos uma keyword ou selecione uma lista de ofertas." },
        { status: 400 }
      );
    }
    if (isListaInfo) {
      const { data: listaInfo } = await supabase
        .from("listas_ofertas_info")
        .select("id")
        .eq("id", listaOfertasInfoId)
        .eq("user_id", user.id)
        .single();
      if (!listaInfo) {
        return NextResponse.json({ error: "Lista do Infoprodutor não encontrada." }, { status: 404 });
      }
      const { count } = await supabase
        .from("minha_lista_ofertas_info")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasInfoId)
        .eq("user_id", user.id);
      if (!count || count < 1) {
        return NextResponse.json(
          { error: "A lista do Infoprodutor está vazia. Adicione produtos primeiro." },
          { status: 400 }
        );
      }
    } else if (isCrossover) {
      const { data: listaOferta } = await supabase
        .from("listas_ofertas")
        .select("id")
        .eq("id", listaOfertasId)
        .eq("user_id", user.id)
        .single();
      if (!listaOferta) {
        return NextResponse.json({ error: "Lista de ofertas Shopee não encontrada." }, { status: 404 });
      }
      const { count: c1 } = await supabase
        .from("minha_lista_ofertas")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasId)
        .eq("user_id", user.id);
      if (!c1 || c1 < 1) {
        return NextResponse.json({ error: "A lista Shopee está vazia." }, { status: 400 });
      }
      const { data: listaMl } = await supabase
        .from("listas_ofertas_ml")
        .select("id")
        .eq("id", listaOfertasMlId)
        .eq("user_id", user.id)
        .single();
      if (!listaMl) {
        return NextResponse.json({ error: "Lista Mercado Livre não encontrada." }, { status: 404 });
      }
      const { count: c2 } = await supabase
        .from("minha_lista_ofertas_ml")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasMlId)
        .eq("user_id", user.id);
      if (!c2 || c2 < 1) {
        return NextResponse.json({ error: "A lista ML está vazia." }, { status: 400 });
      }
    } else if (isListaShopee) {
      const { data: listaOferta } = await supabase
        .from("listas_ofertas")
        .select("id")
        .eq("id", listaOfertasId)
        .eq("user_id", user.id)
        .single();
      if (!listaOferta) {
        return NextResponse.json({ error: "Lista de ofertas não encontrada." }, { status: 404 });
      }
      const { count } = await supabase
        .from("minha_lista_ofertas")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasId)
        .eq("user_id", user.id);
      if (!count || count < 1) {
        return NextResponse.json(
          { error: "A lista de ofertas está vazia. Adicione produtos à lista primeiro." },
          { status: 400 }
        );
      }
    } else if (isListaMl) {
      const { data: listaMl } = await supabase
        .from("listas_ofertas_ml")
        .select("id")
        .eq("id", listaOfertasMlId)
        .eq("user_id", user.id)
        .single();
      if (!listaMl) {
        return NextResponse.json({ error: "Lista Mercado Livre não encontrada." }, { status: 404 });
      }
      const { count } = await supabase
        .from("minha_lista_ofertas_ml")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasMlId)
        .eq("user_id", user.id);
      if (!count || count < 1) {
        return NextResponse.json(
          { error: "A lista ML está vazia. Adicione produtos primeiro." },
          { status: 400 }
        );
      }
    }

    // Resolve a lista de grupos Telegram → bot_id
    const { data: lista } = await supabase
      .from("telegram_listas_grupos_venda")
      .select("id, bot_id")
      .eq("id", listaId)
      .eq("user_id", user.id)
      .single();
    if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    const bot_id = (lista as { bot_id: string }).bot_id;

    // Confirma que tem grupos vinculados à lista
    const { data: groups } = await supabase
      .from("telegram_grupos_venda")
      .select("chat_id")
      .eq("lista_id", listaId);
    if (!groups?.length) {
      return NextResponse.json(
        { error: "Nenhum grupo nesta lista. Adicione grupos à lista primeiro." },
        { status: 400 }
      );
    }

    // Janela horária obrigatória
    const janelaErr = mensagemErroJanela(horarioInicio, horarioFim);
    if (janelaErr) return NextResponse.json({ error: janelaErr }, { status: 400 });
    if (!horarioInicio || !horarioFim) {
      return NextResponse.json(
        { error: "Horário de início e fim são obrigatórios (máx. 14h)." },
        { status: 400 }
      );
    }

    const payloadContinuo: Record<string, unknown> = {
      lista_id: listaId,
      bot_id,
      keywords: isListaOfertasMode ? [] : keywords,
      lista_ofertas_id: listaOfertasId || null,
      lista_ofertas_ml_id: listaOfertasMlId || null,
      lista_ofertas_info_id: listaOfertasInfoId || null,
      sub_id_1: subId1,
      sub_id_2: subId2,
      sub_id_3: subId3,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      ativo: true,
      proximo_indice: 0,
      keyword_pool_indices: {},
      updated_at: now,
    };

    if (id) {
      if (updateOnly) {
        const { data: prev, error: prevErr } = await supabase
          .from("telegram_grupos_venda_continuo")
          .select("ativo, proximo_indice, keyword_pool_indices")
          .eq("id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 });
        if (!prev) return NextResponse.json({ error: "Automação não encontrada." }, { status: 404 });
        payloadContinuo.ativo = (prev as { ativo?: boolean }).ativo ?? false;
        payloadContinuo.proximo_indice = (prev as { proximo_indice?: number }).proximo_indice ?? 0;
        payloadContinuo.keyword_pool_indices =
          (prev as { keyword_pool_indices?: unknown }).keyword_pool_indices ?? {};
      }
      const { data: updated, error } = await supabase
        .from("telegram_grupos_venda_continuo")
        .update(payloadContinuo)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, ativo, proximo_indice, ultimo_disparo_at")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        success: true,
        ativo: !!(updated as { ativo?: boolean })?.ativo,
        id: updated?.id,
        proximoIndice: (updated as { proximo_indice?: number })?.proximo_indice ?? 0,
        ultimoDisparoAt: (updated as { ultimo_disparo_at?: string | null })?.ultimo_disparo_at,
      });
    }

    const { data: inserted, error } = await supabase
      .from("telegram_grupos_venda_continuo")
      .insert({
        user_id: user.id,
        ...payloadContinuo,
      })
      .select("id, ativo, proximo_indice, ultimo_disparo_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      ativo: true,
      id: inserted?.id,
      proximoIndice: 0,
      ultimoDisparoAt: (inserted as { ultimo_disparo_at?: string | null })?.ultimo_disparo_at,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { error } = await supabase
      .from("telegram_grupos_venda_continuo")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
