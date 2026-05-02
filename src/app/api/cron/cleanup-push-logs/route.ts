/**
 * Limpa registros antigos de `push_send_log` (retenção de 30 dias).
 *
 * Roda 1x por dia (sugestão: 03:00 BRT / 06:00 UTC). Tabela cresce ~N
 * usuários × subscriptions × envios/dia — pra 500 users × 2 devices × 7
 * crons = ~7000 linhas/dia, ~210k em 30 dias. Sem limpeza, em 1 ano isso
 * vira 2.5M+ linhas.
 *
 * Schedule: `0 6 * * *` no vercel.json.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 30;

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await admin
    .from("push_send_log")
    .delete({ count: "exact" })
    .lt("sent_at", cutoff);

  if (error) {
    console.error("[cron] cleanup-push-logs falhou:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    retentionDays: RETENTION_DAYS,
    cutoff,
    deleted: count ?? 0,
  });
}
