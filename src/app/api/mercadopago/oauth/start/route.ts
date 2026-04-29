/**
 * Inicia o fluxo OAuth do Mercado Pago.
 *
 *   1) Gera um `state` único e o grava em `profiles` (com expiração de 10 min).
 *   2) Redireciona o usuário para a URL de autorização do MP.
 *
 * O callback (`/api/mercadopago/oauth/callback`) valida o `state` e troca o
 * `code` retornado pelo Mercado Pago por `access_token` + `refresh_token`.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase-server";
import { buildMercadoPagoAuthUrl } from "@/lib/mercadopago/config";

export const dynamic = "force-dynamic";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let authUrl: string;
  let state: string;
  try {
    state = randomBytes(24).toString("hex");
    authUrl = buildMercadoPagoAuthUrl(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Configuração ausente.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      mp_oauth_state: state,
      mp_oauth_state_expires_at: new Date(Date.now() + STATE_TTL_MS).toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Falha ao iniciar OAuth do Mercado Pago." },
      { status: 500 }
    );
  }

  return NextResponse.redirect(authUrl, { status: 302 });
}
