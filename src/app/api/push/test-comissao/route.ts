/**
 * Dispara uma notificação de "Comissão total" pro próprio usuário, usando
 * o mesmo `payloadComissaoTotal` do cron. Útil pra confirmar visualmente
 * como vai chegar a notificação agendada (cron `comissao-total`).
 *
 * Lê o `comissao_total` mais recente da tabela `push_user_state` (mesma
 * fonte que o cron usa). Se ainda não houver registro pro user, manda a
 * versão "fallback" do payload (sem valor BRL).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendPushToUser } from "@/lib/push/web-push";
import { payloadComissaoTotal } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Pega o comissao_total que o front já registrou no push_user_state.
  // Se não houver registro (user nunca abriu o dashboard), `null` cai
  // no fallback do payload ("Acompanhe seu desempenho hoje").
  const { data: state } = await supabase
    .from("push_user_state")
    .select("comissao_total")
    .eq("user_id", user.id)
    .maybeSingle();

  const valor =
    state?.comissao_total != null && Number.isFinite(Number(state.comissao_total))
      ? Number(state.comissao_total)
      : null;

  const result = await sendPushToUser(user.id, payloadComissaoTotal(valor));
  return NextResponse.json({ ok: true, comissaoTotal: valor, result });
}
