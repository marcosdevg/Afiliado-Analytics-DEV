/**
 * Backfill: recria o Payment Link de um produto Stripe com coleta de endereço
 * e telefone habilitadas. A Stripe não permite alterar `phone_number_collection`
 * em payment links existentes — então criamos um novo link, arquivamos o antigo
 * e atualizamos a linha no banco. Preço e produto Stripe são reaproveitados.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { data: produto, error: loadError } = await supabase
      .from("produtos_infoprodutor")
      .select("id, user_id, provider, stripe_product_id, stripe_price_id, stripe_payment_link_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as {
      provider: string;
      stripe_product_id: string | null;
      stripe_price_id: string | null;
      stripe_payment_link_id: string | null;
    };
    if (row.provider !== "stripe") {
      return NextResponse.json({ error: "Só produtos Stripe podem ser atualizados." }, { status: 400 });
    }
    if (!row.stripe_price_id) {
      return NextResponse.json({ error: "Produto Stripe sem preço associado." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key")
      .eq("id", user.id)
      .single();
    const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
    if (!stripeKey.trim()) {
      return NextResponse.json({ error: "Conta Stripe não conectada." }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);

    // Cria novo Payment Link com coleta completa
    const newLink = await stripe.paymentLinks.create({
      line_items: [{ price: row.stripe_price_id, quantity: 1 }],
      shipping_address_collection: { allowed_countries: ["BR"] },
      phone_number_collection: { enabled: true },
    });

    // Arquiva o antigo (best-effort; pagamentos em andamento não são afetados)
    if (row.stripe_payment_link_id) {
      try {
        await stripe.paymentLinks.update(row.stripe_payment_link_id, { active: false });
      } catch {
        // Segue o fluxo — o cliente pode desativar manualmente no painel se necessário.
      }
    }

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .update({
        link: newLink.url,
        stripe_payment_link_id: newLink.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, link, stripe_payment_link_id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
