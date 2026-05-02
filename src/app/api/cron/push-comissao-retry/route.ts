/**
 * Cron noturno de retry pra `comissao-total`.
 *
 * Roda às 22:00 BRT (01:00 UTC). É a "última chance" do dia: pega todos os
 * users que TÊM push_user_state mas NÃO têm entrada de sucesso em
 * push_send_log pra `comissao-total` no dia atual (BRT) — e dispara push
 * pra eles agora, com o valor mais recente que tiverem.
 *
 * Cobre os casos que escaparam do cron principal (10:30) e do catch-up
 * (no `/api/push/state`):
 *   • User nunca abriu o dashboard hoje
 *   • Cron principal e catch-up tiveram falha de rede/Vercel
 *   • Subscription estava temporariamente em throttle no FCM
 *
 * Schedule: `0 1 * * *` (01:00 UTC = 22:00 BRT) em vercel.json.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendPushPerUser } from "@/lib/push/web-push";
import { payloadComissaoTotal } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Início do dia BRT atual em UTC ISO. */
function brtStartOfDayIso(): string {
  const now = new Date();
  // BRT é UTC-3. Subtrai 3h pra "data BRT", zera hora, soma 3h pra UTC.
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const brtMidnight = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 0, 0, 0),
  );
  return new Date(brtMidnight.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();
  const dayStart = brtStartOfDayIso();

  // Passo 1: lista users que JÁ receberam com sucesso hoje.
  const { data: receivedRows } = await admin
    .from("push_send_log")
    .select("user_id")
    .eq("slug", "comissao-total")
    .eq("success", true)
    .gte("sent_at", dayStart);

  const receivedSet = new Set<string>(
    ((receivedRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
  );

  // Passo 2: lista TODOS os users com push_user_state (potenciais alvos).
  // Quem não está em `receivedSet` é candidato ao retry.
  const { data: stateRows } = await admin
    .from("push_user_state")
    .select("user_id, comissao_total");

  type StateRow = { user_id: string; comissao_total: number | null };
  const states = (stateRows ?? []) as StateRow[];
  const pending = states.filter((s) => !receivedSet.has(s.user_id));

  if (pending.length === 0) {
    return NextResponse.json({
      ok: true,
      retry: { totalEligible: states.length, alreadyReceived: states.length, pending: 0 },
    });
  }

  // Passo 3: dispara push pra users pendentes, usando seu comissao_total atual.
  const valorMap = new Map<string, number | null>();
  for (const s of pending) valorMap.set(s.user_id, s.comissao_total ?? null);

  const cache = new Map<string, ReturnType<typeof payloadComissaoTotal>>();
  const result = await sendPushPerUser(
    (userId) => {
      const cached = cache.get(userId);
      if (cached) return cached;
      const payload = payloadComissaoTotal(valorMap.get(userId) ?? null);
      cache.set(userId, payload);
      return payload;
    },
    {
      logSlug: "comissao-total",
      userIdsFilter: pending.map((p) => p.user_id),
    },
  );

  return NextResponse.json({
    ok: true,
    retry: {
      totalEligible: states.length,
      alreadyReceived: states.length - pending.length,
      pending: pending.length,
      sent: result,
    },
  });
}
