/**
 * Lista grupos Telegram descobertos automaticamente pelo webhook receiver.
 *
 *   GET /api/telegram/grupos              → todos os grupos do usuário
 *   GET /api/telegram/grupos?bot_id=<uuid> → filtra por bot
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const botIdFilter = (url.searchParams.get("bot_id") ?? "").trim();

  let q = supabase
    .from("telegram_grupos_venda")
    .select("id, bot_id, lista_id, chat_id, group_name, descoberto_em, ultima_mensagem_em, created_at")
    .eq("user_id", user.id)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false });

  if (botIdFilter) q = q.eq("bot_id", botIdFilter);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ grupos: data ?? [] });
}
