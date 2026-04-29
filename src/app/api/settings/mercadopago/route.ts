/**
 * Credenciais manuais do Mercado Pago por usuário.
 *
 * Caminho alternativo ao OAuth: o usuário cola direto o `access_token` privado
 * (TEST-... ou APP_USR-...) e a `public_key`. Útil quando o app do MP do
 * usuário não está habilitado para fluxo Connect ou pra testes rápidos.
 *
 * GET    — devolve status atual (conectado, last4, source, live_mode).
 * POST   — valida e salva credenciais (`mp_credentials_source = 'manual'`).
 * DELETE — limpa todas as credenciais MP (oauth ou manual).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { MP_API_BASE } from "@/lib/mercadopago/config";

export const dynamic = "force-dynamic";

type MpUserResponse = {
  id?: number | string;
  email?: string;
  nickname?: string;
  site_id?: string;
  error?: string;
  message?: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "mp_access_token, mp_secret_last4, mp_public_key, mp_user_id, mp_credentials_source, mp_live_mode, mp_token_expires_at, mp_updated_at"
    )
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: "Falha ao consultar credenciais." }, { status: 500 });
  }

  const row = (data ?? {}) as {
    mp_access_token?: string | null;
    mp_secret_last4?: string | null;
    mp_public_key?: string | null;
    mp_user_id?: string | null;
    mp_credentials_source?: "oauth" | "manual" | null;
    mp_live_mode?: boolean | null;
    mp_token_expires_at?: string | null;
    mp_updated_at?: string | null;
  };

  const hasToken = !!row.mp_access_token;
  return NextResponse.json({
    has_credentials: hasToken,
    source: row.mp_credentials_source ?? null,
    secret_last4: row.mp_secret_last4 ?? null,
    public_key: row.mp_public_key ?? null,
    public_key_last4: row.mp_public_key ? row.mp_public_key.slice(-4) : null,
    mp_user_id: row.mp_user_id ?? null,
    live_mode: row.mp_live_mode ?? null,
    token_expires_at: row.mp_token_expires_at ?? null,
    updated_at: row.mp_updated_at ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const accessToken = String(body?.access_token ?? "").trim();
  const publicKey = String(body?.public_key ?? "").trim();

  if (!accessToken) {
    return NextResponse.json(
      { error: "Informe o access_token (TEST-... ou APP_USR-...)." },
      { status: 400 }
    );
  }

  const tokenIsTest = accessToken.startsWith("TEST-");
  const tokenIsProd = accessToken.startsWith("APP_USR-");
  if (!tokenIsTest && !tokenIsProd) {
    return NextResponse.json(
      { error: "access_token inválido. Deve começar com TEST- ou APP_USR-." },
      { status: 400 }
    );
  }

  if (publicKey) {
    const pkTest = publicKey.startsWith("TEST-");
    const pkProd = publicKey.startsWith("APP_USR-");
    if (!pkTest && !pkProd) {
      return NextResponse.json(
        { error: "public_key inválida. Deve começar com TEST- ou APP_USR-." },
        { status: 400 }
      );
    }
    if ((tokenIsTest && pkProd) || (tokenIsProd && pkTest)) {
      return NextResponse.json(
        { error: "access_token e public_key devem ser do mesmo ambiente (ambos TEST- ou ambos APP_USR-)." },
        { status: 400 }
      );
    }
  }

  // Valida o token batendo no /users/me — falha cedo se for inválido.
  let mpUserId = "";
  try {
    const r = await fetch(`${MP_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const j = (await r.json().catch(() => ({}))) as MpUserResponse;
    if (!r.ok || j.id == null) {
      const reason = j.error || j.message || `HTTP ${r.status}`;
      return NextResponse.json(
        { error: `Mercado Pago recusou o access_token: ${reason}` },
        { status: 400 }
      );
    }
    mpUserId = String(j.id);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? `Falha ao validar com o Mercado Pago: ${e.message}`
            : "Falha ao validar com o Mercado Pago.",
      },
      { status: 502 }
    );
  }

  const update: Record<string, string | boolean | null> = {
    mp_access_token: accessToken,
    mp_public_key: publicKey || null,
    mp_user_id: mpUserId || null,
    mp_credentials_source: "manual",
    mp_secret_last4: accessToken.slice(-4),
    mp_live_mode: tokenIsProd,
    mp_updated_at: new Date().toISOString(),
    // Manual não tem refresh nem expiração — limpa pra evitar confusão de oauth anterior.
    mp_refresh_token: null,
    mp_token_expires_at: null,
    mp_oauth_state: null,
    mp_oauth_state_expires_at: null,
  };

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: "Falha ao salvar credenciais." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    source: "manual",
    secret_last4: accessToken.slice(-4),
    public_key_last4: publicKey ? publicKey.slice(-4) : null,
    mp_user_id: mpUserId,
    live_mode: tokenIsProd,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      mp_access_token: null,
      mp_refresh_token: null,
      mp_token_expires_at: null,
      mp_public_key: null,
      mp_user_id: null,
      mp_credentials_source: null,
      mp_secret_last4: null,
      mp_live_mode: null,
      mp_updated_at: new Date().toISOString(),
      mp_oauth_state: null,
      mp_oauth_state_expires_at: null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Falha ao desconectar." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
