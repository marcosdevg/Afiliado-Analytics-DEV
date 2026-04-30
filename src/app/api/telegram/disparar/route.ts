/**
 * Disparo manual Telegram: envia mensagem única (texto + imagem opcional) pra
 * todos os grupos vinculados a uma lista, ou pra um conjunto avulso de chat_ids.
 *
 *   POST /api/telegram/disparar
 *   body: {
 *     lista_id?: string,            // se passado, usa todos os grupos da lista
 *     bot_id?: string,              // obrigatório quando usa chat_ids direto
 *     chat_ids?: string[],          // alternativa a lista_id
 *     text: string,                 // texto/legenda — obrigatório se sem image_url
 *     image_url?: string,           // URL pública de imagem (opcional)
 *     parse_mode?: "HTML" | "MarkdownV2",
 *   }
 *
 *   resposta: { sent, failed, total, results: [{chat_id, ok, error?}] }
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendPayloadToChats, type TelegramParseMode } from "@/lib/telegram/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) return null;
  return createServiceClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const lista_id = typeof body.lista_id === "string" ? body.lista_id.trim() : "";
    const bot_id_input = typeof body.bot_id === "string" ? body.bot_id.trim() : "";
    const chatIdsRaw = Array.isArray(body.chat_ids) ? body.chat_ids : null;
    const text = typeof body.text === "string" ? body.text : "";
    const image_url = typeof body.image_url === "string" ? body.image_url.trim() : "";
    const parseModeInput = body.parse_mode;
    const parse_mode: TelegramParseMode | undefined =
      parseModeInput === "HTML" || parseModeInput === "MarkdownV2" ? parseModeInput : undefined;

    if (!text.trim() && !image_url) {
      return NextResponse.json({ error: "Informe text e/ou image_url." }, { status: 400 });
    }
    if (!lista_id && (!chatIdsRaw || chatIdsRaw.length === 0)) {
      return NextResponse.json({ error: "Informe lista_id ou chat_ids." }, { status: 400 });
    }

    // Resolve bot_id e chat_ids alvo
    let bot_id = "";
    let chatIds: string[] = [];

    if (lista_id) {
      const { data: lista } = await supabase
        .from("telegram_listas_grupos_venda")
        .select("bot_id")
        .eq("id", lista_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
      bot_id = (lista as { bot_id: string }).bot_id;

      const { data: grps, error: gErr } = await supabase
        .from("telegram_grupos_venda")
        .select("chat_id")
        .eq("user_id", user.id)
        .eq("lista_id", lista_id);
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
      chatIds = (grps ?? []).map((r: { chat_id: string }) => r.chat_id);
    } else {
      if (!bot_id_input) {
        return NextResponse.json(
          { error: "Informe bot_id quando usar chat_ids diretamente." },
          { status: 400 }
        );
      }
      bot_id = bot_id_input;
      chatIds = (chatIdsRaw ?? [])
        .filter((c: unknown): c is string => typeof c === "string")
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);
    }

    if (chatIds.length === 0) {
      return NextResponse.json({ error: "Nenhum grupo pra enviar." }, { status: 400 });
    }

    // Pega bot_token do bot — usa service role pra não ser bloqueado por RLS no leitura do token
    // (RLS já permite, mas precisamos do token mascarado vs real; service garante o real)
    const adminSupa = getServiceSupabase();
    if (!adminSupa) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." },
        { status: 500 }
      );
    }
    const { data: bot, error: botErr } = await adminSupa
      .from("telegram_bots")
      .select("bot_token, ativo, user_id")
      .eq("id", bot_id)
      .maybeSingle();
    if (botErr) return NextResponse.json({ error: botErr.message }, { status: 500 });
    if (!bot) return NextResponse.json({ error: "Bot não encontrado." }, { status: 404 });
    const botRow = bot as { bot_token: string; ativo: boolean; user_id: string };
    if (botRow.user_id !== user.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }
    if (!botRow.ativo) {
      return NextResponse.json({ error: "Bot está desativado." }, { status: 400 });
    }

    const results = await sendPayloadToChats(
      botRow.bot_token,
      chatIds,
      {
        text: text.trim(),
        imageUrl: image_url || undefined,
        parseMode: parse_mode,
      }
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;

    return NextResponse.json({
      sent,
      failed,
      total: results.length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
