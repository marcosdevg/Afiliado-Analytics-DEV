/**
 * Credenciais da Stripe por usuário.
 * Segue o padrão de /api/settings/mercadolivre-api (token em texto + last4 visível).
 * O POST valida a chave chamando Stripe antes de gravar — falha cedo se estiver errada.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_secret_key_last4, stripe_secret_key_updated_at")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({
    has_key: !!data?.stripe_secret_key_last4,
    last4: data?.stripe_secret_key_last4 ?? null,
    updated_at: data?.stripe_secret_key_updated_at ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secretKey = String(body?.stripe_secret_key ?? "").trim();

  if (!secretKey) {
    return NextResponse.json(
      { error: "Informe a chave secreta da Stripe (sk_live_... ou sk_test_...)." },
      { status: 400 },
    );
  }

  if (!/^sk_(live|test)_/.test(secretKey)) {
    return NextResponse.json(
      { error: "Chave inválida. A chave secreta da Stripe começa com sk_live_ ou sk_test_." },
      { status: 400 },
    );
  }

  // Valida a chave antes de gravar — evita guardar credenciais quebradas.
  try {
    const stripe = new Stripe(secretKey);
    await stripe.accounts.retrieve();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chave recusada pela Stripe";
    return NextResponse.json({ error: `Chave inválida: ${msg}` }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_secret_key: secretKey,
      stripe_secret_key_last4: secretKey.slice(-4),
      stripe_secret_key_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true, last4: secretKey.slice(-4) });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_secret_key: null,
      stripe_secret_key_last4: null,
      stripe_secret_key_updated_at: null,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
