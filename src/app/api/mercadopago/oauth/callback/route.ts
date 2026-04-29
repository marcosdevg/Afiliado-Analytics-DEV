/**
 * Callback OAuth do Mercado Pago.
 *
 *   1) Recebe `code` + `state` do MP.
 *   2) Valida `state` contra o que está em `profiles.mp_oauth_state` (anti-CSRF).
 *   3) Troca `code` por `access_token` + `refresh_token` chamando
 *      POST https://api.mercadopago.com/oauth/token.
 *   4) Salva credenciais em `profiles` e limpa o state.
 *   5) Redireciona pra /configuracoes?mp=ok (ou ?mp=err em falha).
 *
 * Resposta esperada do MP no token endpoint:
 *   {
 *     access_token: "APP_USR-...",
 *     refresh_token: "TG-...",
 *     public_key: "APP_USR-...",
 *     user_id: 12345678,            // collector_id
 *     expires_in: 15552000,         // ~6 meses
 *     token_type: "bearer",
 *     live_mode: true,
 *     scope: "offline_access read write"
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import {
  MP_API_BASE,
  getMercadoPagoAppOrigin,
  getMercadoPagoClientId,
  getMercadoPagoClientSecret,
  getMercadoPagoRedirectUri,
} from "@/lib/mercadopago/config";

export const dynamic = "force-dynamic";

type MpTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  public_key?: string;
  user_id?: number | string;
  expires_in?: number;
  live_mode?: boolean;
  scope?: string;
  token_type?: string;
  error?: string;
  message?: string;
};

function redirectToConfigWithStatus(status: "ok" | "err", reason?: string) {
  try {
    const origin = getMercadoPagoAppOrigin();
    const url = new URL(`${origin}/configuracoes`);
    url.searchParams.set("mp", status);
    if (reason) url.searchParams.set("mp_reason", reason.slice(0, 200));
    return NextResponse.redirect(url.toString(), { status: 302 });
  } catch {
    // Sem NEXT_PUBLIC_APP_URL — devolve JSON direto.
    return NextResponse.json(
      { ok: status === "ok", error: reason ?? null },
      { status: status === "ok" ? 200 : 500 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const errorParam = url.searchParams.get("error")?.trim() ?? "";

  if (errorParam) {
    return redirectToConfigWithStatus("err", `Mercado Pago: ${errorParam}`);
  }
  if (!code || !state) {
    return redirectToConfigWithStatus("err", "Resposta inválida do Mercado Pago.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return redirectToConfigWithStatus("err", "Sessão expirou durante o fluxo OAuth. Refaça o login e tente novamente.");
  }

  // Valida o state guardado.
  const { data: profile } = await supabase
    .from("profiles")
    .select("mp_oauth_state, mp_oauth_state_expires_at")
    .eq("id", user.id)
    .single();

  const expectedState = (profile as { mp_oauth_state?: string | null } | null)?.mp_oauth_state ?? "";
  const stateExpStr = (profile as { mp_oauth_state_expires_at?: string | null } | null)?.mp_oauth_state_expires_at ?? "";
  const stateExpired =
    !stateExpStr || Number.isNaN(Date.parse(stateExpStr)) || new Date(stateExpStr).getTime() < Date.now();

  if (!expectedState || expectedState !== state || stateExpired) {
    return redirectToConfigWithStatus(
      "err",
      "State OAuth inválido ou expirado. Reinicie a conexão com o Mercado Pago."
    );
  }

  // Troca o code por tokens.
  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;
  try {
    clientId = getMercadoPagoClientId();
    clientSecret = getMercadoPagoClientSecret();
    redirectUri = getMercadoPagoRedirectUri();
  } catch (e) {
    return redirectToConfigWithStatus(
      "err",
      e instanceof Error ? e.message : "Configuração ausente."
    );
  }

  const tokenRes = await fetch(`${MP_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as MpTokenResponse;

  if (!tokenRes.ok || !tokenJson.access_token) {
    const reason = tokenJson.error || tokenJson.message || `HTTP ${tokenRes.status} no token endpoint do Mercado Pago.`;
    return redirectToConfigWithStatus("err", reason);
  }

  const accessToken = tokenJson.access_token;
  const expiresInSec = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : 0;
  const tokenExpiresAt = expiresInSec > 0
    ? new Date(Date.now() + expiresInSec * 1000).toISOString()
    : null;

  const updateRow: Record<string, string | boolean | null> = {
    mp_access_token: accessToken,
    mp_refresh_token: tokenJson.refresh_token ?? null,
    mp_token_expires_at: tokenExpiresAt,
    mp_public_key: tokenJson.public_key ?? null,
    mp_user_id: tokenJson.user_id != null ? String(tokenJson.user_id) : null,
    mp_credentials_source: "oauth",
    mp_secret_last4: accessToken.slice(-4),
    mp_live_mode: typeof tokenJson.live_mode === "boolean" ? tokenJson.live_mode : null,
    mp_updated_at: new Date().toISOString(),
    mp_oauth_state: null,
    mp_oauth_state_expires_at: null,
  };

  const { error: updErr } = await supabase
    .from("profiles")
    .update(updateRow)
    .eq("id", user.id);

  if (updErr) {
    return redirectToConfigWithStatus("err", `Falha ao salvar credenciais: ${updErr.message}`);
  }

  return redirectToConfigWithStatus("ok");
}
